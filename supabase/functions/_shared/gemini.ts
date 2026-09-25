// Classificação da foto com o Gemini (REST, saída JSON estruturada).
import { MATERIALS, isMaterial, type Material } from './materials.ts'

export interface AiResult {
  is_trash: boolean
  item_label: string
  material: Material
  brand: string
  color: string
  condition: string
  bin_visible: boolean
  is_screen_or_print: boolean
  confidence: number
  tip: string
}

// Flash Lite: maior cota gratuita (500 requisições/dia, 15/min por modelo)
export const DEFAULT_GEMINI_MODEL = 'gemini-3.5-flash-lite'

export const GEMINI_PROMPT = `Você é o classificador de resíduos do app RankTrash, da campanha Lixo Zero de uma universidade.
Analise a foto tirada por um aluno que vai descartar um resíduo e responda SOMENTE no JSON pedido.
- is_trash: true se a foto mostra algum resíduo ou objeto descartável (lata, garrafa, copo, embalagem, papel, guardanapo, resto de comida, pilha...), esteja ele na mão, na mesa, no chão ou na lixeira. Seja tolerante: NÃO é preciso aparecer lixeira. false apenas quando não há nenhum objeto descartável (pessoas, paisagens, animais, foto escura/vazia).
- item_label: nome curto do item em português (ex.: "Lata de refrigerante").
- material: o material predominante, para a coleta seletiva. Latas de bebida = "aluminio".
- brand: marca visível ou "" se não der para ver.
- color: cor predominante do item.
- condition: estado do item (ex.: "amassada", "intacta", "rasgado", "vazia").
- bin_visible: true se uma lixeira/coletor aparece na foto (apenas informativo).
- is_screen_or_print: true se a imagem parece ser foto de uma tela, de uma foto impressa ou uma imagem da internet (moiré, pixels de tela, bordas de monitor, reflexo de vidro de tela).
- confidence: 0 a 1, sua confiança na identificação do item e do material.
- tip: uma dica curta (máx. 90 caracteres) sobre como descartar esse item corretamente.`

export const GEMINI_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    is_trash: { type: 'BOOLEAN' },
    item_label: { type: 'STRING' },
    material: { type: 'STRING', enum: [...MATERIALS] },
    brand: { type: 'STRING' },
    color: { type: 'STRING' },
    condition: { type: 'STRING' },
    bin_visible: { type: 'BOOLEAN' },
    is_screen_or_print: { type: 'BOOLEAN' },
    confidence: { type: 'NUMBER' },
    tip: { type: 'STRING' },
  },
  required: [
    'is_trash',
    'item_label',
    'material',
    'brand',
    'color',
    'condition',
    'bin_visible',
    'is_screen_or_print',
    'confidence',
    'tip',
  ],
}

/**
 * Raciocínio mínimo = resposta rápida (classificar uma foto não precisa "pensar").
 * Gemini 3.x usa thinkingLevel; o 2.5 usa thinkingBudget.
 */
export function thinkingConfigFor(model: string): Record<string, unknown> {
  return /gemini-2\.5/.test(model) ? { thinkingBudget: 0 } : { thinkingLevel: 'MINIMAL' }
}

/** Monta o corpo do generateContent. Com `model`, inclui a configuração de raciocínio mínimo dele. */
export function buildGeminiRequest(imageBase64: string, mimeType: string, model?: string) {
  return {
    contents: [
      {
        role: 'user',
        parts: [{ inline_data: { mime_type: mimeType, data: imageBase64 } }, { text: GEMINI_PROMPT }],
      },
    ],
    generationConfig: {
      temperature: 0.1,
      responseMimeType: 'application/json',
      responseSchema: GEMINI_RESPONSE_SCHEMA,
      // 256 tokens por imagem em vez de ~1100: bem mais rápido e basta para reconhecer o item
      mediaResolution: 'MEDIA_RESOLUTION_LOW',
      ...(model ? { thinkingConfig: thinkingConfigFor(model) } : {}),
    },
  }
}

/** Valida e normaliza a resposta crua do generateContent. */
export function parseGeminiResponse(body: unknown): AiResult {
  const text = (body as { candidates?: { content?: { parts?: { text?: string }[] } }[] })?.candidates?.[0]?.content
    ?.parts?.map((p) => p.text ?? '')
    .join('')
  if (!text) throw new Error('Resposta vazia do Gemini')
  const raw = JSON.parse(text) as Record<string, unknown>
  const str = (v: unknown, max = 120) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
  const material = isMaterial(raw.material) ? raw.material : 'nao_reciclavel'
  const confidence = typeof raw.confidence === 'number' ? Math.min(1, Math.max(0, raw.confidence)) : 0
  return {
    is_trash: raw.is_trash === true,
    item_label: str(raw.item_label, 60) || 'Item',
    material,
    brand: str(raw.brand, 40),
    color: str(raw.color, 30),
    condition: str(raw.condition, 30),
    bin_visible: raw.bin_visible === true,
    is_screen_or_print: raw.is_screen_or_print === true,
    confidence,
    tip: str(raw.tip, 120),
  }
}

/** Modelos reserva, usados quando o principal demora, está sobrecarregado ou indisponível. */
export const FALLBACK_GEMINI_MODELS = ['gemini-3.1-flash-lite', 'gemini-2.5-flash-lite']
const RETRYABLE = new Set([404, 408, 429, 500, 502, 503, 504])
/**
 * Se ninguém respondeu em HEDGE_MS, dispara o próximo da fila em paralelo e usa quem responder primeiro.
 * A latência do plano gratuito varia muito (a mesma chamada leva 3 s ou 12 s), então vale insistir cedo.
 */
export const GEMINI_HEDGE_MS = 2_500
/** Tempo máximo de cada chamada ao Gemini. */
export const GEMINI_ATTEMPT_TIMEOUT_MS = 20_000
/** Tempo total para classificar (a Edge Function e o app não podem ficar esperando indefinidamente). */
export const GEMINI_TOTAL_BUDGET_MS = 45_000
const MAX_PARALLEL = 3

export interface ClassifyOptions {
  signal?: AbortSignal
  hedgeMs?: number
  budgetMs?: number
}

class FatalGeminiError extends Error {}

/**
 * Classifica a foto. Começa pelo modelo principal; se ele falhar, passa ao próximo na hora,
 * e se ele só estiver lento, dispara o próximo em paralelo (no máximo 3 ao mesmo tempo).
 * Fila: principal → 1º reserva → principal de novo → demais reservas.
 */
export function classifyImage(
  apiKey: string,
  imageBase64: string,
  mimeType: string,
  model = DEFAULT_GEMINI_MODEL,
  opts: ClassifyOptions = {},
): Promise<AiResult> {
  const hedgeMs = opts.hedgeMs ?? GEMINI_HEDGE_MS
  const budget = AbortSignal.timeout(opts.budgetMs ?? GEMINI_TOTAL_BUDGET_MS)
  const outer = opts.signal ? AbortSignal.any([budget, opts.signal]) : budget
  // cada item: modelo + se manda a configuração de raciocínio mínimo
  const [first, ...rest] = FALLBACK_GEMINI_MODELS.filter((x) => x !== model)
  const queue = [model, first, model, ...rest].filter(Boolean).map((m) => ({ m, thinking: true }))
  const controllers: AbortController[] = []

  return new Promise<AiResult>((resolve, reject) => {
    let next = 0
    let running = 0
    let done = false
    let hedgeTimer: ReturnType<typeof setTimeout> | undefined
    let lastError: Error = new Error('Gemini indisponível')

    const finish = (fn: () => void) => {
      if (done) return
      done = true
      clearTimeout(hedgeTimer)
      outer.removeEventListener('abort', onAbort)
      controllers.forEach((c) => c.abort())
      fn()
    }
    const onAbort = () => finish(() => reject(new Error(`Gemini: tempo esgotado (${lastError.message})`)))

    const launch = () => {
      if (done) return
      if (next >= queue.length) {
        if (running === 0) finish(() => reject(lastError))
        return
      }
      const { m, thinking } = queue[next++]
      running++
      const ctrl = new AbortController()
      controllers.push(ctrl)
      clearTimeout(hedgeTimer)
      hedgeTimer = setTimeout(() => running < MAX_PARALLEL && launch(), hedgeMs)
      const started = Date.now()

      fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify(buildGeminiRequest(imageBase64, mimeType, thinking ? m : undefined)),
        signal: AbortSignal.any([ctrl.signal, outer, AbortSignal.timeout(GEMINI_ATTEMPT_TIMEOUT_MS)]),
      })
        .then(async (res) => {
          if (res.ok) {
            const result = parseGeminiResponse(await res.json())
            console.log(`Gemini ok: ${m} em ${Date.now() - started} ms`)
            finish(() => resolve(result))
            return
          }
          const text = await res.text()
          const err = new Error(`Gemini ${m} ${res.status}: ${text.slice(0, 300)}`)
          if (res.status === 400 && thinking && /thinking/i.test(text)) {
            // modelo não aceita a configuração de raciocínio: repete já, sem ela
            queue.splice(next, 0, { m, thinking: false })
            throw err
          }
          if (!RETRYABLE.has(res.status)) throw new FatalGeminiError(err.message) // chave inválida etc.
          throw err
        })
        .catch((e: Error) => {
          if (done) return
          if (e instanceof FatalGeminiError) return finish(() => reject(e))
          lastError = e.message.startsWith('Gemini ') ? e : new Error(`Gemini ${m} falhou: ${e.name} ${e.message}`)
          console.warn(lastError.message)
          running--
          launch() // falhou: tenta o próximo na hora
        })
    }

    if (outer.aborted) return onAbort()
    outer.addEventListener('abort', onAbort)
    launch()
  })
}

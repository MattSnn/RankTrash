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

export const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash'

export const GEMINI_PROMPT = `Você é o classificador de resíduos do app RankTrash, da campanha Lixo Zero de uma universidade.
Analise a foto tirada por um aluno que vai descartar um resíduo e responda SOMENTE no JSON pedido.
- is_trash: true se o foco da foto é um resíduo/objeto descartável (lata, garrafa, embalagem, papel, resto de comida, pilha...). false para pessoas, paisagens, animais, fotos vazias ou objetos que claramente não estão sendo descartados.
- item_label: nome curto do item em português (ex.: "Lata de refrigerante").
- material: o material predominante, para a coleta seletiva. Latas de bebida = "aluminio".
- brand: marca visível ou "" se não der para ver.
- color: cor predominante do item.
- condition: estado do item (ex.: "amassada", "intacta", "rasgado", "vazia").
- bin_visible: true se uma lixeira/coletor aparece na foto (mesmo parcialmente).
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

export function buildGeminiRequest(imageBase64: string, mimeType: string) {
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

export async function classifyImage(
  apiKey: string,
  imageBase64: string,
  mimeType: string,
  model = DEFAULT_GEMINI_MODEL,
): Promise<AiResult> {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify(buildGeminiRequest(imageBase64, mimeType)),
  })
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 300)}`)
  return parseGeminiResponse(await res.json())
}

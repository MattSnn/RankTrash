import { describe, expect, it } from 'vitest'
import {
  aiSignature,
  checkAiResult,
  checkPhotoHash,
  checkRateLimits,
  dhashFromGray,
  grayGrid,
  hammingHex,
  type RecentDisposal,
} from '../supabase/functions/_shared/antifraud.ts'
import { localDate } from '../supabase/functions/_shared/geo.ts'
import { parseGeminiResponse, type AiResult } from '../supabase/functions/_shared/gemini.ts'

const now = new Date('2026-09-25T15:00:00Z')
const today = localDate(now)
const ago = (s: number) => new Date(now.getTime() - s * 1000).toISOString()
const rec = (over: Partial<RecentDisposal> = {}): RecentDisposal => ({
  user_id: 'u',
  bin_id: 'b1',
  dhash: null,
  signature: null,
  created_at: ago(3600),
  ...over,
})

const ai: AiResult = {
  is_trash: true,
  item_label: 'Lata',
  material: 'aluminio',
  brand: 'Coca-Cola',
  color: 'Vermelha',
  condition: 'amassada',
  bin_visible: true,
  is_screen_or_print: false,
  confidence: 0.9,
  tip: '',
}

describe('dHash', () => {
  it('gera 64 bits em hex e distância de Hamming', () => {
    const ramp = Array.from({ length: 72 }, (_, i) => i % 9) // sempre crescente → todos os bits 1
    expect(dhashFromGray(ramp)).toBe('ffffffffffffffff')
    const flat = Array.from({ length: 72 }, () => 5)
    expect(dhashFromGray(flat)).toBe('0000000000000000')
    expect(hammingHex('ffffffffffffffff', '0000000000000000')).toBe(64)
    expect(hammingHex('00000000000000ff', '000000000000000f')).toBe(4)
  })

  it('reduz RGBA para 9x8 com média por área', () => {
    // imagem 18x8: metade esquerda preta, direita branca
    const w = 18, h = 8
    const rgba = new Uint8Array(w * h * 4)
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) rgba.fill(x < 9 ? 0 : 255, (y * w + x) * 4, (y * w + x) * 4 + 3)
    const g = grayGrid(rgba, w, h)
    expect(g).toHaveLength(72)
    expect(g[0]).toBe(0)
    expect(g[8]).toBeCloseTo(255, 0)
    // escala não muda o hash
    const big = new Uint8Array(w * 4 * h * 4 * 4)
    for (let y = 0; y < h * 4; y++) for (let x = 0; x < w * 4; x++) big.fill(x < 36 ? 0 : 255, (y * w * 4 + x) * 4, (y * w * 4 + x) * 4 + 3)
    expect(dhashFromGray(grayGrid(big, w * 4, h * 4))).toBe(dhashFromGray(g))
  })

  it('rejeita tamanho errado', () => {
    expect(() => dhashFromGray([1, 2, 3])).toThrow()
  })
})

describe('checkPhotoHash', () => {
  it('recusa foto quase igual a uma sua e marca suspeita se for de outra pessoa', () => {
    const h = 'ffffffffffffff00'
    expect(checkPhotoHash(h, [rec({ dhash: 'ffffffffffffff0f' })], []).reject).toBe('duplicate_photo')
    const other = checkPhotoHash(h, [], [rec({ user_id: 'x', dhash: h })])
    expect(other).toEqual({ reject: null, suspicious: true })
    expect(checkPhotoHash(h, [rec({ dhash: '0000000000000000' })], [])).toEqual({ reject: null, suspicious: false })
  })
})

describe('checkRateLimits', () => {
  const ld = (d: Date) => localDate(d)
  it('exige 60 s entre registros', () => {
    expect(checkRateLimits([rec({ created_at: ago(30) })], 'b1', now, today, ld)).toBe('too_fast')
    expect(checkRateLimits([rec({ created_at: ago(90) })], 'b1', now, today, ld)).toBeNull()
  })
  it('limita por dia e por lixeira', () => {
    const many = Array.from({ length: 20 }, (_, i) => rec({ created_at: ago(120 + i * 60), bin_id: `b${i}` }))
    expect(checkRateLimits(many, 'b1', now, today, ld)).toBe('daily_limit')
    const sameBin = Array.from({ length: 8 }, (_, i) => rec({ created_at: ago(120 + i * 60) }))
    expect(checkRateLimits(sameBin, 'b1', now, today, ld)).toBe('bin_daily_limit')
    expect(checkRateLimits(sameBin, 'b2', now, today, ld)).toBeNull()
  })
})

describe('checkAiResult', () => {
  const sig = aiSignature(ai)
  it('normaliza a assinatura', () => {
    expect(sig).toBe('aluminio|coca cola|vermelha|amassada')
  })
  it('recusa não-lixo e foto de tela', () => {
    expect(checkAiResult({ ...ai, is_trash: false }, sig, 'b1', [], now).reject).toBe('not_trash')
    expect(checkAiResult({ ...ai, is_screen_or_print: true }, sig, 'b1', [], now).reject).toBe('screen_photo')
  })
  it('recusa o mesmo item na mesma lixeira em 10 min', () => {
    expect(checkAiResult(ai, sig, 'b1', [rec({ signature: sig, created_at: ago(300) })], now).reject).toBe('duplicate_item')
    expect(checkAiResult(ai, sig, 'b1', [rec({ signature: sig, created_at: ago(900) })], now).reject).toBeNull()
    expect(checkAiResult(ai, sig, 'b2', [rec({ signature: sig, created_at: ago(300) })], now).reject).toBeNull()
  })
  it('manda para revisão com baixa confiança', () => {
    const r = checkAiResult({ ...ai, confidence: 0.4 }, sig, 'b1', [], now)
    expect(r.reject).toBeNull()
    expect(r.needsReview).toBe(true)
  })
})

describe('parseGeminiResponse', () => {
  const wrap = (obj: unknown) => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(obj) }] } }] })
  it('normaliza campos e material desconhecido', () => {
    const r = parseGeminiResponse(wrap({ ...ai, material: 'isopor', confidence: 3 }))
    expect(r.material).toBe('nao_reciclavel')
    expect(r.confidence).toBe(1)
    expect(r.is_trash).toBe(true)
  })
  it('falha com resposta vazia', () => {
    expect(() => parseGeminiResponse({ candidates: [] })).toThrow()
  })
})

describe('classifyImage (retry e modelo reserva)', () => {
  const ok = { candidates: [{ content: { parts: [{ text: JSON.stringify({ is_trash: true, item_label: 'Lata', material: 'aluminio', confidence: 0.9 }) }] } }] }
  it('tenta de novo em 503 e cai para o modelo reserva', async () => {
    const { classifyImage } = await import('../supabase/functions/_shared/gemini.ts')
    const calls: string[] = []
    const realFetch = globalThis.fetch
    globalThis.fetch = (async (url: string) => {
      calls.push(url.split('/models/')[1].split(':')[0])
      return calls.length < 3 ? new Response('busy', { status: 503 }) : new Response(JSON.stringify(ok), { status: 200 })
    }) as typeof fetch
    try {
      const r = await classifyImage('k', 'b64', 'image/jpeg')
      expect(r.item_label).toBe('Lata')
      expect(calls).toEqual(['gemini-2.5-flash', 'gemini-2.5-flash', 'gemini-2.5-flash-lite'])
    } finally {
      globalThis.fetch = realFetch
    }
  })
  it('não insiste em erro de chave (403)', async () => {
    const { classifyImage } = await import('../supabase/functions/_shared/gemini.ts')
    const realFetch = globalThis.fetch
    let n = 0
    globalThis.fetch = (async () => { n++; return new Response('forbidden', { status: 403 }) }) as typeof fetch
    try {
      await expect(classifyImage('k', 'b64', 'image/jpeg')).rejects.toThrow(/403/)
      expect(n).toBe(1)
    } finally {
      globalThis.fetch = realFetch
    }
  })
})

describe('classifyImage (tempo limite)', () => {
  it('desiste de uma chamada travada e usa o reserva, dentro do orçamento', async () => {
    const { classifyImage } = await import('../supabase/functions/_shared/gemini.ts')
    const ok = { candidates: [{ content: { parts: [{ text: JSON.stringify({ is_trash: true, item_label: 'Copo', material: 'papel', confidence: 0.9 }) }] } }] }
    const realFetch = globalThis.fetch
    const calls: string[] = []
    globalThis.fetch = ((url: string, init: RequestInit) => {
      const m = url.split('/models/')[1].split(':')[0]
      calls.push(m)
      if (m === 'gemini-2.5-flash') {
        // nunca responde: só termina quando o AbortSignal dispara
        return new Promise((_, reject) => init.signal!.addEventListener('abort', () => reject(new DOMException('timeout', 'TimeoutError'))))
      }
      return Promise.resolve(new Response(JSON.stringify(ok), { status: 200 }))
    }) as typeof fetch
    try {
      const started = Date.now()
      const r = await classifyImage('k', 'b64', 'image/jpeg', 'gemini-2.5-flash', 12000)
      expect(r.item_label).toBe('Copo')
      expect(calls[calls.length - 1]).toBe('gemini-2.5-flash-lite')
      expect(Date.now() - started).toBeLessThan(12500)
    } finally {
      globalThis.fetch = realFetch
    }
  }, 20000)
})

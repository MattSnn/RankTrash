// Regras antifraude: hash perceptual, assinatura semântica e limites de uso.
import type { AiResult } from './gemini.ts'

export const MIN_SECONDS_BETWEEN = 60
export const MAX_PER_DAY = 20
export const MAX_PER_BIN_PER_DAY = 8
/** Distância de Hamming (0–64) abaixo da qual duas fotos são "a mesma". */
export const DHASH_DUPLICATE_DISTANCE = 10
export const SIGNATURE_WINDOW_MINUTES = 10
export const MIN_CONFIDENCE = 0.6

/**
 * dHash de 64 bits a partir de uma imagem em tons de cinza 9x8 (linha a linha).
 * Cada bit indica se o pixel é mais escuro que o vizinho da direita.
 */
export function dhashFromGray(gray: ArrayLike<number>): string {
  if (gray.length !== 72) throw new Error('dHash espera 9x8 = 72 pixels')
  let hash = 0n
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      hash = (hash << 1n) | (gray[y * 9 + x] < gray[y * 9 + x + 1] ? 1n : 0n)
    }
  }
  return hash.toString(16).padStart(16, '0')
}

/** Reduz uma imagem RGBA para 9x8 em tons de cinza (média por área), entrada do dHash. */
export function grayGrid(rgba: ArrayLike<number>, width: number, height: number, outW = 9, outH = 8): number[] {
  const out: number[] = []
  for (let gy = 0; gy < outH; gy++) {
    const y0 = Math.floor((gy * height) / outH)
    const y1 = Math.max(y0 + 1, Math.floor(((gy + 1) * height) / outH))
    for (let gx = 0; gx < outW; gx++) {
      const x0 = Math.floor((gx * width) / outW)
      const x1 = Math.max(x0 + 1, Math.floor(((gx + 1) * width) / outW))
      let sum = 0
      let n = 0
      // amostra no máximo ~16x16 pixels por célula para ficar rápido em fotos grandes
      const sy = Math.max(1, Math.floor((y1 - y0) / 16))
      const sx = Math.max(1, Math.floor((x1 - x0) / 16))
      for (let y = y0; y < y1; y += sy) {
        for (let x = x0; x < x1; x += sx) {
          const i = (y * width + x) * 4
          sum += 0.299 * rgba[i] + 0.587 * rgba[i + 1] + 0.114 * rgba[i + 2]
          n++
        }
      }
      out.push(sum / n)
    }
  }
  return out
}

export function hammingHex(a: string, b: string): number {
  let x = BigInt(`0x${a}`) ^ BigInt(`0x${b}`)
  let count = 0
  while (x > 0n) {
    count += Number(x & 1n)
    x >>= 1n
  }
  return count
}

function norm(s: string | undefined | null): string {
  return (s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/** "Impressão digital" do objeto descrita pela IA (material + marca + cor + estado). */
export function aiSignature(ai: Pick<AiResult, 'material' | 'brand' | 'color' | 'condition'>): string {
  return [ai.material, norm(ai.brand), norm(ai.color), norm(ai.condition)].join('|')
}

export interface RecentDisposal {
  user_id: string
  bin_id: string | null
  dhash: string | null
  signature: string | null
  created_at: string
}

export type RejectCode =
  | 'too_fast'
  | 'daily_limit'
  | 'bin_daily_limit'
  | 'duplicate_photo'
  | 'duplicate_item'
  | 'not_trash'
  | 'screen_photo'

export const REJECT_MESSAGES: Record<RejectCode, string> = {
  too_fast: 'Calma! Espere 1 minuto entre um registro e outro.',
  daily_limit: `Limite de ${MAX_PER_DAY} registros por dia atingido. Volte amanhã!`,
  bin_daily_limit: 'Limite de registros nesta lixeira hoje atingido.',
  duplicate_photo: 'Essa foto parece igual a um registro seu anterior.',
  duplicate_item: 'Esse mesmo item já foi registrado agora há pouco.',
  not_trash: 'Não reconhecemos um resíduo na foto. Tente de novo mostrando só o item.',
  screen_photo: 'Parece uma foto de tela ou de outra foto. Fotografe o item real.',
}

/** Checagens que não dependem da foto (rodam antes de chamar a IA). */
export function checkRateLimits(
  mine: RecentDisposal[],
  binId: string,
  now: Date,
  today: string,
  localDate: (d: Date) => string,
): RejectCode | null {
  const last = mine.reduce<number>((max, d) => Math.max(max, Date.parse(d.created_at)), 0)
  if (last && (now.getTime() - last) / 1000 < MIN_SECONDS_BETWEEN) return 'too_fast'
  const todays = mine.filter((d) => localDate(new Date(d.created_at)) === today)
  if (todays.length >= MAX_PER_DAY) return 'daily_limit'
  if (todays.filter((d) => d.bin_id === binId).length >= MAX_PER_BIN_PER_DAY) return 'bin_daily_limit'
  return null
}

export interface PhotoCheck {
  reject: RejectCode | null
  /** foto parecida com a de outra pessoa nas últimas 24h → revisão manual */
  suspicious: boolean
}

export function checkPhotoHash(dhash: string, mine: RecentDisposal[], others: RecentDisposal[]): PhotoCheck {
  const close = (d: RecentDisposal) => d.dhash != null && hammingHex(dhash, d.dhash) <= DHASH_DUPLICATE_DISTANCE
  if (mine.some(close)) return { reject: 'duplicate_photo', suspicious: false }
  return { reject: null, suspicious: others.some(close) }
}

export interface AiCheck {
  reject: RejectCode | null
  needsReview: boolean
  reasons: string[]
}

export function checkAiResult(
  ai: AiResult,
  signature: string,
  binId: string,
  mine: RecentDisposal[],
  now: Date,
): AiCheck {
  if (ai.is_screen_or_print) return { reject: 'screen_photo', needsReview: false, reasons: [] }
  if (!ai.is_trash) return { reject: 'not_trash', needsReview: false, reasons: [] }
  const windowMs = SIGNATURE_WINDOW_MINUTES * 60 * 1000
  const repeated = mine.some(
    (d) => d.signature === signature && d.bin_id === binId && now.getTime() - Date.parse(d.created_at) < windowMs,
  )
  if (repeated) return { reject: 'duplicate_item', needsReview: false, reasons: [] }
  const reasons: string[] = []
  if (ai.confidence < MIN_CONFIDENCE) reasons.push('baixa confiança da IA')
  return { reject: null, needsReview: reasons.length > 0, reasons }
}

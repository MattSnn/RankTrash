// Efeitos sonoros 8-bit gerados com WebAudio (sem arquivos de áudio).
const KEY = 'ranktrash:sound'

let ctx: AudioContext | null = null

export function soundEnabled(): boolean {
  try {
    return localStorage.getItem(KEY) !== 'off'
  } catch {
    return true
  }
}

export function setSoundEnabled(on: boolean) {
  try {
    localStorage.setItem(KEY, on ? 'on' : 'off')
  } catch {
    /* sem storage: só não lembra a preferência */
  }
}

function tone(freq: number, start: number, dur: number, type: OscillatorType = 'square', gain = 0.05) {
  if (!ctx) return
  const osc = ctx.createOscillator()
  const g = ctx.createGain()
  osc.type = type
  osc.frequency.value = freq
  g.gain.setValueAtTime(gain, ctx.currentTime + start)
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + dur)
  osc.connect(g).connect(ctx.destination)
  osc.start(ctx.currentTime + start)
  osc.stop(ctx.currentTime + start + dur)
}

const SOUNDS = {
  click: () => tone(660, 0, 0.05),
  shutter: () => {
    tone(1200, 0, 0.04, 'square')
    tone(400, 0.05, 0.08, 'triangle')
  },
  scan: () => [0, 0.12, 0.24, 0.36].forEach((t, i) => tone(300 + i * 80, t, 0.1, 'triangle', 0.04)),
  success: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.09, 0.14)),
  fail: () => [392, 330, 262].forEach((f, i) => tone(f, i * 0.12, 0.16, 'sawtooth', 0.04)),
}

export function play(name: keyof typeof SOUNDS) {
  if (!soundEnabled()) return
  try {
    ctx ??= new AudioContext()
    if (ctx.state === 'suspended') void ctx.resume()
    SOUNDS[name]()
  } catch {
    /* áudio indisponível */
  }
}

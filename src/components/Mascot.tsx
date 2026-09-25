// "Lixo-bot": mascote original em pixel art (lixeira com lentes grandes).
import { PixelArt } from './PixelArt'

export type Mood = 'idle' | 'happy' | 'sad' | 'scan'

const HEAD = ['......KKKK......', '.....KGGGGK.....', '..KKKKKKKKKKKK..', '.KGGGGGGGGGGGGK.', '.KggggggggggggK.', '..KKKKKKKKKKKK..', '..KBBBBBBBBBBK..']

const EYES: Record<Mood, string[]> = {
  idle: ['..KBWWWBBWWWBK..', '..KWWWWBBWWWWK..', '..KWWWWBBWWWWK..', '..KBWWBBBBWWBK..'],
  scan: ['..KBWWWBBWWWBK..', '..KWWKWBBWWKWK..', '..KWWKWBBWWKWK..', '..KBWWBBBBWWBK..'],
  happy: ['..KBBBBBBBBBBK..', '..KBWWBBBBWWBK..', '..KWBBWBBWBBWK..', '..KBBBBBBBBBBK..'],
  sad: ['..KBBBBBBBBBBK..', '..KBBBBBBBBBBK..', '..KWWWWBBWWWWK..', '..KBWWBBBBWWBK..'],
}

const BODY = ['..KBBBBBBBBBBK..', '..KBBbBBBBbBBK..', '..KBBbBBBBbBBK..', '...KBbBBBBbBK...', '...KKKKKKKKKK...']

const PALETTE = {
  K: '#0a0f1f',
  G: '#6fd07c',
  g: '#2f7a3c',
  B: '#3d8fd1',
  b: '#1d5a92',
  W: '#ffffff',
}

export function Mascot({ mood = 'idle', size = 96, className }: { mood?: Mood; size?: number; className?: string }) {
  return (
    <PixelArt
      rows={[...HEAD, ...EYES[mood], ...BODY]}
      palette={PALETTE}
      size={size}
      className={`mascot mascot--${mood} ${className ?? ''}`}
      title="Lixo-bot"
    />
  )
}

/** Só as "lentes" do mascote, para o logo. */
export function MascotEyes({ size = 40 }: { size?: number }) {
  return (
    <PixelArt
      rows={['.KKKKKKKKKKKK.', 'KRRRRRRRRRRRRK', 'KRWWWRRRRWWWRK', 'KWWWWRRRRWWWWK', 'KWWWWRRRRWWWWK', 'KRWWRRRRRRWWRK', '.KKKKKKKKKKKK.']}
      palette={{ K: '#0a0f1f', R: '#6fd07c', W: '#ffffff' }}
      size={size}
    />
  )
}

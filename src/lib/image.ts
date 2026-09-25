import { dhashFromGray, grayGrid } from '../../supabase/functions/_shared/antifraud.ts'

/** Captura o frame atual do vídeo como JPEG, com o maior lado limitado a `maxSide`. */
export function captureFrame(video: HTMLVideoElement, maxSide = 1280, quality = 0.85): Promise<Blob> {
  const scale = Math.min(1, maxSide / Math.max(video.videoWidth, video.videoHeight))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(video.videoWidth * scale)
  canvas.height = Math.round(video.videoHeight * scale)
  canvas.getContext('2d')!.drawImage(video, 0, 0, canvas.width, canvas.height)
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Falha ao capturar a foto'))), 'image/jpeg', quality),
  )
}

/** dHash calculado no navegador (usado no modo demo; em produção o servidor calcula). */
export async function dhashOfBlob(blob: Blob): Promise<string> {
  const bmp = await createImageBitmap(blob)
  const canvas = document.createElement('canvas')
  canvas.width = bmp.width
  canvas.height = bmp.height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(bmp, 0, 0)
  const { data } = ctx.getImageData(0, 0, bmp.width, bmp.height)
  // mesmo algoritmo do servidor
  return dhashFromGray(grayGrid(data, bmp.width, bmp.height))
}

export async function openRearCamera(): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) throw new Error('Este navegador não permite acesso à câmera.')
  return navigator.mediaDevices.getUserMedia({
    audio: false,
    video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 1280 } },
  })
}

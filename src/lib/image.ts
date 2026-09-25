import { dhashFromGray, grayGrid } from '../../supabase/functions/_shared/antifraud.ts'

/** Desenha a imagem em JPEG, com o maior lado limitado a `maxSide` (o servidor só aceita JPEG). */
function drawToJpeg(source: CanvasImageSource, width: number, height: number, maxSide = 1024, quality = 0.8): Promise<Blob> {
  const scale = Math.min(1, maxSide / Math.max(width, height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(width * scale)
  canvas.height = Math.round(height * scale)
  canvas.getContext('2d')!.drawImage(source, 0, 0, canvas.width, canvas.height)
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Falha ao processar a foto'))), 'image/jpeg', quality),
  )
}

/** Captura o frame atual do vídeo como JPEG. */
export function captureFrame(video: HTMLVideoElement): Promise<Blob> {
  return drawToJpeg(video, video.videoWidth, video.videoHeight)
}

/** Converte uma foto escolhida da galeria em JPEG reduzido (modo teste). */
export function fileToJpeg(file: File): Promise<Blob> {
  return blobToJpeg(file)
}

/** Reduz qualquer imagem (galeria, foto com flash da câmera) para o JPEG que o servidor aceita. */
export async function blobToJpeg(file: Blob): Promise<Blob> {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' })
  try {
    return await drawToJpeg(bmp, bmp.width, bmp.height)
  } finally {
    bmp.close()
  }
}

/** Liberar envio de fotos da galeria (só para testes). */
export const ALLOW_GALLERY = import.meta.env.VITE_ALLOW_GALLERY === 'true'

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

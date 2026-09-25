// Edge Function: registra um descarte (foto + GPS), valida, classifica com o Gemini e dá pontos.
// Deploy: supabase functions deploy register-disposal
// Secrets: supabase secrets set GEMINI_API_KEY=... [GEMINI_MODEL=gemini-2.5-flash]
import { createClient } from 'npm:@supabase/supabase-js@2'
import jpeg from 'npm:jpeg-js@0.4.4'
import { encodeBase64 } from 'jsr:@std/encoding@1/base64'
import {
  REJECT_MESSAGES,
  aiSignature,
  checkAiResult,
  checkPhotoHash,
  checkRateLimits,
  dhashFromGray,
  grayGrid,
  type RecentDisposal,
  type RejectCode,
} from '../_shared/antifraud.ts'
import { classifyImage, DEFAULT_GEMINI_MODEL } from '../_shared/gemini.ts'
import { checkGeofence, localDate } from '../_shared/geo.ts'
import { MATERIAL_INFO } from '../_shared/materials.ts'
import { computePoints, nextStreak } from '../_shared/scoring.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const MAX_IMAGE_BYTES = 3 * 1024 * 1024
// O app sempre envia JPEG (captura da câmera em src/lib/image.ts)
const MIME_TYPES = ['image/jpeg']

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'content-type': 'application/json' } })
}

function fail(code: string, message: string, status = 400, extra: Record<string, unknown> = {}) {
  return json({ status: 'error', code, message, ...extra }, status)
}

function computeDhash(bytes: Uint8Array): string {
  const img = jpeg.decode(bytes, { useTArray: true, formatAsRGBA: true, maxResolutionInMP: 20, maxMemoryUsageInMB: 256 })
  return dhashFromGray(grayGrid(img.data, img.width, img.height))
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return fail('method', 'Use POST', 405)

  const url = Deno.env.get('SUPABASE_URL')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const geminiKey = Deno.env.get('GEMINI_API_KEY')
  if (!geminiKey) return fail('config', 'GEMINI_API_KEY não configurada', 500)

  // 1. Autenticação
  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  })
  const { data: userData, error: userError } = await userClient.auth.getUser()
  if (userError || !userData.user) return fail('auth', 'Faça login novamente', 401)
  const userId = userData.user.id
  const db = createClient(url, serviceKey)

  // 2. Entrada
  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return fail('input', 'Envie multipart/form-data')
  }
  const image = form.get('image')
  const lat = Number(form.get('lat'))
  const lng = Number(form.get('lng'))
  const accuracy = Number(form.get('accuracy'))
  const binId = (form.get('bin_id') as string | null) || null
  if (!(image instanceof File)) return fail('input', 'Foto ausente')
  if (!MIME_TYPES.includes(image.type)) return fail('input', 'Envie a foto em JPEG')
  if (image.size > MAX_IMAGE_BYTES) return fail('input', 'Foto muito grande (máx. 3 MB)')
  if (![lat, lng, accuracy].every(Number.isFinite)) return fail('input', 'Localização inválida')

  const now = new Date()
  const today = localDate(now)

  // 3. Geofence
  const { data: bins, error: binsError } = await db.from('bins').select('id, name, lat, lng, radius_m').eq('active', true)
  if (binsError) return fail('db', binsError.message, 500)
  const geo = checkGeofence(bins ?? [], { lat, lng }, accuracy, binId)
  if (!geo.ok) {
    const nearest = geo.nearest && { name: geo.nearest.bin.name, distance: Math.round(geo.nearest.distance) }
    const message =
      geo.reason === 'imprecise'
        ? `Sinal de GPS fraco (±${Math.round(accuracy)} m). Vá para um lugar mais aberto e tente de novo.`
        : geo.reason === 'no_bins'
          ? 'Nenhuma lixeira cadastrada ainda.'
          : `Você não está em uma lixeira cadastrada${nearest ? ` (mais próxima: ${nearest.name}, ${nearest.distance} m)` : ''}.`
    return fail(geo.reason, message, 422, { nearest })
  }
  const bin = geo.bin

  // 4. Limites de uso
  const since30d = new Date(now.getTime() - 30 * 86400000).toISOString()
  const { data: mineRows, error: mineError } = await db
    .from('disposals')
    .select('user_id, bin_id, dhash, signature, created_at, material, status')
    .eq('user_id', userId)
    .gte('created_at', since30d)
    .order('created_at', { ascending: false })
    .limit(1000)
  if (mineError) return fail('db', mineError.message, 500)
  const mineAll = (mineRows ?? []) as (RecentDisposal & { material: string | null; status: string })[]
  // Limites contam todas as tentativas; duplicidade e pontuação só as válidas.
  const limit = checkRateLimits(mineAll, bin.id, now, today, (d) => localDate(d))
  const mine = mineAll.filter((d) => d.status !== 'rejected')
  if (limit) return fail(limit, REJECT_MESSAGES[limit], 429)

  // 5. Foto repetida (hash perceptual)
  const bytes = new Uint8Array(await image.arrayBuffer())
  let dhash: string
  try {
    dhash = computeDhash(bytes)
  } catch {
    return fail('input', 'Não foi possível ler a imagem')
  }
  const since24h = new Date(now.getTime() - 86400000).toISOString()
  const { data: othersRows } = await db
    .from('disposals')
    .select('user_id, bin_id, dhash, signature, created_at')
    .neq('user_id', userId)
    .gte('created_at', since24h)
    .limit(2000)
  const photo = checkPhotoHash(dhash, mine, (othersRows ?? []) as RecentDisposal[])
  if (photo.reject) return fail(photo.reject, REJECT_MESSAGES[photo.reject], 409)

  // 6. IA
  let ai
  try {
    ai = await classifyImage(geminiKey, encodeBase64(bytes), image.type, Deno.env.get('GEMINI_MODEL') ?? DEFAULT_GEMINI_MODEL)
  } catch (e) {
    console.error(e)
    return fail('ai', 'A IA não respondeu agora. Tente de novo em instantes.', 503)
  }
  const signature = aiSignature(ai)
  const aiCheck = checkAiResult(ai, signature, bin.id, mine, now)

  const { data: season, error: seasonError } = await db.rpc('current_season')
  if (seasonError || !season) return fail('db', seasonError?.message ?? 'Sem temporada', 500)

  // 7. Foto no storage (também para rejeições pós-IA, para auditoria)
  const imagePath = `${userId}/${crypto.randomUUID()}.jpg`
  const { error: uploadError } = await db.storage.from('disposals').upload(imagePath, bytes, { contentType: image.type })
  if (uploadError) return fail('storage', uploadError.message, 500)

  const base = {
    user_id: userId,
    bin_id: bin.id,
    season_id: season.id,
    image_path: imagePath,
    dhash,
    signature,
    ai,
    item_label: ai.item_label,
    material: ai.material,
    lat,
    lng,
    accuracy,
  }

  if (aiCheck.reject) {
    const code: RejectCode = aiCheck.reject
    await db.from('disposals').insert({ ...base, status: 'rejected', points: 0, reason: REJECT_MESSAGES[code] })
    return json({ status: 'rejected', code, message: REJECT_MESSAGES[code], ai })
  }

  // 8. Pontuação
  const { data: profile } = await db.from('profiles').select('xp, streak, last_disposal_date').eq('id', userId).single()
  const todays = mine.filter((d) => localDate(new Date(d.created_at)) === today)
  const { count: binVisits } = await db
    .from('disposals')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('bin_id', bin.id)
    .neq('status', 'rejected')
  const streak = nextStreak(profile?.last_disposal_date ?? null, today, profile?.streak ?? 0)
  const score = computePoints({
    material: ai.material,
    binVisible: ai.bin_visible,
    firstVisitToBin: (binVisits ?? 0) === 0,
    firstOfDay: todays.length === 0,
    streakDays: streak,
    sameMaterialToday: todays.filter((d) => d.material === ai.material).length,
  })

  const needsReview = aiCheck.needsReview || photo.suspicious
  const reasons = [...aiCheck.reasons, ...(photo.suspicious ? ['foto parecida com a de outro usuário'] : [])]
  const status = needsReview ? 'pending' : 'approved'

  const { data: inserted, error: insertError } = await db
    .from('disposals')
    .insert({ ...base, status, points: score.points, breakdown: score.breakdown, reason: reasons.join('; ') || null })
    .select('id')
    .single()
  if (insertError) return fail('db', insertError.message, 500)

  await db
    .from('profiles')
    .update({
      xp: (profile?.xp ?? 0) + (status === 'approved' ? score.points : 0),
      streak,
      last_disposal_date: today,
    })
    .eq('id', userId)

  return json({
    status,
    id: inserted.id,
    points: score.points,
    breakdown: score.breakdown,
    ai,
    bin: { id: bin.id, name: bin.name },
    correctBin: MATERIAL_INFO[ai.material].binLabel,
    streak,
    message: needsReview ? 'Registro enviado para revisão. Os pontos entram quando um admin aprovar.' : undefined,
  })
})

// Edge Function: ações do admin sobre usuários (apagar registros, banir, desbanir, excluir conta).
// Mexe no Auth e no Storage, por isso roda com service role. Só admin chama; nunca age sobre admins.
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

type Action = 'delete_disposals' | 'ban' | 'unban' | 'delete_account'

interface Body {
  action: Action
  user_id?: string | null
  email?: string | null
  reason?: string
  delete_disposals?: boolean
  ban?: boolean
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'content-type': 'application/json' } })
}

/** Apaga fotos (pasta do usuário no bucket) e registros, e zera XP/streak. */
async function wipeDisposals(db: SupabaseClient, userId: string) {
  for (;;) {
    const { data: files, error } = await db.storage.from('disposals').list(userId, { limit: 1000 })
    if (error) throw error
    if (!files?.length) break
    const { error: rmError } = await db.storage.from('disposals').remove(files.map((f) => `${userId}/${f.name}`))
    if (rmError) throw rmError
    if (files.length < 1000) break
  }
  const { error } = await db.from('disposals').delete().eq('user_id', userId)
  if (error) throw error
  await db.from('profiles').update({ xp: 0, streak: 0, last_disposal_date: null }).eq('id', userId)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Use POST' }, 405)

  const url = Deno.env.get('SUPABASE_URL')!
  const db = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const caller = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  })

  const { data: me } = await caller.auth.getUser()
  if (!me.user) return json({ error: 'Faça login novamente' }, 401)
  const { data: myProfile } = await db.from('profiles').select('role').eq('id', me.user.id).single()
  if (myProfile?.role !== 'admin') return json({ error: 'Apenas admin' }, 403)

  const body = (await req.json().catch(() => null)) as Body | null
  if (!body?.action) return json({ error: 'Ação inválida' }, 400)

  try {
    // alvo: pela conta (user_id) ou, para e-mail banido sem conta, pelo e-mail
    let email = body.email?.trim().toLowerCase() ?? null
    const userId = body.user_id ?? null
    if (userId) {
      if (userId === me.user.id) return json({ error: 'Você não pode fazer isso com a sua própria conta.' }, 400)
      const { data: target, error } = await db.auth.admin.getUserById(userId)
      if (error || !target.user) return json({ error: 'Usuário não encontrado' }, 404)
      email = target.user.email?.toLowerCase() ?? null
      const { data: p } = await db.from('profiles').select('role').eq('id', userId).single()
      if (p?.role === 'admin') return json({ error: 'Não é possível agir sobre outro admin.' }, 400)
    }
    const reason = (body.reason ?? '').trim().slice(0, 200) || null

    switch (body.action) {
      case 'delete_disposals': {
        if (!userId) return json({ error: 'Informe o usuário' }, 400)
        await wipeDisposals(db, userId)
        break
      }
      case 'ban': {
        if (!userId || !email) return json({ error: 'Informe o usuário' }, 400)
        await db.from('banned_emails').upsert({ email, reason, banned_by: me.user.id })
        await db.from('profiles').update({ banned_at: new Date().toISOString(), ban_reason: reason }).eq('id', userId)
        const { error } = await db.auth.admin.updateUserById(userId, { ban_duration: '876000h' })
        if (error) throw error
        await db.rpc('admin_kill_sessions', { p_user: userId })
        if (body.delete_disposals) await wipeDisposals(db, userId)
        break
      }
      case 'unban': {
        if (!email) return json({ error: 'Informe o usuário ou e-mail' }, 400)
        await db.from('banned_emails').delete().eq('email', email)
        if (userId) {
          await db.from('profiles').update({ banned_at: null, ban_reason: null }).eq('id', userId)
          const { error } = await db.auth.admin.updateUserById(userId, { ban_duration: 'none' })
          if (error) throw error
        }
        break
      }
      case 'delete_account': {
        if (!userId || !email) return json({ error: 'Informe o usuário' }, 400)
        if (body.ban) await db.from('banned_emails').upsert({ email, reason, banned_by: me.user.id })
        await wipeDisposals(db, userId)
        const { error } = await db.auth.admin.deleteUser(userId) // o perfil sai em cascata
        if (error) throw error
        break
      }
      default:
        return json({ error: 'Ação inválida' }, 400)
    }
    console.log(`admin ${me.user.id}: ${body.action} ${userId ?? email}`)
    return json({ ok: true })
  } catch (e) {
    console.error(e)
    return json({ error: (e as Error).message }, 500)
  }
})

import { useCallback, useEffect, useRef, useState } from 'react'
import { MATERIAL_INFO, MATERIALS } from '../../supabase/functions/_shared/materials.ts'
import { CampusMap } from '../components/CampusMap'
import { Icon } from '../components/PixelArt'
import { api } from '../lib/api'
import type { AdminUser, AdminUserAction, Bin, Disposal, LeaderRow, Material, Season } from '../lib/types'

type Tab = 'bins' | 'review' | 'season' | 'users'

type BinDraft = Omit<Bin, 'id'> & { id?: string }

const emptyDraft = (lat: number, lng: number): BinDraft => ({
  name: '',
  description: '',
  lat,
  lng,
  radius_m: 15,
  accepts: [...MATERIALS],
  active: true,
  photo_url: null,
})

function BinsTab() {
  const [bins, setBins] = useState<Bin[]>([])
  const [draft, setDraft] = useState<BinDraft | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [flyTo, setFlyTo] = useState<{ lat: number; lng: number; key: number } | null>(null)
  const [uploading, setUploading] = useState(false)
  const photoInput = useRef<HTMLInputElement>(null)

  async function uploadPhoto(file: File | undefined) {
    if (!file) return
    setUploading(true)
    setMsg(null)
    try {
      const url = await api.uploadBinPhoto(file)
      setDraft((d) => (d ? { ...d, photo_url: url } : d))
      setMsg('Foto pronta. Toque em SALVAR para guardar.')
    } catch (e) {
      setMsg(`Não foi possível enviar a foto: ${(e as Error).message}`)
    } finally {
      setUploading(false)
    }
  }

  const load = useCallback(() => void api.listAllBins().then(setBins), [])
  useEffect(load, [load])

  function useMyLocation() {
    setMsg('Obtendo localização...')
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setDraft((d) => ({ ...(d ?? emptyDraft(0, 0)), lat: p.coords.latitude, lng: p.coords.longitude }))
        setFlyTo({ lat: p.coords.latitude, lng: p.coords.longitude, key: Date.now() })
        setMsg(`Posição capturada (±${Math.round(p.coords.accuracy)} m). Quanto menor, melhor.`)
      },
      () => setMsg('Não foi possível obter a localização.'),
      { enableHighAccuracy: true, timeout: 20000 },
    )
  }

  async function remove() {
    if (!draft?.id) return
    if (!confirm(`Excluir a lixeira "${draft.name}"? Os descartes já feitos nela continuam no histórico.`)) return
    try {
      await api.deleteBin(draft.id)
      setDraft(null)
      setMsg('Lixeira excluída.')
      load()
    } catch (e) {
      setMsg((e as Error).message)
    }
  }

  function edit(b: Bin) {
    setDraft({ ...b })
    setFlyTo({ lat: b.lat, lng: b.lng, key: Date.now() })
    setMsg('Arraste o pino (ou toque no mapa) para mudar o lugar.')
  }

  async function save() {
    if (!draft || !draft.name.trim()) return setMsg('Dê um nome para a lixeira.')
    try {
      await api.saveBin({ ...draft, name: draft.name.trim() })
      setDraft(null)
      setMsg('Lixeira salva!')
      load()
    } catch (e) {
      setMsg((e as Error).message)
    }
  }

  function toggleMaterial(m: Material) {
    if (!draft) return
    setDraft({ ...draft, accepts: draft.accepts.includes(m) ? draft.accepts.filter((x) => x !== m) : [...draft.accepts, m] })
  }

  return (
    <>
      <p className="muted">
        Toque no mapa para criar uma lixeira. Toque numa lixeira (ou em EDITAR na lista) para editar, mover ou excluir.
      </p>
      <div className="admin-map map-wrap" style={{ position: 'relative', inset: 'auto' }}>
        <CampusMap
          bins={
            draft
              ? draft.id
                ? bins.map((b) => (b.id === draft.id ? ({ ...b, ...draft } as Bin) : b))
                : [...bins, { ...draft, id: '__draft' } as Bin]
              : bins
          }
          selectedId={draft?.id ?? (draft ? '__draft' : null)}
          draggableId={draft ? (draft.id ?? '__draft') : null}
          onBinDrag={(lat, lng) => setDraft((d) => (d ? { ...d, lat, lng } : d))}
          flyTo={flyTo}
          onMapClick={(lat, lng) => setDraft((d) => (d ? { ...d, lat, lng } : emptyDraft(lat, lng)))}
          onBinClick={(b) => b.id !== '__draft' && b.id !== draft?.id && edit(b)}
        />
      </div>
      <div className="row" style={{ marginBottom: 12 }}>
        <button className="btn btn--sm" onClick={useMyLocation}>
          <Icon name="target" size={12} /> USAR MINHA LOCALIZAÇÃO
        </button>
      </div>
      {msg && <p className="muted">{msg}</p>}
      {draft && (
        <div className="card">
          <h2>{draft.id ? 'EDITAR LIXEIRA' : 'NOVA LIXEIRA'}</h2>
          <label className="field">
            <span>NOME</span>
            <input className="input" value={draft.name} maxLength={60} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          </label>
          <label className="field">
            <span>DESCRIÇÃO (OPCIONAL)</span>
            <input className="input" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
          </label>
          <label className="field">
            <span>RAIO DE VALIDAÇÃO: {draft.radius_m} M</span>
            <input
              type="range"
              min={5}
              max={60}
              value={draft.radius_m}
              onChange={(e) => setDraft({ ...draft, radius_m: Number(e.target.value) })}
              style={{ width: '100%' }}
            />
          </label>
          <div className="field">
            <span>ACEITA</span>
            <div className="chips">
              {MATERIALS.map((m) => (
                <button key={m} type="button" className={`chip ${draft.accepts.includes(m) ? 'active' : ''}`} onClick={() => toggleMaterial(m)}>
                  {MATERIAL_INFO[m].label}
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <span>FOTO DO LUGAR (AJUDA O ALUNO A ACHAR A LIXEIRA)</span>
            {draft.photo_url && <img className="bin-photo-preview" src={draft.photo_url} alt="Foto da lixeira" />}
            <div className="row" style={{ gap: 8 }}>
              <button type="button" className="btn btn--sm" disabled={uploading} onClick={() => photoInput.current?.click()}>
                {uploading ? 'ENVIANDO...' : draft.photo_url ? 'TROCAR FOTO' : 'ADICIONAR FOTO'}
              </button>
              {draft.photo_url && (
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => setDraft({ ...draft, photo_url: null })}>
                  REMOVER
                </button>
              )}
            </div>
            <input
              ref={photoInput}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                void uploadPhoto(e.target.files?.[0])
                e.target.value = ''
              }}
            />
          </div>
          <label className="check field">
            <input type="checkbox" checked={draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} />
            Ativa
          </label>
          <p className="muted" style={{ fontSize: 15 }}>
            Local: {draft.lat.toFixed(6)}, {draft.lng.toFixed(6)} (arraste o pino destacado ou use sua localização)
          </p>
          <div className="row">
            <button className="btn btn--ghost btn--sm" onClick={() => setDraft(null)}>
              CANCELAR
            </button>
            {draft.id && (
              <button className="btn btn--red btn--sm" onClick={() => void remove()}>
                EXCLUIR
              </button>
            )}
            <span className="spacer" />
            <button className="btn btn--green btn--sm" onClick={save} disabled={uploading}>
              SALVAR
            </button>
          </div>
        </div>
      )}
      <ul className="history">
        {bins.map((b) => (
          <li key={b.id}>
            <span>
              {b.name}
              <br />
              <small className="muted">raio {b.radius_m} m</small>
            </span>
            <span className="row" style={{ gap: 6 }}>
              <span className={`tag ${b.active ? 'tag--approved' : 'tag--rejected'}`}>{b.active ? 'ATIVA' : 'INATIVA'}</span>
              <button className="btn btn--sm" onClick={() => edit(b)}>
                EDITAR
              </button>
            </span>
          </li>
        ))}
      </ul>
    </>
  )
}

function DisposalCard({ d, actions }: { d: Disposal; actions: React.ReactNode }) {
  return (
    <div className="card review">
      {d.image_url ? <img src={d.image_url} alt={d.item_label} /> : <div className="noimg" />}
      <div>
        <strong>{d.item_label}</strong>
        {d.source === 'gallery' && <span className="tag tag--pending" style={{ marginLeft: 6 }}>GALERIA</span>}
        <div className="muted" style={{ fontSize: 16 }}>
          {d.display_name && `${d.display_name} · `}
          {d.material && MATERIAL_INFO[d.material].label} · {d.points} pts
          {typeof d.ai.confidence === 'number' && ` · conf. ${Math.round(d.ai.confidence * 100)}%`}
        </div>
        {d.reason && <p style={{ fontSize: 16 }}>⚠ {d.reason}</p>}
        <div className="row">{actions}</div>
      </div>
    </div>
  )
}

function ReviewTab() {
  const [items, setItems] = useState<Disposal[] | null>(null)
  const load = useCallback(() => void api.pendingDisposals().then(setItems), [])
  useEffect(load, [load])

  async function review(id: string, approve: boolean) {
    await api.reviewDisposal(id, approve)
    load()
  }

  if (!items) return <p className="muted">Carregando...</p>
  if (items.length === 0) return <p className="muted">Nenhum descarte aguardando revisão. 🎉</p>
  return (
    <>
      {items.map((d) => (
        <DisposalCard
          key={d.id}
          d={d}
          actions={
            <>
              <button className="btn btn--red btn--sm" onClick={() => review(d.id, false)}>
                <Icon name="cross" size={12} /> NEGAR
              </button>
              <button className="btn btn--green btn--sm" onClick={() => review(d.id, true)}>
                <Icon name="check" size={12} /> APROVAR
              </button>
            </>
          }
        />
      ))}
    </>
  )
}

function SeasonTab() {
  const [season, setSeason] = useState<Season | null>(null)
  const [prize, setPrize] = useState('')
  const [top, setTop] = useState<LeaderRow[]>([])
  const [audit, setAudit] = useState<{ user: LeaderRow; items: Disposal[] } | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  const load = useCallback(() => {
    void api.currentSeason().then((s) => {
      setSeason(s)
      setPrize(s.prize)
    })
    void api.leaderboard('season').then((r) => setTop(r.slice(0, 10)))
  }, [])
  useEffect(load, [load])

  async function openAudit(user: LeaderRow) {
    setAudit({ user, items: await api.userSeasonDisposals(user.user_id) })
  }

  async function revoke(id: string) {
    await api.revokeDisposal(id)
    if (audit) await openAudit(audit.user)
    load()
  }

  async function close() {
    if (!season || !confirm(`Fechar ${season.name}? Os 3 primeiros serão registrados como vencedores.`)) return
    try {
      const winners = await api.closeSeason(season.id)
      setMsg(`Temporada fechada! Vencedores: ${winners.map((w) => `${w.pos}º ${w.display_name}`).join(', ')}`)
      load()
    } catch (e) {
      setMsg((e as Error).message)
    }
  }

  if (!season) return <p className="muted">Carregando...</p>
  return (
    <>
      <div className="card">
        <h2>{season.name.toUpperCase()}</h2>
        <p className="muted">
          {new Date(season.starts_at).toLocaleDateString('pt-BR')} a {new Date(season.ends_at).toLocaleDateString('pt-BR')}
          {season.closed && ' · FECHADA'}
        </p>
        <label className="field">
          <span>PRÊMIOS</span>
          <input className="input" value={prize} onChange={(e) => setPrize(e.target.value)} />
        </label>
        <button className="btn btn--sm" onClick={() => void api.updateSeasonPrize(season.id, prize).then(() => setMsg('Prêmios salvos.'))}>
          SALVAR PRÊMIOS
        </button>
      </div>
      <div className="card">
        <h2>AUDITORIA DO TOP 10</h2>
        <p className="muted">Confira as fotos antes de fechar a temporada. Anule registros suspeitos.</p>
        <ol className="rank-list">
          {top.map((r) => (
            <li key={r.user_id} className="rank-row">
              <span className="rank-row__pos">{r.pos}º</span>
              <span className="rank-row__name">
                {r.display_name}
                <small>{r.points} pts</small>
              </span>
              <button className="btn btn--sm" onClick={() => void openAudit(r)}>
                FOTOS
              </button>
            </li>
          ))}
        </ol>
        {audit && (
          <>
            <h3 style={{ marginTop: 12 }}>FOTOS DE {audit.user.display_name.toUpperCase()}</h3>
            {audit.items.length === 0 && <p className="muted">Sem fotos disponíveis.</p>}
            {audit.items.map((d) => (
              <DisposalCard
                key={d.id}
                d={d}
                actions={
                  <button className="btn btn--red btn--sm" onClick={() => void revoke(d.id)}>
                    ANULAR
                  </button>
                }
              />
            ))}
          </>
        )}
      </div>
      <button className="btn btn--red btn--block" onClick={close} disabled={season.closed}>
        FECHAR TEMPORADA
      </button>
      {msg && <p className="muted">{msg}</p>}
    </>
  )
}

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : 'nunca'

type Pending = { kind: 'ban' | 'delete'; user: AdminUser } | null

function UsersTab() {
  const [search, setSearch] = useState('')
  const [users, setUsers] = useState<AdminUser[] | null>(null)
  const [pending, setPending] = useState<Pending>(null)
  const [reason, setReason] = useState('')
  const [alsoWipe, setAlsoWipe] = useState(true)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const load = useCallback(() => {
    api
      .adminListUsers(search.trim())
      .then(setUsers)
      .catch((e: Error) => setMsg(e.message))
  }, [search])
  useEffect(() => {
    const t = setTimeout(load, 250) // espera parar de digitar
    return () => clearTimeout(t)
  }, [load])

  async function run(input: AdminUserAction, done: string) {
    setBusy(true)
    setMsg(null)
    try {
      await api.adminUserAction(input)
      setMsg(done)
      setPending(null)
      setReason('')
      load()
    } catch (e) {
      setMsg((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  function wipe(u: AdminUser) {
    if (!u.id) return
    if (!window.confirm(`Apagar TODOS os registros e fotos de ${u.display_name || u.email}? Os pontos zeram. Não dá para desfazer.`)) return
    void run({ action: 'delete_disposals', user_id: u.id }, 'Registros apagados.')
  }

  function open(kind: 'ban' | 'delete', user: AdminUser) {
    setPending({ kind, user })
    setReason('')
    setAlsoWipe(kind === 'ban')
  }

  const active = users?.filter((u) => u.id && !u.banned_at) ?? []
  const banned = users?.filter((u) => u.banned_at) ?? []

  const card = (u: AdminUser) => (
    <div key={u.id ?? u.email} className="card user-card">
      <div className="user-card__head">
        <div style={{ minWidth: 0 }}>
          <b>{u.display_name || '(conta apagada)'}</b>
          <div className="muted user-card__email">{u.email}</div>
        </div>
        {u.role === 'admin' && <span className="tag tag--approved">ADMIN</span>}
        {u.banned_at && <span className="tag tag--rejected">BANIDO</span>}
      </div>
      {u.id && (
        <div className="muted">
          {u.course || 'sem curso'} · {u.season_points} pts no mês · {u.disposals} registros · último acesso{' '}
          {fmtDate(u.last_sign_in_at)}
        </div>
      )}
      {u.banned_at && (
        <div className="muted">
          Banido em {fmtDate(u.banned_at)}
          {u.ban_reason ? `: ${u.ban_reason}` : ''}
        </div>
      )}

      {pending?.user === u ? (
        <div className="user-card__confirm">
          <input
            className="input"
            placeholder="Motivo (opcional, o usuário vê)"
            value={reason}
            maxLength={200}
            onChange={(e) => setReason(e.target.value)}
          />
          <label className="check">
            <input type="checkbox" checked={alsoWipe} onChange={(e) => setAlsoWipe(e.target.checked)} />
            <span>{pending.kind === 'ban' ? 'Apagar os registros também' : 'Banir o e-mail (não volta nunca mais)'}</span>
          </label>
          <div className="user-card__actions">
            <button
              className="btn btn--red btn--sm"
              disabled={busy}
              onClick={() =>
                u.id &&
                void (pending.kind === 'ban'
                  ? run({ action: 'ban', user_id: u.id, reason, delete_disposals: alsoWipe }, 'Usuário banido.')
                  : run({ action: 'delete_account', user_id: u.id, ban: alsoWipe, reason }, 'Conta excluída.'))
              }
            >
              {busy ? 'AGUARDE...' : pending.kind === 'ban' ? 'CONFIRMAR BANIMENTO' : 'CONFIRMAR EXCLUSÃO'}
            </button>
            <button className="btn btn--ghost btn--sm" onClick={() => setPending(null)}>
              CANCELAR
            </button>
          </div>
        </div>
      ) : (
        u.role !== 'admin' && (
          <div className="user-card__actions">
            {u.banned_at ? (
              <button
                className="btn btn--green btn--sm"
                disabled={busy}
                onClick={() => void run({ action: 'unban', user_id: u.id, email: u.email }, 'Banimento removido.')}
              >
                DESBANIR
              </button>
            ) : (
              <button className="btn btn--red btn--sm" onClick={() => open('ban', u)}>
                BANIR
              </button>
            )}
            {u.id && u.disposals > 0 && (
              <button className="btn btn--ghost btn--sm" disabled={busy} onClick={() => wipe(u)}>
                APAGAR REGISTROS
              </button>
            )}
            {u.id && (
              <button className="btn btn--ghost btn--sm" onClick={() => open('delete', u)}>
                EXCLUIR CONTA
              </button>
            )}
          </div>
        )
      )}
    </div>
  )

  return (
    <>
      <input
        className="input"
        placeholder="Buscar por nome ou e-mail"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ marginBottom: 12 }}
      />
      {msg && <p className="muted">{msg}</p>}
      {!users ? (
        <p className="muted">Carregando...</p>
      ) : (
        <>
          <h2>USUÁRIOS ({active.length})</h2>
          {active.length === 0 && <p className="muted">Ninguém encontrado.</p>}
          {active.map(card)}
          {banned.length > 0 && (
            <>
              <h2 style={{ marginTop: 18 }}>BANIDOS ({banned.length})</h2>
              {banned.map(card)}
            </>
          )}
        </>
      )}
    </>
  )
}

export function Admin() {
  const [tab, setTab] = useState<Tab>('bins')
  return (
    <div className="screen-scroll">
      <h1 style={{ marginTop: 10 }}>PAINEL ADMIN</h1>
      <div className="tabs">
        {(
          [
            ['bins', 'LIXEIRAS'],
            ['review', 'REVISÃO'],
            ['season', 'TEMPORADA'],
            ['users', 'USUÁRIOS'],
          ] as const
        ).map(([id, label]) => (
          <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>
      {tab === 'bins' && <BinsTab />}
      {tab === 'review' && <ReviewTab />}
      {tab === 'season' && <SeasonTab />}
      {tab === 'users' && <UsersTab />}
    </div>
  )
}

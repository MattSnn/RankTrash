import { useEffect, useMemo, useState } from 'react'
import { MATERIAL_INFO, MATERIALS } from '../../supabase/functions/_shared/materials.ts'
import { levelFromXp, xpForLevel } from '../../supabase/functions/_shared/scoring.ts'
import { Mascot } from '../components/Mascot'
import { Icon, type IconName } from '../components/PixelArt'
import { api } from '../lib/api'
import { nameSuggestions } from '../lib/names'
import { reviewReasons } from '../lib/review'
import { useSession } from '../lib/session'
import type { Bin, Disposal, LeaderRow, Material } from '../lib/types'

/** Editar o nome de exibição (aparece no ranking), com sugestões a partir do nome da conta Microsoft. */
function NameEditor({ current, fullName, onDone }: { current: string; fullName?: string; onDone: () => void }) {
  const { refreshProfile } = useSession()
  const [name, setName] = useState(current)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const suggestions = nameSuggestions(fullName)

  async function save() {
    const value = name.trim().slice(0, 40)
    if (value.length < 2) {
      setError('Digite um nome com pelo menos 2 letras.')
      return
    }
    setBusy(true)
    try {
      await api.updateProfile({ display_name: value })
      await refreshProfile()
      onDone()
    } catch (e) {
      setError((e as Error).message)
      setBusy(false)
    }
  }

  return (
    <div className="card">
      <h2>NOME NO RANKING</h2>
      {suggestions.length > 0 && (
        <div className="chips" style={{ marginBottom: 10 }}>
          {suggestions.map((s) => (
            <button key={s} className={`chip ${s === name ? 'active' : ''}`} onClick={() => setName(s)}>
              {s}
            </button>
          ))}
        </div>
      )}
      {suggestions.length === 0 && (
        <input className="input" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} aria-label="Nome" />
      )}
      {error && <p className="error-text">{error}</p>}
      <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
        <button className="btn btn--green" style={{ flex: 1 }} disabled={busy} onClick={() => void save()}>
          {busy ? 'SALVANDO...' : 'SALVAR'}
        </button>
        <button className="btn btn--ghost" style={{ flex: 1 }} onClick={onDone}>
          CANCELAR
        </button>
      </div>
    </div>
  )
}

interface Badge {
  icon: IconName
  name: string
  desc: string
  on: boolean
}

function computeBadges(valid: Disposal[], bins: Bin[], streak: number): Badge[] {
  const count = (m: Material) => valid.filter((d) => d.material === m).length
  const visited = new Set(valid.map((d) => d.bin_id))
  return [
    { icon: 'star', name: 'Primeiro passo', desc: '1º descarte', on: valid.length >= 1 },
    { icon: 'bin', name: 'Caçador de Latinhas', desc: '10 latinhas', on: count('aluminio') >= 10 },
    { icon: 'bin', name: 'Anti-PET', desc: '10 plásticos', on: count('plastico') >= 10 },
    { icon: 'map', name: 'Explorador', desc: 'Todas as lixeiras', on: bins.length > 0 && bins.every((b) => visited.has(b.id)) },
    { icon: 'flame', name: 'Constante', desc: 'Streak de 7 dias', on: streak >= 7 },
    { icon: 'trophy', name: 'Lixo Zero', desc: '100 descartes', on: valid.length >= 100 },
  ]
}

function when(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

const STATUS_LABEL = { approved: 'OK', pending: 'REVISÃO', rejected: 'NEGADO' }

export function Profile() {
  const { profile } = useSession()
  const [editingName, setEditingName] = useState(false)
  const [disposals, setDisposals] = useState<Disposal[]>([])
  const [bins, setBins] = useState<Bin[]>([])
  const [me, setMe] = useState<LeaderRow | null>(null)

  useEffect(() => {
    void api.myDisposals(500).then(setDisposals)
    void api.listBins().then(setBins)
    void api.leaderboard('season').then((rows) => setMe(rows.find((r) => r.user_id === profile?.id) ?? null))
  }, [profile?.id])

  const valid = useMemo(() => disposals.filter((d) => d.status === 'approved'), [disposals])
  const byMaterial = useMemo(() => {
    const m = new Map<Material, number>()
    valid.forEach((d) => d.material && m.set(d.material, (m.get(d.material) ?? 0) + 1))
    return m
  }, [valid])
  const kg = valid.reduce((s, d) => s + (d.material ? MATERIAL_INFO[d.material].kgPerItem : 0), 0)

  if (!profile) return null
  const level = levelFromXp(profile.xp)
  const cur = xpForLevel(level)
  const next = xpForLevel(level + 1)
  const pct = Math.round(((profile.xp - cur) / (next - cur)) * 100)
  const badges = computeBadges(valid, bins, profile.streak)

  return (
    <div className="screen-scroll">
      <div className="card" style={{ marginTop: 10 }}>
        <div className="profile-head">
          <Mascot size={72} mood="happy" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ marginBottom: 4 }}>{profile.display_name}</h1>
            {!editingName && (
              <button className="btn btn--ghost btn--sm" style={{ marginBottom: 6 }} onClick={() => setEditingName(true)}>
                EDITAR NOME
              </button>
            )}
            <div className="muted">{profile.course}</div>
            <div className="title-font" style={{ fontSize: 9, marginTop: 8 }}>
              NÍVEL {level}
            </div>
            <div className="xpbar">
              <div style={{ width: `${pct}%` }} />
            </div>
            <div className="muted" style={{ fontSize: 15 }}>
              {profile.xp} / {next} XP
            </div>
          </div>
        </div>
      </div>

      {editingName && (
        <NameEditor current={profile.display_name} fullName={profile.full_name} onDone={() => setEditingName(false)} />
      )}

      <div className="stats" style={{ marginBottom: 14 }}>
        <div className="stat">
          <b>{me?.points ?? 0}</b>
          <span>pts no mês</span>
        </div>
        <div className="stat">
          <b>{me ? `${me.pos}º` : '-'}</b>
          <span>no ranking</span>
        </div>
        <div className="stat">
          <b style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8 }}>
            <span style={{ color: 'var(--orange)', display: 'inline-flex' }}>
              <Icon name="flame" size={14} />
            </span>
            {profile.streak}
          </b>
          <span>dias seguidos</span>
        </div>
      </div>

      <div className="card">
        <h2>IMPACTO</h2>
        <p>
          <b style={{ color: 'var(--green-light)' }}>{valid.length}</b> itens descartados corretamente ≈{' '}
          <b style={{ color: 'var(--green-light)' }}>{kg.toFixed(2)} kg</b> desviados do aterro.
        </p>
        <div className="materials">
          {MATERIALS.filter((m) => byMaterial.has(m)).map((m) => (
            <div key={m}>
              <i style={{ background: MATERIAL_INFO[m].binColor }} />
              {MATERIAL_INFO[m].label}: {byMaterial.get(m)}
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <h2>CONQUISTAS</h2>
        <div className="badges">
          {badges.map((b) => (
            <div key={b.name} className={`badge ${b.on ? 'on' : ''}`} title={b.desc}>
              <Icon name={b.icon} size={26} />
              {b.name}
              <div className="muted" style={{ fontSize: 13 }}>
                {b.desc}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <h2>HISTÓRICO</h2>
        {disposals.length === 0 ? (
          <p className="muted">Nenhum descarte ainda.</p>
        ) : (
          <ul className="history">
            {disposals.slice(0, 30).map((d) => (
              <li key={d.id}>
                <span>
                  {d.item_label || 'Item'}
                  <br />
                  <small className="muted">
                    {when(d.created_at)}
                    {d.status === 'rejected' && d.reason ? ` · ${d.reason}` : ''}
                    {d.status === 'pending' && ` · Aguardando revisão${d.reason ? `: ${reviewReasons(d.reason).join(' ')}` : ''}`}
                  </small>
                </span>
                <span style={{ textAlign: 'right' }}>
                  <span className={`tag tag--${d.status}`}>{STATUS_LABEL[d.status]}</span>
                  <br />
                  {d.points > 0 && `+${d.points}`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <button className="btn btn--ghost btn--block" onClick={() => void api.signOut()}>
        SAIR
      </button>
    </div>
  )
}

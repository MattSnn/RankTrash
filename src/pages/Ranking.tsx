import { useEffect, useState } from 'react'
import { LoadingBar } from '../components/Layout'
import { Icon } from '../components/PixelArt'
import { api } from '../lib/api'
import { useSession } from '../lib/session'
import type { CourseRow, LeaderRow, Season } from '../lib/types'

type Tab = 'season' | 'course' | 'week'

function timeLeft(end: string): string {
  const ms = Date.parse(end) - Date.now()
  if (ms <= 0) return 'encerrada'
  const d = Math.floor(ms / 86400000)
  const h = Math.floor((ms % 86400000) / 3600000)
  return `termina em ${d}d ${h}h`
}

const PODIUM = [
  { idx: 1, h: 64, color: '#c7d3e0' },
  { idx: 0, h: 88, color: '#f5c518' },
  { idx: 2, h: 48, color: '#d98b4a' },
]

export function Ranking() {
  const { profile } = useSession()
  const [tab, setTab] = useState<Tab>('season')
  const [rows, setRows] = useState<LeaderRow[] | null>(null)
  const [courses, setCourses] = useState<CourseRow[] | null>(null)
  const [season, setSeason] = useState<Season | null>(null)

  useEffect(() => {
    void api.currentSeason().then(setSeason)
  }, [])

  useEffect(() => {
    let active = true
    if (tab === 'course') {
      setCourses(null)
      void api.courseLeaderboard().then((c) => active && setCourses(c))
    } else {
      setRows(null)
      void api.leaderboard(tab).then((r) => active && setRows(r))
    }
    return () => {
      active = false
    }
  }, [tab])

  const list =
    tab === 'course'
      ? courses?.map((c) => ({ key: c.course, pos: c.pos, name: c.course, sub: `${c.players} jogadores`, points: c.points, me: c.course === profile?.course }))
      : rows?.map((r) => ({ key: r.user_id, pos: r.pos, name: r.display_name, sub: r.course, points: r.points, me: r.user_id === profile?.id }))
  const myRow = list?.find((r) => r.me)

  return (
    <div className="screen-scroll">
      <div className="row" style={{ marginTop: 8, marginBottom: 12, flexWrap: 'nowrap' }}>
        <Icon name="trophy" size={22} />
        <div>
          <h1 style={{ margin: 0 }}>RANKING</h1>
          {season && (
            <span className="muted">
              {season.name} · {timeLeft(season.ends_at)}
            </span>
          )}
        </div>
      </div>

      {season?.prize && tab === 'season' && (
        <div className="banner" style={{ marginBottom: 16, fontSize: 9, textAlign: 'left' }}>
          PRÊMIOS DO MÊS: <span style={{ fontFamily: 'var(--font-body)', fontSize: 17 }}>{season.prize}</span>
        </div>
      )}

      <div className="tabs" role="tablist">
        {(
          [
            ['season', 'MÊS'],
            ['course', 'CURSOS'],
            ['week', '7 DIAS'],
          ] as const
        ).map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>

      {!list ? (
        <LoadingBar />
      ) : list.length === 0 ? (
        <p className="muted" style={{ textAlign: 'center' }}>
          Ninguém pontuou ainda. Seja o primeiro!
        </p>
      ) : (
        <>
          {list.length >= 3 && (
            <div className="podium">
              {PODIUM.map(({ idx, h, color }) => {
                const r = list[idx]
                return (
                  <div key={r.key} className="podium__col">
                    <span className="podium__name">{r.name}</span>
                    <div className="podium__block" style={{ height: h, background: color }}>
                      {r.pos}º<small>{r.points} PTS</small>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
          {myRow && (
            <p className="muted" style={{ textAlign: 'center' }}>
              {tab === 'course' ? 'Seu curso' : 'Você'} está em <b style={{ color: 'var(--cream)' }}>{myRow.pos}º</b> com {myRow.points} pts
            </p>
          )}
          <ol className="rank-list">
            {list.map((r) => (
              <li key={r.key} className={`rank-row ${r.me ? 'me' : ''}`}>
                <span className="rank-row__pos">{r.pos}º</span>
                <span className="rank-row__name">
                  {r.name}
                  <small>{r.sub}</small>
                </span>
                <span className="rank-row__pts">{r.points}</span>
              </li>
            ))}
          </ol>
        </>
      )}
    </div>
  )
}

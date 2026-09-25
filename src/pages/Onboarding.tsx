import { useState, type FormEvent } from 'react'
import { Mascot } from '../components/Mascot'
import { api } from '../lib/api'
import { COURSES } from '../lib/campus'
import { nameSuggestions } from '../lib/names'
import { useSession } from '../lib/session'

export function Onboarding() {
  const { profile, refreshProfile } = useSession()
  const suggestions = nameSuggestions(profile?.full_name)
  const current = profile?.display_name ?? ''
  const [name, setName] = useState(suggestions.length === 0 || suggestions.includes(current) ? current : suggestions[0])
  // Nome real: só as combinações do nome da conta Microsoft. Campo livre só se a conta não trouxer nome.
  const custom = suggestions.length === 0
  const [course, setCourse] = useState(profile?.course ?? '')
  const [consent, setConsent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await api.updateProfile({ display_name: name.trim().slice(0, 40), course, consent_at: new Date().toISOString() })
      await refreshProfile()
    } catch (err) {
      setError((err as Error).message)
      setBusy(false)
    }
  }

  return (
    <div className="app">
      <div className="bezel" style={{ marginBottom: 16 }}>
        <main className="screen">
          <div className="screen-scroll">
            <div className="center-screen">
              <Mascot size={90} mood="happy" />
              <h1>CRIE SEU JOGADOR</h1>
              <form onSubmit={submit}>
                <div className="field">
                  <span>COMO QUER SER CHAMADO?</span>
                  {suggestions.length > 0 && (
                    <div className="chips" style={{ margin: '6px 0 8px' }}>
                      {suggestions.map((s) => (
                        <button
                          type="button"
                          key={s}
                          className={`chip ${s === name ? 'active' : ''}`}
                          onClick={() => setName(s)}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  )}
                  {custom && (
                    <input
                      className="input"
                      value={name}
                      maxLength={40}
                      placeholder="Seu nome no ranking"
                      onChange={(e) => setName(e.target.value)}
                      required
                    />
                  )}
                  <small className="muted">
                    Escolha como seu nome aparece no ranking (sempre o nome real). Dá para trocar depois no Perfil.
                  </small>
                </div>
                <label className="field">
                  <span>CURSO</span>
                  <select className="input" value={course} onChange={(e) => setCourse(e.target.value)} required>
                    <option value="" disabled>
                      Selecione...
                    </option>
                    {COURSES.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </label>
                <label className="check field">
                  <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} required />
                  <span style={{ fontFamily: 'var(--font-body)', fontSize: 17, color: 'var(--text)' }}>
                    Autorizo o uso da minha localização (só no momento do registro) e das fotos dos resíduos para validar
                    descartes. As fotos são analisadas por IA (Google Gemini) e apagadas após 60 dias. Meu nome e curso
                    aparecem no ranking.
                  </span>
                </label>
                <button className="btn btn--green btn--block" disabled={busy || !consent || !name.trim()}>
                  {busy ? 'SALVANDO...' : 'COMEÇAR A JOGAR'}
                </button>
                {error && <p className="error-text">{error}</p>}
              </form>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

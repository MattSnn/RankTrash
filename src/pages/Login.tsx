import { useState, type FormEvent } from 'react'
import { Mascot } from '../components/Mascot'
import { allowedDomains, api, isAllowedEmail } from '../lib/api'
import { play } from '../lib/sfx'

export function Login() {
  const [email, setEmail] = useState(api.demo ? 'voce@facens.br' : '')
  const [code, setCode] = useState('')
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function sendCode(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!isAllowedEmail(email)) {
      setError(`Use seu e-mail institucional (@${allowedDomains.join(', @')}).`)
      return
    }
    setBusy(true)
    try {
      await api.sendLoginCode(email.trim().toLowerCase())
      setStep('code')
      play('click')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function verify(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await api.verifyLoginCode(email.trim().toLowerCase(), code.trim())
      play('success')
    } catch {
      setError('Código inválido ou expirado.')
      play('fail')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="app">
      <div className="bezel" style={{ marginBottom: 16 }}>
        <main className="screen">
          <div className="screen-scroll">
            <div className="center-screen">
              <Mascot size={110} mood="idle" />
              <h1>RANKTRASH</h1>
              <p className="title-font" style={{ fontSize: 9, lineHeight: 1.8 }}>
                BEM-VINDO AO TRACKER DO LIXO ZERO.
                <br />
                DESCARTE CERTO, GANHE PONTOS
                <br />E SUBA NO RANKING DA FACENS.
              </p>
              {step === 'email' ? (
                <form onSubmit={sendCode}>
                  <label className="field">
                    <span>E-MAIL INSTITUCIONAL</span>
                    <input
                      className="input"
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      placeholder={`nome@${allowedDomains[0] ?? 'facens.br'}`}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </label>
                  <button className="btn btn--orange btn--block" disabled={busy}>
                    {busy ? 'ENVIANDO...' : 'RECEBER CÓDIGO'}
                  </button>
                </form>
              ) : (
                <form onSubmit={verify}>
                  <p className="muted">
                    Enviamos um e-mail para {email}. Digite o código ou toque no link do e-mail.
                    {api.demo && ' (demo: qualquer código)'}
                  </p>
                  <label className="field">
                    <span>CÓDIGO</span>
                    <input
                      className="input"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={10}
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      required
                      autoFocus
                    />
                  </label>
                  <button className="btn btn--green btn--block" disabled={busy}>
                    {busy ? 'VERIFICANDO...' : 'ENTRAR'}
                  </button>
                  <button type="button" className="btn btn--ghost btn--block" style={{ marginTop: 14 }} onClick={() => setStep('email')}>
                    TROCAR E-MAIL
                  </button>
                </form>
              )}
              {error && <p className="error-text">{error}</p>}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

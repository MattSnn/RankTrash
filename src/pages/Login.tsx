import { useEffect, useState } from 'react'
import { InstallBanner } from '../components/InstallPrompt'
import { Mascot } from '../components/Mascot'
import { api } from '../lib/api'
import { play } from '../lib/sfx'

/** Logo da Microsoft (4 quadrados), no estilo pixel. */
function MicrosoftLogo() {
  const colors = ['#f25022', '#7fba00', '#00a4ef', '#ffb900']
  return (
    <span className="ms-logo" aria-hidden>
      {colors.map((c) => (
        <i key={c} style={{ background: c }} />
      ))}
    </span>
  )
}

/** Erro devolvido pelo Supabase/Microsoft na URL de retorno (ex.: e-mail fora do domínio). */
function readReturnError(): string | null {
  const params = new URLSearchParams(window.location.search + '&' + window.location.hash.replace(/^#/, ''))
  const raw = params.get('error_description') ?? params.get('error')
  if (!raw) return null
  window.history.replaceState(null, '', window.location.pathname)
  if (/dom[ií]nio permitido/i.test(raw)) return 'Use sua conta @facens.br. Contas de fora da Facens não podem entrar.'
  if (/consent|admin/i.test(raw)) return 'A Facens precisa liberar o RankTrash na conta Microsoft. Avise a organização da campanha.'
  return `Não foi possível entrar (${raw.slice(0, 120)}).`
}

export function Login() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const e = readReturnError()
    if (e) {
      setError(e)
      play('fail')
    }
  }, [])

  async function signIn() {
    setError(null)
    setBusy(true)
    play('click')
    try {
      await api.signInWithMicrosoft() // sai do app para a Microsoft e volta logado
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
              <Mascot size={110} mood="idle" />
              <h1>RANKTRASH</h1>
              <p className="title-font" style={{ fontSize: 9, lineHeight: 1.8 }}>
                BEM-VINDO AO TRACKER DO LIXO ZERO.
                <br />
                DESCARTE CERTO, GANHE PONTOS
                <br />E SUBA NO RANKING DA FACENS.
              </p>
              <button className="btn btn--orange btn--block btn--ms" onClick={() => void signIn()} disabled={busy}>
                <MicrosoftLogo />
                {busy ? 'ABRINDO...' : 'ENTRAR COM CONTA FACENS'}
              </button>
              <p className="muted" style={{ marginTop: 12 }}>
                Use sua conta Microsoft da Facens (e-mail @facens.br).
              </p>
              {error && <p className="error-text">{error}</p>}
            </div>
          </div>
        </main>
      </div>
      <InstallBanner />
    </div>
  )
}

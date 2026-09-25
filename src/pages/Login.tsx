import { useCallback, useEffect, useState } from 'react'
import { InstallBanner } from '../components/InstallPrompt'
import { Mascot } from '../components/Mascot'
import { PublicShell } from '../components/PublicShell'
import { api } from '../lib/api'
import { detectPlatform, isStandalone } from '../lib/pwa'
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

export function loginErrorMessage(raw: string): string {
  if (/dom[ií]nio permitido/i.test(raw)) return 'Use sua conta @facens.br. Contas de fora da Facens não podem entrar.'
  if (/consent|admin/i.test(raw)) return 'A Facens precisa liberar o RankTrash na conta Microsoft. Avise a organização da campanha.'
  return `Não foi possível entrar (${raw.slice(0, 120)}).`
}

/** Erro devolvido pelo Supabase/Microsoft na URL de retorno (ex.: e-mail fora do domínio). */
function readReturnError(): string | null {
  const params = new URLSearchParams(window.location.search + '&' + window.location.hash.replace(/^#/, ''))
  const raw = params.get('error_description') ?? params.get('error')
  if (!raw) return null
  window.history.replaceState(null, '', window.location.pathname)
  return loginErrorMessage(raw)
}

/**
 * No iPhone, o app instalado não compartilha login com o Safari. Então o login acontece no Safari "de verdade":
 * lá o aluno vê o endereço da Microsoft e pode já estar logado, e depois volta ao app com a sessão.
 */
const USE_SAFARI = !api.demo && isStandalone() && detectPlatform() === 'ios'

function openInSafari(url: string) {
  // x-safari-https:// abre o Safari do sistema (iOS 17+); se não abrir, cai na janela do próprio iOS
  window.location.href = url.replace(/^https:/, 'x-safari-https:')
  setTimeout(() => {
    if (document.visibilityState === 'visible') window.open(url, '_blank')
  }, 1200)
}

export function Login() {
  const [busy, setBusy] = useState(false)
  const [waiting, setWaiting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const e = readReturnError()
    if (e) {
      setError(e)
      play('fail')
    }
  }, [])

  const claim = useCallback(async () => {
    try {
      if (await api.claimExternalLogin()) play('success') // a sessão muda e o app sai desta tela
    } catch (err) {
      setWaiting(false)
      setError((err as Error).message)
    }
  }, [])

  // esperando o login no Safari: confere ao voltar para o app e, enquanto isso, a cada 2,5 s
  useEffect(() => {
    if (!USE_SAFARI) return
    void claim() // pedido de antes (ex.: o app foi fechado enquanto o aluno entrava no Safari)
    if (!waiting) return
    const t = setInterval(() => void claim(), 2500)
    const onVisible = () => document.visibilityState === 'visible' && void claim()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(t)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [waiting, claim])

  async function signIn() {
    setError(null)
    setBusy(true)
    play('click')
    try {
      if (USE_SAFARI) {
        openInSafari(await api.startExternalLogin())
        setWaiting(true)
        setBusy(false)
      } else {
        await api.signInWithMicrosoft() // sai do app para a Microsoft e volta logado
      }
    } catch (err) {
      setError((err as Error).message)
      setBusy(false)
    }
  }

  function cancel() {
    api.cancelExternalLogin()
    setWaiting(false)
  }

  return (
    <>
      <PublicShell>
        <div className="center-screen">
          <Mascot size={110} mood={waiting ? 'scan' : 'idle'} />
          <h1>RANKTRASH</h1>
          {waiting ? (
            <>
              <p className="title-font" style={{ fontSize: 9, lineHeight: 1.8 }}>
                CONTINUE NO SAFARI.
                <br />
                DEPOIS É SÓ VOLTAR PARA CÁ.
              </p>
              <div className="loading-bar" style={{ margin: '16px auto' }}>
                {Array.from({ length: 6 }, (_, i) => (
                  <i key={i} />
                ))}
              </div>
              <button className="btn btn--orange btn--block" onClick={() => void signIn()}>
                ABRIR O SAFARI DE NOVO
              </button>
              <button className="btn btn--ghost btn--block" style={{ marginTop: 12 }} onClick={cancel}>
                CANCELAR
              </button>
            </>
          ) : (
            <>
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
              <div className="login-trust">
                <p>
                  🔒 O login é feito na <b>página oficial da Microsoft</b> ({USE_SAFARI ? 'no Safari' : 'login.microsoftonline.com'}
                  ). Sua senha não passa pelo RankTrash.
                </p>
                <p>
                  Recebemos só seu <b>nome e e-mail @facens.br</b>.{' '}
                  <a href="/privacidade" target="_blank" rel="noreferrer">
                    Privacidade
                  </a>
                </p>
              </div>
            </>
          )}
          {error && <p className="error-text">{error}</p>}
        </div>
      </PublicShell>
      <InstallBanner />
    </>
  )
}

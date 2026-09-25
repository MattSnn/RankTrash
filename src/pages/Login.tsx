import { useEffect, useState, type FormEvent } from 'react'
import { InstallBanner } from '../components/InstallPrompt'
import { Mascot } from '../components/Mascot'
import { PublicShell } from '../components/PublicShell'
import { api } from '../lib/api'
import { detectPlatform, isStandalone } from '../lib/pwa'
import { LOGIN_NOTICE_KEY } from '../lib/session'
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

/**
 * O retorno da Microsoft às vezes chega duas vezes (toque duplo, navegador repetindo a requisição):
 * o 1º dá certo e o 2º volta com este erro. Não é erro do aluno: basta refazer o login (a Microsoft já está logada).
 */
export function isDuplicateCallback(raw: string): boolean {
  return /state has already been used|already redeemed|flow state/i.test(raw)
}

/** Refaz o login no máximo 2 vezes por aba para não entrar em loop. */
export function allowDuplicateRetry(key: string): boolean {
  try {
    const n = Number(sessionStorage.getItem(key) ?? '0')
    if (n >= 2) return false
    sessionStorage.setItem(key, String(n + 1))
    return true
  } catch {
    return false
  }
}

export function loginErrorMessage(raw: string): string {
  if (/banid/i.test(raw)) return 'Esta conta foi banida do RankTrash.'
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
  if (isDuplicateCallback(raw) && allowDuplicateRetry('ranktrash:dup-retry')) {
    void api.signInWithMicrosoft() // refaz sozinho; volta logado sem pedir senha
    return null
  }
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
  // esperando o código do Safari (também ao reabrir o app com um pedido pendente)
  const [waiting, setWaiting] = useState(() => USE_SAFARI && api.hasPendingExternalLogin())
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let notice: string | null = null
    try {
      notice = sessionStorage.getItem(LOGIN_NOTICE_KEY)
      sessionStorage.removeItem(LOGIN_NOTICE_KEY)
    } catch {
      /* sem storage */
    }
    const e = readReturnError() ?? notice
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
      if (USE_SAFARI) {
        openInSafari(await api.startExternalLogin())
        setCode('')
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

  async function confirm(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const result = await api.claimExternalLogin(code.trim())
      if (result === 'ok') {
        play('success') // a sessão muda e o app sai desta tela
        return
      }
      play('fail')
      if (result === 'wrong') setError('Código errado. Confira o que aparece no Safari.')
      if (result === 'pending') setError('Termine de entrar no Safari primeiro. O código aparece lá no fim.')
      if (result === 'expired') {
        setWaiting(false)
        setError('O pedido expirou. Toque em entrar de novo.')
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  function cancel() {
    api.cancelExternalLogin()
    setWaiting(false)
    setError(null)
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
                ENTRE PELO SAFARI E DIGITE AQUI
                <br />O CÓDIGO QUE APARECER LÁ.
              </p>
              <form onSubmit={(e) => void confirm(e)} style={{ width: '100%' }}>
                <input
                  className="input handoff-input"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]*"
                  maxLength={4}
                  placeholder="0000"
                  aria-label="Código de 4 dígitos"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
                />
                <button className="btn btn--green btn--block" disabled={busy || code.length !== 4}>
                  {busy ? 'CONFERINDO...' : 'ENTRAR'}
                </button>
              </form>
              <button className="btn btn--ghost btn--block" style={{ marginTop: 14 }} onClick={() => void signIn()}>
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

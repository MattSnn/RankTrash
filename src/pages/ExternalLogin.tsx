import { useEffect, useRef, useState } from 'react'
import { Mascot } from '../components/Mascot'
import { PublicShell } from '../components/PublicShell'
import { api } from '../lib/api'
import { play } from '../lib/sfx'
import { loginErrorMessage } from './Login'

type State = { kind: 'working' } | { kind: 'done'; code: string } | { kind: 'error'; message: string }

/** /entrar?h=<pedido>: aberta no Safari pelo app instalado. Leva à Microsoft e entrega a sessão ao app. */
export function ExternalLogin() {
  const [state, setState] = useState<State>({ kind: 'working' })
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return // StrictMode roda efeitos 2x; o código da Microsoft só pode ser trocado uma vez
    started.current = true
    const params = new URLSearchParams(window.location.search)
    const handoff = params.get('h')
    const returned = params.get('error_description') ?? params.get('error')
    if (returned) {
      setState({ kind: 'error', message: loginErrorMessage(returned) })
      return
    }
    if (!handoff) {
      setState({ kind: 'error', message: 'Link de login inválido. Volte ao app e toque em entrar.' })
      return
    }
    api
      .completeExternalLogin(handoff)
      .then((r) => {
        if (r.kind === 'done') {
          setState(r)
          play('success')
        }
      })
      .catch((e: Error) => setState({ kind: 'error', message: e.message }))
  }, [])

  return (
    <PublicShell>
      <div className="center-screen">
        <Mascot size={110} mood={state.kind === 'done' ? 'happy' : state.kind === 'error' ? 'sad' : 'idle'} />
        {state.kind === 'working' && (
          <>
            <h1>ENTRANDO...</h1>
            <p className="muted">Abrindo a página oficial da Microsoft.</p>
          </>
        )}
        {state.kind === 'done' && (
          <>
            <h1>PRONTO!</h1>
            <p className="title-font" style={{ fontSize: 10, lineHeight: 1.8 }}>
              VOLTE PARA O APP RANKTRASH E DIGITE O CÓDIGO:
            </p>
            <p className="handoff-code" aria-label={`Código ${state.code.split('').join(' ')}`}>
              {state.code}
            </p>
            <p className="muted">
              Vale por 10 minutos. Não passe este código para ninguém: ele entra na sua conta.
            </p>
          </>
        )}
        {state.kind === 'error' && (
          <>
            <h1>OPS</h1>
            <p className="error-text">{state.message}</p>
          </>
        )}
      </div>
    </PublicShell>
  )
}

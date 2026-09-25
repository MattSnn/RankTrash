import { Mascot } from '../components/Mascot'
import { PublicShell } from '../components/PublicShell'
import { api } from '../lib/api'

/** Perfil não carregou (ex.: sem internet): tentar de novo ou sair, em vez de carregar para sempre. */
export function ProfileError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <PublicShell>
      <div className="center-screen">
        <Mascot size={110} mood="sad" />
        <h1>OPS</h1>
        <p>Não conseguimos carregar seu perfil. Confira a internet e tente de novo.</p>
        <p className="muted">{message}</p>
        <button className="btn btn--orange btn--block" onClick={onRetry}>
          TENTAR DE NOVO
        </button>
        <button className="btn btn--ghost btn--block" style={{ marginTop: 12 }} onClick={() => void api.signOut()}>
          SAIR
        </button>
      </div>
    </PublicShell>
  )
}

/** Conta banida pelo admin: o app fica só com esta tela. */
export function Suspended({ reason }: { reason: string | null }) {
  return (
    <PublicShell>
      <div className="center-screen">
        <Mascot size={110} mood="sad" />
        <h1>CONTA SUSPENSA</h1>
        <p>Sua conta foi suspensa pela organização da campanha Lixo Zero e não pode mais registrar descartes.</p>
        {reason && <p className="error-text">Motivo: {reason}</p>}
        <p className="muted">Se achar que foi um engano, fale com a organização da campanha.</p>
        <button className="btn btn--ghost btn--block" onClick={() => void api.signOut()}>
          SAIR
        </button>
      </div>
    </PublicShell>
  )
}

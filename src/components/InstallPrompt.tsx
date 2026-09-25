import type { ReactNode } from 'react'
import { detectPlatform, dismissInstallGate, isIosSafari, openInstallGate, promptInstall, usePwaInstall } from '../lib/pwa'
import { play } from '../lib/sfx'
import { Mascot } from './Mascot'
import { Icon, type IconName } from './PixelArt'

function Step({ n, icon, children }: { n: number; icon: IconName; children: ReactNode }) {
  return (
    <li className="install-step">
      <span className="install-step__n">{n}</span>
      <span className="install-step__icon">
        <Icon name={icon} size={22} />
      </span>
      <span>{children}</span>
    </li>
  )
}

function IosSteps() {
  if (!isIosSafari()) {
    return (
      <>
        <p>
          No iPhone, o jeito mais garantido é pelo <b>Safari</b>. Copie o endereço e abra lá:
        </p>
        <p className="install-url">{window.location.host}</p>
        <ol className="install-steps">
          <Step n={1} icon="share">
            Se o seu navegador tiver o botão <b>Compartilhar</b>, toque nele.
          </Step>
          <Step n={2} icon="addBox">
            Escolha <b>Adicionar à Tela de Início</b>.
          </Step>
        </ol>
      </>
    )
  }
  return (
    <ol className="install-steps">
      <Step n={1} icon="share">
        Toque em <b>Compartilhar</b> na barra do Safari (ou em <b>⋯</b> e depois <b>Compartilhar</b>).
      </Step>
      <Step n={2} icon="addBox">
        Role a lista e toque em <b>Adicionar à Tela de Início</b>.
      </Step>
      <Step n={3} icon="phone">
        Deixe <b>Abrir como App Web</b> ligado, toque em <b>Adicionar</b> e abra o RankTrash pelo ícone.
      </Step>
    </ol>
  )
}

function AndroidSteps() {
  return (
    <ol className="install-steps">
      <Step n={1} icon="dots">
        Toque no menu <b>⋮</b> do navegador (canto superior direito).
      </Step>
      <Step n={2} icon="addBox">
        Escolha <b>Instalar app</b> ou <b>Adicionar à tela inicial</b>.
      </Step>
      <Step n={3} icon="phone">
        Abra o RankTrash pelo ícone na tela inicial.
      </Step>
    </ol>
  )
}

/** Tela cheia pedindo para instalar o app. Volta toda vez que o site é aberto no navegador do celular. */
export function InstallGate() {
  const { installed, gateOpen, canPrompt } = usePwaInstall()
  if (installed || !gateOpen) return null
  const platform = detectPlatform()

  async function install() {
    play('click')
    await promptInstall()
  }

  return (
    <div className="install-gate" role="dialog" aria-modal="true" aria-labelledby="install-title">
      <div className="install-card">
        <Mascot size={84} mood="happy" />
        <h1 id="install-title">INSTALE O RANKTRASH</h1>
        <p>
          Use como app: abre em tela cheia, fica na tela inicial e <b>o login acontece dentro do app</b>.
        </p>
        {canPrompt ? (
          <button className="btn btn--green btn--block install-cta" onClick={() => void install()}>
            <Icon name="addBox" size={16} /> INSTALAR APP
          </button>
        ) : platform === 'ios' ? (
          <IosSteps />
        ) : (
          <AndroidSteps />
        )}
        <button className="btn btn--ghost btn--block" style={{ marginTop: 16 }} onClick={dismissInstallGate}>
          AGORA NÃO
        </button>
      </div>
      {platform === 'ios' && isIosSafari() && !canPrompt && (
        <div className="install-arrow" aria-hidden>
          ▼
        </div>
      )}
    </div>
  )
}

/** Faixa fixa lembrando de instalar, enquanto o app roda no navegador. */
export function InstallBanner() {
  const { installed, canPrompt } = usePwaInstall()
  if (installed) return null
  if (detectPlatform() === 'desktop' && !canPrompt) return null
  return (
    <button className="install-banner" onClick={() => (canPrompt ? void promptInstall() : openInstallGate())}>
      <Icon name="addBox" size={14} /> INSTALE O APP NO CELULAR &gt;
    </button>
  )
}

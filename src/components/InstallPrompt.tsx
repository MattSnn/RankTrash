import type { ReactNode } from 'react'
import { detectPlatform, dismissInstallGate, isIosSafari, openInstallGate, openWelcomeGate, promptInstall, usePwaInstall } from '../lib/pwa'
import { landingUrl } from '../lib/site'
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

function DesktopSteps() {
  return (
    <>
      <p>O RankTrash é feito para o celular, mas também dá para instalar no computador:</p>
      <ol className="install-steps">
        <Step n={1} icon="dots">
          No Chrome ou Edge, clique no ícone de <b>instalar</b> na barra de endereço ou em <b>⋮</b> e depois{' '}
          <b>Instalar RankTrash</b>.
        </Step>
        <Step n={2} icon="phone">
          Para o celular, abra <b>{window.location.host}</b> nele e instale por lá.
        </Step>
      </ol>
    </>
  )
}

function InstallSteps({ platform }: { platform: ReturnType<typeof detectPlatform> }) {
  if (platform === 'ios') return <IosSteps />
  if (platform === 'android') return <AndroidSteps />
  return <DesktopSteps />
}

/**
 * Tela cheia para quem abre o site no navegador (fora do app instalado). Primeiro a escolha entre
 * "instalar e testar" e "conhecer mais" (landing page); só depois vem o passo a passo da instalação.
 */
export function InstallGate() {
  const { installed, stage, canPrompt } = usePwaInstall()
  if (installed || !stage) return null
  const platform = detectPlatform()

  async function install() {
    play('click')
    if (canPrompt) await promptInstall()
    else openInstallGate()
  }

  if (stage === 'welcome') {
    return (
      <div className="install-gate" role="dialog" aria-modal="true" aria-labelledby="install-title">
        <div className="install-card">
          <Mascot size={84} mood="happy" />
          <h1 id="install-title">RANKTRASH</h1>
          <p>
            Fotografe o lixo, descarte certo e <b>ganhe pontos</b> no ranking da campanha Lixo Zero da Facens.
          </p>
          <button className="btn btn--green btn--block install-cta" onClick={() => void install()}>
            <Icon name="addBox" size={16} /> INSTALAR APP E TESTAR
          </button>
          <a className="btn btn--orange btn--block install-cta" href={landingUrl()} onClick={() => play('click')}>
            <Icon name="star" size={16} /> CONHECER MAIS SOBRE
          </a>
          <button className="btn btn--ghost btn--block" style={{ marginTop: 16 }} onClick={dismissInstallGate}>
            CONTINUAR NO NAVEGADOR
          </button>
        </div>
      </div>
    )
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
        ) : (
          <InstallSteps platform={platform} />
        )}
        <button className="btn btn--ghost btn--block" style={{ marginTop: 16 }} onClick={openWelcomeGate}>
          VOLTAR
        </button>
        <button className="btn btn--ghost btn--block" style={{ marginTop: 10 }} onClick={dismissInstallGate}>
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

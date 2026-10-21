import { MATERIAL_INFO, MATERIALS } from '../../supabase/functions/_shared/materials.ts'
import { MAX_PER_DAY } from '../../supabase/functions/_shared/antifraud.ts'
import {
  FIRST_OF_DAY_BONUS,
  FIRST_VISIT_BONUS,
  STREAK_MIN_DAYS,
} from '../../supabase/functions/_shared/scoring.ts'
import { Mascot } from '../components/Mascot'
import { Icon, type IconName } from '../components/PixelArt'
import { appUrl } from '../lib/site'

const STEPS: { icon: IconName; title: string; text: string }[] = [
  { icon: 'map', title: 'VÁ ATÉ A LIXEIRA', text: 'O mapa do campus mostra as lixeiras cadastradas. As que você ainda não usou valem bônus.' },
  { icon: 'camera', title: 'FOTOGRAFE', text: 'A câmera abre dentro do app, com o GPS acompanhando. Sem foto da galeria.' },
  { icon: 'shield', title: 'A IA CONFERE', text: 'A IA identifica o item e o material e diz em qual lixeira ele vai. O GPS confirma que você está lá.' },
  { icon: 'trophy', title: 'GANHE PONTOS', text: 'Os pontos entram no ranking do mês. No fim dele, quem está no topo ganha prêmios.' },
]

const SHOTS = [
  { src: '/landing/01-mapa.png', alt: 'Mapa do campus com as lixeiras', caption: 'MAPA' },
  { src: '/landing/03-camera.png', alt: 'Câmera ao vivo para fotografar o resíduo', caption: 'CÂMERA' },
  { src: '/landing/06-resultado.png', alt: 'Resultado com item, material e pontos', caption: 'RESULTADO' },
  { src: '/landing/07-ranking.png', alt: 'Ranking do mês e guerra de cursos', caption: 'RANKING' },
  { src: '/landing/08-perfil.png', alt: 'Perfil com nível, streak e conquistas', caption: 'PERFIL' },
]

const FAIR_PLAY = [
  'Câmera ao vivo: a foto sai de dentro do app, sem upload da galeria.',
  'Foto repetida (a sua ou parecida com a de outra pessoa) é recusada ou vai para revisão.',
  'A IA recusa foto de tela, de impressão ou de imagem da internet.',
  `Limites por aluno: ${MAX_PER_DAY} registros por dia e 1 por minuto.`,
  'Os pontos só são gravados pelo servidor. O app não consegue alterar a própria pontuação.',
  'Antes da premiação, a equipe audita as fotos do top 10. Fraude é desclassificação.',
]

const TECH = [
  'React',
  'TypeScript',
  'Vite',
  'PWA',
  'Leaflet + MapLibre',
  'Supabase',
  'PostgreSQL + RLS',
  'Edge Functions (Deno)',
  'Google Gemini',
  'Microsoft Entra ID',
  'Vercel',
]

export function Landing() {
  const app = appUrl()
  return (
    <div className="lp">
      <header className="lp-hero">
        <Mascot size={110} mood="happy" />
        <p className="lp-kicker">FACENS · LIXO ZERO</p>
        <h1 className="lp-title">RANKTRASH</h1>
        <p className="lp-lead">
          Descarte certo, ganhe pontos e suba no ranking. Um app que transforma a coleta seletiva do campus em um jogo.
        </p>
        <div className="lp-cta">
          <a className="btn btn--green" href={app}>
            <Icon name="addBox" size={16} /> ABRIR O APP
          </a>
          <a className="btn btn--ghost" href="#como-funciona">
            COMO FUNCIONA
          </a>
        </div>
      </header>

      <section className="lp-section" aria-labelledby="ideia">
        <h2 id="ideia">A IDEIA</h2>
        <div className="card">
          <p>
            O RankTrash é um projeto acadêmico (UPX) da campanha <b>Lixo Zero da Facens</b>. O aluno fotografa o
            resíduo na lixeira, a <b>inteligência artificial</b> identifica o item e o material, o <b>GPS</b> confirma
            que ele está em uma lixeira cadastrada e ele <b>ganha pontos</b>.
          </p>
          <p>
            Além de incentivar o descarte certo, cada registro gera dados reais sobre o que é jogado fora no campus:
            tipo de material, local e horário.
          </p>
        </div>
      </section>

      <section className="lp-section" id="como-funciona" aria-labelledby="como">
        <h2 id="como">COMO FUNCIONA</h2>
        <ol className="lp-steps">
          {STEPS.map((s, i) => (
            <li className="card" key={s.title}>
              <span className="lp-step-n">{i + 1}</span>
              <span className="lp-step-icon">
                <Icon name={s.icon} size={26} />
              </span>
              <h3>{s.title}</h3>
              <p>{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="lp-section" aria-labelledby="telas">
        <h2 id="telas">O APP POR DENTRO</h2>
        <div className="lp-shots">
          {SHOTS.map((s) => (
            <figure key={s.src}>
              <img src={s.src} alt={s.alt} loading="lazy" width={780} height={1688} />
              <figcaption>{s.caption}</figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section className="lp-section lp-two" aria-labelledby="pontos">
        <div className="card">
          <h2 id="pontos">PONTOS POR MATERIAL</h2>
          <div className="materials">
            {MATERIALS.map((m) => (
              <div key={m}>
                <i style={{ background: MATERIAL_INFO[m].binColor }} />
                {MATERIAL_INFO[m].label}: {MATERIAL_INFO[m].basePoints}
              </div>
            ))}
          </div>
          <h3 style={{ marginTop: 16 }}>BÔNUS</h3>
          <p>★ Streak de {STREAK_MIN_DAYS}+ dias seguidos: ×1,2</p>
          <p>★ 1ª visita a uma lixeira: +{FIRST_VISIT_BONUS}</p>
          <p>★ 1º descarte do dia: +{FIRST_OF_DAY_BONUS}</p>
        </div>
        <div className="card">
          <h2>RANKING E PRÊMIOS</h2>
          <p>
            Todo mês começa uma nova <b>temporada</b>. O top 3 ganha prêmios, e o nível do jogador (XP) nunca zera.
          </p>
          <p>
            Tem também a <b>guerra de cursos</b>, que soma os pontos de cada curso, e o ranking dos últimos 7 dias, para
            quem entra no meio do mês.
          </p>
          <p className="muted">As cores das lixeiras seguem a resolução CONAMA 275.</p>
        </div>
      </section>

      <section className="lp-section" aria-labelledby="justo">
        <h2 id="justo">JOGO LIMPO</h2>
        <div className="card">
          <ul className="lp-list">
            {FAIR_PLAY.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </div>
      </section>

      <section className="lp-section" aria-labelledby="tech">
        <h2 id="tech">TECNOLOGIA</h2>
        <div className="card">
          <p>
            Um PWA: instala pela tela inicial do celular, abre em tela cheia e não precisa de loja de aplicativos. Não
            tem hardware, só software.
          </p>
          <ul className="lp-chips">
            {TECH.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </div>
      </section>

      <section className="lp-section" aria-labelledby="privacidade">
        <h2 id="privacidade">PRIVACIDADE</h2>
        <div className="card">
          <p>
            O login é só com a conta Microsoft da Facens, e a sua senha nunca passa pelo RankTrash. A localização é
            lida <b>apenas na hora do registro</b>, e as fotos ficam em um espaço privado. O projeto não vende nem
            compartilha dados.
          </p>
          <p>
            <a href={`${app === '/' ? '' : app}/privacidade`}>Ler a política de privacidade</a>
          </p>
        </div>
      </section>

      <section className="lp-final">
        <h2>BORA JOGAR?</h2>
        <p>Abra no celular, instale na tela inicial e faça seu primeiro descarte.</p>
        <a className="btn btn--green" href={app}>
          <Icon name="addBox" size={16} /> ABRIR O APP
        </a>
      </section>

      <footer className="lp-footer">
        <p>RankTrash · projeto UPX · campanha Lixo Zero da Facens</p>
        <p>
          <a href={`${app === '/' ? '' : app}/privacidade`}>Privacidade</a> ·{' '}
          <a href={`${app === '/' ? '' : app}/termos`}>Termos</a>
        </p>
      </footer>
    </div>
  )
}

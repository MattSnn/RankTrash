import type { CSSProperties, ReactNode } from 'react'
import {
  DHASH_DUPLICATE_DISTANCE,
  MAX_PER_BIN_PER_DAY,
  MAX_PER_DAY,
  MIN_CONFIDENCE,
  SIGNATURE_WINDOW_MINUTES,
} from '../../supabase/functions/_shared/antifraud.ts'
import { MAX_ACCEPTED_ACCURACY_M, MAX_ACCURACY_BONUS_M } from '../../supabase/functions/_shared/geo.ts'
import { MATERIAL_INFO, MATERIALS } from '../../supabase/functions/_shared/materials.ts'
import {
  FIRST_OF_DAY_BONUS,
  FIRST_VISIT_BONUS,
  FULL_VALUE_PER_MATERIAL_PER_DAY,
  HALF_VALUE_PER_MATERIAL_PER_DAY,
  STREAK_MIN_DAYS,
  STREAK_MULTIPLIER,
} from '../../supabase/functions/_shared/scoring.ts'
import { Mascot, MascotEyes } from '../components/Mascot'
import { Icon, type IconName } from '../components/PixelArt'
import { appUrl } from '../lib/site'
import { Phone, PixelBin, useActiveIndex, useCycle, useReveal, type Shot } from './parts'

const shot = (name: string, alt: string): Shot => ({ src: `/landing/${name}.webp`, alt })

const HERO_SHOTS = [
  shot('01-mapa', 'Mapa do campus com as lixeiras'),
  shot('02-mapa-popup', 'Lixeira selecionada no mapa'),
  shot('06-resultado', 'Resultado: item, material, lixeira certa e pontos'),
  shot('07-ranking', 'Ranking do mês'),
  shot('08-perfil', 'Perfil com nível, streak e conquistas'),
]

const STEPS: { icon: IconName; tag: string; title: string; text: ReactNode; shot: Shot }[] = [
  {
    icon: 'map',
    tag: 'PASSO 1',
    title: 'ACHE UMA LIXEIRA',
    text: (
      <>
        O mapa do campus mostra todas as lixeiras cadastradas. As <b className="t-red">vermelhas</b> você ainda não
        explorou e valem <b>+{FIRST_VISIT_BONUS}</b> na primeira visita.
      </>
    ),
    shot: shot('01-mapa', 'Mapa do campus com lixeiras exploradas e inexploradas'),
  },
  {
    icon: 'camera',
    tag: 'PASSO 2',
    title: 'ESCOLHA E FOTOGRAFE',
    text: (
      <>
        Toque na lixeira e em <b>DESCARTAR</b>. A câmera abre <b>ao vivo</b> dentro do app, sem foto da galeria,
        enquanto o GPS confirma que você está perto dela.
      </>
    ),
    shot: shot('02-mapa-popup', 'Lixeira selecionada no mapa, com o botão de descartar'),
  },
  {
    icon: 'shield',
    tag: 'PASSO 3',
    title: 'A IA ANALISA',
    text: (
      <>
        O <b>Google Gemini</b> identifica o item e o material em segundos e diz em qual lixeira ele vai. Ao mesmo tempo,
        o servidor roda as checagens antifraude.
      </>
    ),
    shot: shot('06-resultado', 'Resultado da IA: item, material, lixeira certa e pontos'),
  },
  {
    icon: 'trophy',
    tag: 'PASSO 4',
    title: 'PONTOS NA CONTA',
    text: (
      <>
        Os pontos entram na conta, com bônus de streak e de primeira visita, e seu nome sobe no{' '}
        <b className="t-yellow">ranking do mês</b>.
      </>
    ),
    shot: shot('07-ranking', 'Ranking do mês com o pódio'),
  },
]

const SHOWCASE = [
  { ...shot('00-login', 'Login com a conta Microsoft da Facens'), caption: 'LOGIN FACENS' },
  { ...shot('06-resultado', 'Resultado de um descarte'), caption: 'RESULTADO' },
  { ...shot('07-ranking', 'Ranking do mês com pódio'), caption: 'RANKING' },
  { ...shot('08-perfil', 'Perfil do jogador'), caption: 'PERFIL' },
  { ...shot('09-admin', 'Painel do administrador'), caption: 'ADMIN' },
]

const PODIUM = [
  { place: 2, name: 'PEDRO L.', course: 'Eng. Civil', pts: 431 },
  { place: 1, name: 'ANA L.', course: 'Eng. Computação', pts: 496 },
  { place: 3, name: 'JULIA R.', course: 'Arquitetura', pts: 377 },
]

const COURSE_WAR = [
  { course: 'Engenharia Civil', pct: 92 },
  { course: 'Ciência da Computação', pct: 76 },
  { course: 'Arquitetura e Urbanismo', pct: 61 },
  { course: 'Engenharia Mecânica', pct: 47 },
]

const TERMINAL: [string, string][] = [
  ['login @facens.br', 'conta válida'],
  ['gps: 6 m da lixeira BLOCO A', 'no raio'],
  [`limites: 3/${MAX_PER_DAY} hoje · 1/min`, 'livre'],
  ['dHash 64 bits x suas fotos (30 dias)', 'inédita'],
  ['foto de tela ou impressa?', 'não'],
  ['assinatura aluminio|coca|vermelha', 'nova'],
  ['gemini: lata de alumínio (94%)', 'AMARELA'],
]

const RULES: { icon: IconName; title: string; text: string }[] = [
  { icon: 'camera', title: 'SÓ CÂMERA AO VIVO', text: 'A foto sai de dentro do app. Nada de imagem salva na galeria.' },
  {
    icon: 'target',
    title: 'FOTO REPETIDA? NÃO',
    text: `Um hash perceptual compara cada foto com as anteriores (distância ≤ ${DHASH_DUPLICATE_DISTANCE} = recusada).`,
  },
  {
    icon: 'flash',
    title: 'MESMO LIXO, DE NOVO?',
    text: `Mesmo material, marca, cor e estado na mesma lixeira em menos de ${SIGNATURE_WINDOW_MINUTES} min é recusado.`,
  },
  {
    icon: 'phone',
    title: 'FOTO DE TELA',
    text: 'A IA percebe quando é foto de monitor, de celular ou impressa, e recusa.',
  },
  {
    icon: 'dots',
    title: 'LIMITES JUSTOS',
    text: `${MAX_PER_DAY} registros por dia, ${MAX_PER_BIN_PER_DAY} por lixeira e 1 por minuto. Confiança da IA abaixo de ${Math.round(MIN_CONFIDENCE * 100)}% vai para revisão.`,
  },
  {
    icon: 'shield',
    title: 'PONTOS NO SERVIDOR',
    text: 'Só o servidor grava pontos. Antes da premiação, a equipe audita as fotos do top 10.',
  },
]

const STACK: { title: string; icon: IconName; items: string[] }[] = [
  { title: 'APP', icon: 'phone', items: ['React 19', 'TypeScript', 'Vite', 'PWA + Workbox', 'Leaflet + MapLibre', 'Web Audio'] },
  { title: 'BACKEND', icon: 'bin', items: ['Supabase', 'PostgreSQL + RLS', 'Edge Functions (Deno)', 'Storage privado'] },
  { title: 'IA E LOGIN', icon: 'star', items: ['Google Gemini', 'Saída JSON estruturada', 'Microsoft Entra ID'] },
  { title: 'INFRA', icon: 'map', items: ['Vercel', 'Cloudflare', 'OpenFreeMap', 'Resend'] },
]

const FAQ: { q: string; a: ReactNode }[] = [
  {
    q: 'Quem pode jogar?',
    a: 'Quem tem conta Microsoft da Facens (@facens.br). O login é o mesmo do e-mail institucional e a senha nunca passa pelo RankTrash.',
  },
  {
    q: 'Preciso baixar da loja de apps?',
    a: 'Não. O RankTrash é um PWA: você instala direto do navegador, no Android ou no iPhone, e ele abre em tela cheia como um app comum.',
  },
  { q: 'Custa alguma coisa?', a: 'Nada. O app é gratuito e não tem anúncios nem compras.' },
  {
    q: 'E se o GPS errar?',
    a: `O app usa a leitura mais precisa dos últimos segundos e aceita uma margem de até ${MAX_ACCURACY_BONUS_M} m além do raio da lixeira. Se a precisão passar de ${MAX_ACCEPTED_ACCURACY_M} m, ele pede para você ir a um lugar mais aberto. Com várias lixeiras perto, você escolhe qual.`,
  },
  {
    q: 'E se a IA classificar errado?',
    a: 'Quando a IA não tem certeza, o registro vai para revisão da equipe e os pontos só entram depois da aprovação.',
  },
  {
    q: 'O que acontece com a minha foto e a localização?',
    a: 'A localização é lida só na hora do registro, nunca em segundo plano. As fotos ficam em um espaço privado que só você e os administradores veem. Nada é vendido ou compartilhado.',
  },
  {
    q: 'Como funcionam os prêmios?',
    a: 'Cada mês é uma temporada. O top 3 do ranking ganha prêmios, depois de a equipe auditar as fotos do top 10. Seu nível (XP) nunca zera.',
  },
]

function SectionHead({ n, kicker, title, children }: { n: string; kicker: string; title: ReactNode; children?: ReactNode }) {
  return (
    <header className="sec-head" data-reveal>
      <p className="sec-kicker">
        <span>{n}</span> {kicker}
      </p>
      <h2 className="sec-title">{title}</h2>
      {children && <p className="sec-lead">{children}</p>}
    </header>
  )
}

export function Landing() {
  useReveal()
  const app = appUrl()
  const appBase = app === '/' ? '' : app
  const heroIndex = useCycle(HERO_SHOTS.length, 2800)
  const { refs: stepRefs, active: activeStep } = useActiveIndex()
  const ticker = MATERIALS.map((m) => `${MATERIAL_INFO[m].label.toUpperCase()} → ${MATERIAL_INFO[m].binLabel.split(' ')[0]} +${MATERIAL_INFO[m].basePoints}`)

  return (
    <div className="lp">
      <a className="skip" href="#conteudo">
        Pular para o conteúdo
      </a>

      <nav className="nav-lp" aria-label="Principal">
        <div className="wrap nav-lp__in">
          <a className="brand" href="#topo" aria-label="RankTrash, início">
            <MascotEyes size={34} />
            <span>RANKTRASH</span>
          </a>
          <ul className="nav-lp__links">
            <li><a href="#como-funciona">Como funciona</a></li>
            <li><a href="#pontos">Pontos</a></li>
            <li><a href="#ranking">Ranking</a></li>
            <li><a href="#jogo-limpo">Jogo limpo</a></li>
            <li><a href="#faq">FAQ</a></li>
          </ul>
          <a className="btn btn--green btn--sm" href={app}>
            ABRIR APP
          </a>
        </div>
      </nav>

      <main id="conteudo">
        {/* ---------- HERO ---------- */}
        <section className="hero" id="topo">
          <div className="hero__fx" aria-hidden>
            {Array.from({ length: 14 }, (_, i) => (
              <i key={i} style={{ '--i': i } as CSSProperties} />
            ))}
          </div>
          <div className="wrap hero__in">
            <div className="hero__copy">
              <p className="pill">
                <span className="pill__dot" /> CAMPANHA LIXO ZERO · FACENS
              </p>
              <h1 className="hero__title">
                <span>DESCARTE</span>
                <span>CERTO.</span>
                <span className="t-green">SUBA NO</span>
                <span className="t-yellow">RANKING.</span>
              </h1>
              <p className="hero__lead">
                Fotografe o resíduo na lixeira, a <b>IA</b> identifica o material, o <b>GPS</b> confirma o lugar e você
                ganha pontos. A coleta seletiva do campus virou jogo.
              </p>
              <div className="hero__cta">
                <a className="btn btn--green btn--lg" href={app}>
                  <Icon name="addBox" size={16} /> JOGAR AGORA
                </a>
                <a className="btn btn--ghost btn--lg" href="#como-funciona">
                  COMO FUNCIONA ▼
                </a>
              </div>
              <ul className="hero__stats">
                <li><b>{MATERIALS.length}</b><span>MATERIAIS</span></li>
                <li><b>IA+GPS</b><span>VALIDAÇÃO</span></li>
                <li><b>TOP 3</b><span>PRÊMIOS/MÊS</span></li>
              </ul>
            </div>

            <div className="hero__device">
              <div className="hero__glow" aria-hidden />
              <Phone shots={HERO_SHOTS} index={heroIndex} className="phone--hero" eager />
              <div className="float float--a" aria-hidden>
                <span className="t-green">+19</span> PTS
              </div>
              <div className="float float--b" aria-hidden>
                <i style={{ background: MATERIAL_INFO.aluminio.binColor }} /> LATA → AMARELA
              </div>
              <div className="float float--c" aria-hidden>
                <Icon name="flame" size={14} /> STREAK {STREAK_MIN_DAYS}
              </div>
              <div className="float float--d" aria-hidden>
                <Mascot size={58} mood="happy" />
              </div>
            </div>
          </div>
        </section>

        {/* ---------- LETREIRO ---------- */}
        <div className="marquee" aria-hidden>
          <div className="marquee__track">
            {[...ticker, ...ticker].map((t, i) => (
              <span key={i}>
                ♻ {t}
              </span>
            ))}
          </div>
        </div>

        {/* ---------- IDEIA ---------- */}
        <section className="band" id="ideia">
          <div className="wrap">
            <SectionHead n="01" kicker="A IDEIA" title={<>Lixeira inteligente <span className="t-green">sem hardware</span>.</>}>
              A primeira proposta era uma lixeira automatizada só para latinhas. Virou algo maior: um app que valida
              qualquer descarte com foto, IA e GPS, e ainda gera dados sobre o que o campus joga fora.
            </SectionHead>
            <div className="idea-grid">
              {[
                { icon: 'phone' as IconName, t: 'SÓ SOFTWARE', d: 'Nenhuma peça para comprar ou manter. Funciona em qualquer celular, direto do navegador.' },
                { icon: 'star' as IconName, t: 'TODOS OS MATERIAIS', d: 'Alumínio, plástico, vidro, papel, metal, orgânico, eletrônico e rejeito, nas cores da coleta seletiva.' },
                { icon: 'target' as IconName, t: 'DADOS DE VERDADE', d: 'Cada registro traz material, lixeira e horário: um mapa real dos resíduos do campus para a Lixo Zero.' },
              ].map((c, i) => (
                <article className="tile" data-reveal style={{ '--d': i } as CSSProperties} key={c.t}>
                  <span className="tile__icon">
                    <Icon name={c.icon} size={26} />
                  </span>
                  <h3>{c.t}</h3>
                  <p>{c.d}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ---------- COMO FUNCIONA ---------- */}
        <section className="band band--screen" id="como-funciona">
          <div className="wrap">
            <SectionHead n="02" kicker="COMO FUNCIONA" title={<>Quatro passos. <span className="t-yellow">Poucos segundos.</span></>} />
            <div className="how">
              <ol className="how__steps">
                {STEPS.map((s, i) => (
                  <li
                    key={s.title}
                    className={`how-step ${activeStep === i ? 'is-active' : ''}`}
                    data-index={i}
                    ref={(el) => {
                      stepRefs.current[i] = el
                    }}
                  >
                    <div className="how-step__card" data-reveal>
                      <p className="how-step__tag">
                        <span className="how-step__icon">
                          <Icon name={s.icon} size={18} />
                        </span>
                        {s.tag}
                      </p>
                      <h3>{s.title}</h3>
                      <p>{s.text}</p>
                    </div>
                    <Phone shots={[s.shot]} className="phone--step" />
                  </li>
                ))}
              </ol>
              <div className="how__sticky" aria-hidden>
                <Phone shots={STEPS.map((s) => s.shot)} index={activeStep} className="phone--sticky" />
                <div className="how__dots">
                  {STEPS.map((s, i) => (
                    <i key={s.title} className={activeStep === i ? 'is-on' : undefined} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ---------- PONTOS ---------- */}
        <section className="band" id="pontos">
          <div className="wrap">
            <SectionHead n="03" kicker="PONTUAÇÃO" title={<>Cada material vale <span className="t-green">pontos</span>.</>}>
              As cores seguem a coleta seletiva (CONAMA 275). Latinhas e eletrônicos, que fazem mais diferença na reciclagem, valem mais.
            </SectionHead>
            <div className="bins">
              {MATERIALS.map((m, i) => {
                const info = MATERIAL_INFO[m]
                return (
                  <article className="bin" data-reveal key={m} style={{ '--c': info.binColor, '--d': i % 4 } as CSSProperties}>
                    <div className="bin__sprite">
                      <PixelBin color={info.binColor} size={52} />
                    </div>
                    <p className="bin__pts">
                      +{info.basePoints}
                      <small>PTS</small>
                    </p>
                    <h3>{info.label}</h3>
                    <p className="bin__where">{info.binLabel.split(' ')[0]}</p>
                  </article>
                )
              })}
            </div>

            <h3 className="sub-title" data-reveal>POWER-UPS</h3>
            <div className="powerups">
              <article className="power" data-reveal>
                <span className="power__icon power__icon--orange"><Icon name="flame" size={28} /></span>
                <p className="power__val">×{String(STREAK_MULTIPLIER).replace('.', ',')}</p>
                <h4>STREAK</h4>
                <p>Descarte em {STREAK_MIN_DAYS} dias seguidos ou mais e tudo vale mais.</p>
              </article>
              <article className="power" data-reveal style={{ '--d': 1 } as CSSProperties}>
                <span className="power__icon power__icon--red"><Icon name="map" size={28} /></span>
                <p className="power__val">+{FIRST_VISIT_BONUS}</p>
                <h4>1ª VISITA</h4>
                <p>Primeira vez em uma lixeira? Bônus de explorador.</p>
              </article>
              <article className="power" data-reveal style={{ '--d': 2 } as CSSProperties}>
                <span className="power__icon power__icon--yellow"><Icon name="star" size={28} /></span>
                <p className="power__val">+{FIRST_OF_DAY_BONUS}</p>
                <h4>1º DO DIA</h4>
                <p>O primeiro descarte de cada dia ganha um extra.</p>
              </article>
            </div>
            <p className="fine" data-reveal>
              Jogo justo: o mesmo material no mesmo dia vale 100% nos {FULL_VALUE_PER_MATERIAL_PER_DAY} primeiros registros,
              50% até o {HALF_VALUE_PER_MATERIAL_PER_DAY}º e depois 0.
            </p>
          </div>
        </section>

        {/* ---------- RANKING ---------- */}
        <section className="band band--screen" id="ranking">
          <div className="wrap ranking">
            <div className="ranking__copy">
              <SectionHead n="04" kicker="TEMPORADAS" title={<>Todo mês, uma <span className="t-yellow">nova disputa</span>.</>}>
                O ranking zera no começo de cada mês e o top 3 leva prêmios. Seu nível nunca zera, e ainda tem a guerra de
                cursos.
              </SectionHead>
              <div className="war" data-reveal>
                <p className="war__title">
                  <Icon name="trophy" size={16} /> GUERRA DE CURSOS <small>exemplo</small>
                </p>
                {COURSE_WAR.map((c, i) => (
                  <div className="war__row" key={c.course} style={{ '--w': c.pct / 100, '--d': i } as CSSProperties}>
                    <span>{c.course}</span>
                    <div className="war__bar">
                      <i />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="lp-podium" data-reveal aria-label="Exemplo de pódio do mês">
              <p className="lp-podium__label">PÓDIO DO MÊS · EXEMPLO</p>
              <div className="lp-podium__row">
                {PODIUM.map((p) => (
                  <div className={`lp-podium__col lp-podium__col--${p.place}`} key={p.place}>
                    <div className="lp-podium__who">
                      {p.place === 1 && <span className="lp-podium__crown">♛</span>}
                      <span className="lp-podium__avatar">{p.name[0]}</span>
                      <b>{p.name}</b>
                      <small>{p.course}</small>
                    </div>
                    <div className="lp-podium__block">
                      <span className="lp-podium__place">{p.place}º</span>
                      <span className="lp-podium__pts">{p.pts} PTS</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ---------- JOGO LIMPO ---------- */}
        <section className="band" id="jogo-limpo">
          <div className="wrap">
            <SectionHead n="05" kicker="JOGO LIMPO" title={<>Trapacear <span className="t-red">não compensa</span>.</>}>
              Antes de dar qualquer ponto, o servidor confere cada registro em várias camadas. Tudo em poucos segundos.
            </SectionHead>
            <div className="fair">
              <div className="term" data-reveal role="img" aria-label="Simulação das checagens de um descarte">
                <div className="term__bar">
                  <i /><i /><i />
                  <span>register-disposal · simulação</span>
                </div>
                <div className="term__body">
                  <p className="term__cmd">&gt; validando descarte #4821</p>
                  {TERMINAL.map(([k, v], i) => (
                    <p className="term__line" key={k} style={{ '--d': i } as CSSProperties}>
                      <span className="t-green">[OK]</span>
                      <span className="term__k">{k}</span>
                      <span className="term__v">{v}</span>
                    </p>
                  ))}
                  <p className="term__done" style={{ '--d': TERMINAL.length } as CSSProperties}>
                    &gt;&gt;&gt; <span className="t-yellow">+19 PONTOS</span> <span className="term__cursor" />
                  </p>
                </div>
              </div>
              <div className="rules">
                {RULES.map((r, i) => (
                  <article className="rule" data-reveal style={{ '--d': i % 2 } as CSSProperties} key={r.title}>
                    <span className="rule__icon">
                      <Icon name={r.icon} size={18} />
                    </span>
                    <div>
                      <h3>{r.title}</h3>
                      <p>{r.text}</p>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ---------- TELAS ---------- */}
        <section className="band band--screen band--tight" id="telas">
          <div className="wrap">
            <SectionHead n="06" kicker="POR DENTRO" title={<>Um app com <span className="t-green">cara de jogo</span>.</>}>
              Mapa escuro do campus, pixel art, sons 8-bit e um mascote, o Lixo-bot. Tudo feito do zero.
            </SectionHead>
          </div>
          <div className="showcase" data-reveal>
            {SHOWCASE.map((s, i) => (
              <figure key={s.src} style={{ '--i': i - 2 } as CSSProperties}>
                <Phone shots={[s]} className="phone--show" />
                <figcaption>{s.caption}</figcaption>
              </figure>
            ))}
          </div>
        </section>

        {/* ---------- TECNOLOGIA ---------- */}
        <section className="band" id="tecnologia">
          <div className="wrap">
            <SectionHead n="07" kicker="TECNOLOGIA" title={<>Por baixo do <span className="t-yellow">capô</span>.</>}>
              Um PWA moderno com backend serverless. A chave da IA fica só no servidor e os pontos nunca são calculados no
              celular.
            </SectionHead>
            <div className="arch" data-reveal>
              <div className="arch__node arch__node--app">
                <Icon name="phone" size={22} />
                <b>PWA</b>
                <small>foto + GPS</small>
              </div>
              <span className="arch__arrow" aria-hidden />
              <div className="arch__node arch__node--fn">
                <Icon name="shield" size={22} />
                <b>EDGE FUNCTION</b>
                <small>login · geofence · antifraude · pontos</small>
              </div>
              <span className="arch__arrow" aria-hidden />
              <div className="arch__stack">
                <div className="arch__node">
                  <Icon name="star" size={18} />
                  <b>GEMINI</b>
                  <small>identifica o material</small>
                </div>
                <div className="arch__node">
                  <Icon name="bin" size={18} />
                  <b>POSTGRES</b>
                  <small>RLS · ranking · temporadas</small>
                </div>
                <div className="arch__node">
                  <Icon name="camera" size={18} />
                  <b>STORAGE</b>
                  <small>fotos privadas</small>
                </div>
              </div>
            </div>
            <div className="stack">
              {STACK.map((g, i) => (
                <article className="stack__group" data-reveal style={{ '--d': i } as CSSProperties} key={g.title}>
                  <h3>
                    <Icon name={g.icon} size={16} /> {g.title}
                  </h3>
                  <ul>
                    {g.items.map((t) => (
                      <li key={t}>{t}</li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ---------- FAQ ---------- */}
        <section className="band band--screen" id="faq">
          <div className="wrap wrap--narrow">
            <SectionHead n="08" kicker="DÚVIDAS" title="Perguntas frequentes" />
            <div className="faq" data-reveal>
              {FAQ.map((f) => (
                <details key={f.q}>
                  <summary>{f.q}</summary>
                  <p>{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ---------- CTA FINAL ---------- */}
        <section className="band final">
          <div className="wrap">
            <div className="final__card" data-reveal>
              <div className="final__copy">
                <Mascot size={92} mood="happy" />
                <h2>PRONTO PARA JOGAR?</h2>
                <p>Abra no celular, instale na tela inicial e faça seu primeiro descarte.</p>
                <a className="btn btn--green btn--lg" href={app}>
                  <Icon name="addBox" size={16} /> ABRIR O RANKTRASH
                </a>
              </div>
              <div className="final__qr">
                <img src="/landing/qr-app.svg" alt="QR code para abrir ranktrash.eco.br no celular" width={200} height={200} />
                <p>APONTE A CÂMERA DO CELULAR</p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="foot">
        <div className="wrap foot__in">
          <div className="brand">
            <MascotEyes size={30} />
            <span>RANKTRASH</span>
          </div>
          <p>Projeto acadêmico (UPX) da campanha Lixo Zero da Facens. Sem fins comerciais.</p>
          <ul>
            <li><a href={app}>Abrir o app</a></li>
            <li><a href={`${appBase}/privacidade`}>Privacidade</a></li>
            <li><a href={`${appBase}/termos`}>Termos</a></li>
          </ul>
        </div>
      </footer>
    </div>
  )
}

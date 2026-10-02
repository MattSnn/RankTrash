/* RankTrash · video pitch v2 — scenes + render loop. Times inside scenes are local (lt, seconds). */
'use strict'

const CUE_LIST = []
let BUILDING = null
const cue = (lt, name, gain = 1) => CUE_LIST.push({ s: BUILDING, lt, name, gain })

// ---- 0. intro: PRESS START ----
scene('intro', '', (root) => {
  const logo = el('div', 'abs', root, `<div class="plate" style="font-size:72px">RANK ${EYES_LOGO(120)} TRASH</div>`, { left: 0, right: 0, top: '330px', textAlign: 'center' })
  const ps = el('div', 'abs big-pix', root, 'PRESS START', { left: 0, right: 0, top: '560px', textAlign: 'center', fontSize: '40px', color: '#fde8b0' })
  const sub = el('div', 'abs pix', root, 'PROJETO UPX · ENGENHARIA DA COMPUTAÇÃO', { left: 0, right: 0, top: '650px', textAlign: 'center', fontSize: '18px', color: '#8fb2d9', letterSpacing: '2px' })
  const m = Mascot(root, 130, 895, 760)
  cue(0.15,'pop',0.8); cue(1.7,'coin',1); cue(2.35,'whoosh',0.9)
  return (lt) => {
    const p = pop(lt, 0.15, 0.6)
    const zoom = ease(lt, 2.35, 2.8, E.in)
    tf(logo, { s: p.s * (1 + zoom * 3), o: p.o * (1 - zoom) })
    tf(ps, { o: (lt > 0.8 && (lt < 1.7 ? Math.floor(lt * 4) % 2 === 0 : true) ? 1 : 0) * (1 - zoom), s: 1 + bump(lt, 1.7, 0.3) * 0.25 })
    tf(sub, { o: ease(lt, 0.9, 1.3) * (1 - zoom) })
    m.set(lt > 1.7 ? 'happy' : 'idle', lt)
    tf(m.box, { y: (1 - ease(lt, 0.4, 0.9, E.back)) * 300 - bump(lt, 1.7, 0.4) * 60 + zoom * 300, o: 1 - zoom })
  }
}, { dur: 2.8 })

// ---- 1. hook ----
scene('hook', 'O DESAFIO', (root) => {
  const BINS = [['#2d6fd6', 'PAPEL'], ['#e0413a', 'PLÁSTICO'], ['#2f9a4a', 'VIDRO'], ['#f5c518', 'METAL'], ['#8a5a2b', 'ORGÂNICO'], ['#8b8f97', 'REJEITO']]
  const bins = BINS.map(([c, n], i) => el('div', 'abs', root, `${BIN(c, 150)}<div class="pix" style="text-align:center;font-size:15px;margin-top:14px;color:${c === '#8b8f97' ? '#c9ccd2' : c}">${n}</div>`, { left: 255 + i * 245 + 'px', top: '560px', width: '150px', transformOrigin: '50% 100%' }))
  const m = Mascot(root, 150, 885, 310)
  const can = el('div', 'abs', root, CAN(46), { left: '1035px', top: '360px' })
  const head = words(root, 'Onde vai <span class="hly">essa lata?</span>', 'abs h1')
  Object.assign(head.style, { left: 0, right: 0, top: '110px', textAlign: 'center', fontSize: '92px' })
  const trava = el('div', 'abs big-pix', root, 'TRAVOU!', { left: 0, right: 0, top: '110px', textAlign: 'center', fontSize: '90px', color: '#e0413a' })
  const tBins = WT('hook', 'lixeiras coloridas'), tTrava = WT('hook', 'e trava'), tQ = WT('hook', 'Onde vai')
  const tColor = [WT('hook', 'Azul'), WT('hook', 'vermelha'), WT('hook', 'amarela')]
  cue(0.1,'pop',0.6); for (let i=0;i<6;i++) cue(tBins+i*0.07,'blip',0.45); cue(tTrava,'error',0.9); cue(tTrava,'thud',0.7); tColor.forEach(t=>cue(t,'boing',0.6)); cue(tQ,'question',0.8)
  return (lt) => {
    m.set(lt < tTrava ? 'idle' : lt < tQ ? 'sad' : 'look', lt)
    m.say(lt < tTrava ? 'NHAM!' : '???', lt < tTrava ? env(lt, 0.4, tBins, 0.2, 0.2) : env(lt, tTrava + 0.2, tQ - 0.1, 0.2, 0.15))
    const mp = pop(lt, 0.1)
    tf(m.box, { s: mp.s, o: mp.o, ...shake(lt, tTrava, 0.5, 10) })
    tf(can, { y: Math.sin(lt * 5) * 8, r: Math.sin(lt * 3) * 12, o: mp.o })
    bins.forEach((b, i) => {
      const t0 = tBins + i * 0.07, p = ease(lt, t0, t0 + 0.5, E.back)
      const ci = [0, 1, 3].indexOf(i), hi = ci >= 0 ? bump(lt, tColor[ci], 0.45) : 0
      tf(b, { y: (1 - p) * 300 - hi * 60, sy: 1 + hi * 0.12, sx: 1 - hi * 0.06, o: P(lt, t0, t0 + 0.1) })
    })
    tf(trava, { o: env(lt, tTrava, tQ - 0.1, 0.05, 0.15), s: 1 + bump(lt, tTrava, 0.25) * 0.4, ...shake(lt, tTrava, 0.5, 12) })
    wordsIn(head, lt, tQ - 0.05, 0.07)
  }
})

// ---- 2. problem ----
scene('problem', 'O PROBLEMA', (root) => {
  const grid = el('div', 'abs', root, '', { left: '170px', top: '250px', width: '640px', height: '520px' })
  const cells = []
  for (let r = 0; r < 6; r++) for (let c = 0; c < 8; c++) {
    const d = el('div', 'abs', grid, icon('bin', 34, '#0a0f1f'), { left: c * 80 + 'px', top: r * 84 + 'px', width: '68px', height: '72px', display: 'grid', placeItems: 'center', background: '#8fe39a', boxShadow: '4px 4px 0 #0a0f1f' })
    cells.push({ d, dist: Math.hypot(c - 3.5, r - 2.5) })
  }
  const drop = el('div', 'abs', root, CAN(60), { left: '460px', top: '200px', zIndex: 4 })
  const tagC = el('div', 'stamp', root, 'CONTAMINADO!', { left: '250px', top: '420px', color: '#ff6b62', fontSize: '34px', zIndex: 5 })
  const g1 = words(root, 'Um item errado\n<span style="color:#ff6b62">contamina</span>\no lote inteiro.', 'abs h1')
  Object.assign(g1.style, { left: '930px', top: '330px', fontSize: '80px' })
  // stat
  const wf = el('div', 'abs', root, '', { left: '200px', top: '220px', width: '560px', height: '560px' })
  const wcells = Array.from({ length: 100 }, (_, i) => el('div', 'abs', wf, '', { left: (i % 10) * 56 + 'px', top: Math.floor(i / 10) * 56 + 'px', width: '46px', height: '46px', background: '#1d3a66' }))
  const pct = el('div', 'abs big-pix', root, '', { left: '900px', top: '260px', fontSize: '170px', color: '#8fe39a', textShadow: '10px 10px 0 #0a0f1f' })
  const pctT = el('div', 'abs h2', root, 'do lixo é reciclado<br>no Brasil.', { left: '905px', top: '480px' })
  const src = el('div', 'abs', root, 'Fonte: Panorama dos Resíduos Sólidos no Brasil (Abrema)', { left: '908px', top: '640px', fontSize: '20px', color: '#8fb2d9' })
  // not bins
  const nb = el('div', 'abs h1', root, 'Lixeira não falta.', { left: 0, right: 0, top: '170px', textAlign: 'center' })
  const ok = el('div', 'abs', root, icon('check', 80, '#8fe39a'), { left: '1490px', top: '170px' })
  const lack = el('div', 'abs kicker', root, 'O QUE FALTA É:', { left: 0, right: 0, top: '370px', textAlign: 'center', fontSize: '26px' })
  const three = [['INFORMAÇÃO', '#fde8b0'], ['HÁBITO', '#fde8b0'], ['UM BOM MOTIVO', '#f5c518']].map(([t, c], i) => el('div', 'card pix', root, t, { left: 260 + i * 480 + 'px', top: '450px', width: '420px', textAlign: 'center', fontSize: '26px', padding: '44px 10px', background: c, color: '#0a0f1f', borderColor: '#0a0f1f' }))
  const m = Mascot(root, 110, 1630, 700, 'left')
  const tA = 0, tB = WT('problem', 'E no Brasil'), tC = WT('problem', 'Lixeira não'), tD = WT('problem', 'O que falta')
  const tW = [WT('problem', 'informação'), WT('problem', 'hábito'), WT('problem', 'um bom motivo')]
  const tHit = WT('problem', 'contaminar')
  cue(tHit-0.6,'fall',0.6); cue(tHit,'splat',1); cue(tHit+0.5,'stamp',0.8); cue(tB+0.9,'thud',0.9); cue(tC+0.6,'blip',0.6); tW.forEach((t,i)=>cue(t-0.1,'slam',0.8)); cue(tW[2]+0.4,'pop',0.6)
  return (lt) => {
    const oA = 1 - ease(lt, tB - 0.35, tB - 0.05)
    // can drops into the grid center, contamination spreads from there
    const dp = ease(lt, tHit - 0.6, tHit, E.in)
    tf(drop, { y: dp * 290, r: dp * 180, o: (lt < tHit ? P(lt, tHit - 0.7, tHit - 0.6) : 0) * oA })
    const spread = P(lt, tHit, tHit + 1.6)
    cells.forEach((c, i) => {
      const inP = ease(lt, 0.05 + i * 0.01, 0.4 + i * 0.01, E.back)
      const bad = spread * 5 > c.dist
      c.d.style.background = bad ? (c.dist < 0.8 ? '#e0413a' : '#7a2a2a') : '#8fe39a'
      tf(c.d, { s: inP * (bad ? 0.92 : 1), o: oA })
    })
    tf(grid, shake(lt, tHit, 0.5, 16))
    tf(tagC, { o: P(lt, tHit + 0.5, tHit + 0.6) * oA, s: 1.6 - 0.6 * ease(lt, tHit + 0.5, tHit + 0.75), r: -8 })
    wordsIn(g1, lt, 0.5, 0.05, 0.45, tB - 0.45)
    // stat
    const oB = 1 - ease(lt, tC - 0.35, tC - 0.05)
    wcells.forEach((c, i) => {
      const p = ease(lt, tB + i * 0.006, tB + 0.25 + i * 0.006)
      const green = i >= 96 && lt > tB + 0.9 + (i - 96) * 0.12
      c.style.background = green ? '#8fe39a' : '#1d3a66'
      tf(c, { s: p * (green ? 1.1 : 1), o: p * oB })
    })
    pct.textContent = '<5%'
    tf(pct, { o: P(lt, tB + 0.9, tB + 0.95) * oB, s: 1.8 - 0.8 * ease(lt, tB + 0.9, tB + 1.15, E.out5), ...shake(lt, tB + 1.1, 0.3, 10) })
    tf(pctT, { o: ease(lt, tB + 0.5, tB + 0.8) * oB, y: (1 - ease(lt, tB + 0.5, tB + 0.9)) * 30 })
    tf(src, { o: ease(lt, tB + 0.9, tB + 1.2) * oB * 0.9 })
    // lack
    tf(nb, { o: ease(lt, tC - 0.1, tC + 0.2), y: (1 - ease(lt, tC - 0.1, tC + 0.35, E.back)) * 60 })
    tf(ok, { ...pop(lt, tC + 0.6, 0.4) })
    tf(lack, { o: ease(lt, tD, tD + 0.2) })
    three.forEach((c, i) => { const t0 = tW[i] - 0.1; tf(c, { o: P(lt, t0, t0 + 0.08), s: 1.5 - 0.5 * ease(lt, t0, t0 + 0.3, E.out5), r: (1 - ease(lt, t0, t0 + 0.3)) * -10 + (i - 1) * 2, ...shake(lt, t0 + 0.25, 0.25, 6) }) })
    m.set(lt > tW[2] ? 'happy' : 'sad', lt)
    m.say('PSIU, EU SEI!', env(lt, tW[2] + 0.4, tW[2] + 10, 0.2, 0.1))
    tf(m.box, { ...pop(lt, tD + 0.2, 0.5) })
  }
})

// ---- 3. reveal ----
scene('reveal', 'A SOLUÇÃO', (root) => {
  const q = words(root, 'E se jogar o lixo fora\nfosse… <span class="pix" style="color:#8fe39a;font-size:84px">UM JOGO?</span>', 'abs h1')
  Object.assign(q.style, { left: 0, right: 0, top: '300px', textAlign: 'center', fontSize: '84px' })
  const glow = el('div', 'abs', root, '', { left: '560px', top: '40px', width: '800px', height: '800px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(143,227,154,.3), rgba(143,227,154,0) 62%)' })
  const m = Mascot(root, 220, 850, 140)
  const plate = el('div', 'abs', root, `<div class="plate" style="font-size:72px">RANK ${EYES_LOGO(120)} TRASH</div>`, { left: 0, right: 0, top: '470px', textAlign: 'center' })
  const sub = el('div', 'abs pix', root, 'DESCARTE CERTO · GANHE PONTOS · SUBA NO RANKING', { left: 0, right: 0, top: '680px', textAlign: 'center', fontSize: '22px', color: '#fde8b0' })
  const R = rng(11)
  const confetti = Array.from({ length: 40 }, () => ({ e: el('div', 'abs', root, R() < 0.5 ? icon('star', 20 + Math.floor(R() * 22), ['#f5c518', '#8fe39a', '#fde8b0', '#f4a259'][Math.floor(R() * 4)]) : `<div style="width:16px;height:16px;background:${['#e0413a', '#3d8fd1', '#f5c518', '#8fe39a'][Math.floor(R() * 4)]}"></div>`, { left: '950px', top: '560px' }), a: -Math.PI * (0.05 + R() * 0.9), v: 700 + R() * 900, r: R() * 720 }))
  const tR = WT('reveal', 'Apresentamos')
  cue(tR,'fall',0.6); cue(tR+0.45,'thud',0.9); cue(tR+0.55,'impact',1); cue(tR+0.75,'sparkle',0.8)
  return (lt) => {
    wordsIn(q, lt, 0.1, 0.07, 0.4, tR - 0.25)
    const tL = tR + 0.55
    tf(glow, { o: ease(lt, tL, tL + 0.4) * (0.75 + 0.25 * Math.sin(lt * 4)), s: 0.9 + 0.1 * Math.sin(lt * 4) })
    m.set(lt > tL + 0.3 ? 'happy' : 'look', lt)
    tf(m.box, { y: (1 - ease(lt, tR, tR + 0.45, E.back)) * -500 - bump(lt, tL + 0.6, 0.35) * 50, o: P(lt, tR, tR + 0.05) })
    tf(plate, { s: 2.2 - 1.2 * ease(lt, tL, tL + 0.25, E.out5), o: P(lt, tL, tL + 0.06), ...shake(lt, tL + 0.22, 0.45, 18) })
    tf(sub, { o: ease(lt, tL + 0.5, tL + 0.8), y: (1 - ease(lt, tL + 0.5, tL + 0.8)) * 20 })
    confetti.forEach((c) => { const t = clamp(lt - tL - 0.2, 0, 3); tf(c.e, { x: Math.cos(c.a) * c.v * t, y: Math.sin(c.a) * c.v * t + 1100 * t * t, r: c.r * t, o: lt > tL + 0.2 && t < 2.2 ? 1 : 0 }) })
  }
})

// ---- 4. upx ----
scene('upx', 'NOSSO PROJETO', (root) => {
  const badge = el('div', 'abs', root, `<div class="big-pix" style="font-size:96px;color:#f4a259">UPX</div>`, { left: '170px', top: '200px' })
  const l1 = el('div', 'abs h2', root, '2º semestre ·<br><span class="hl">Engenharia da Computação</span>', { left: '170px', top: '380px', fontSize: '60px' })
  const l2 = el('div', 'abs h3', root, 'Facens · apoio à campanha Lixo Zero', { left: '172px', top: '560px', fontWeight: 500, color: '#8fb2d9' })
  const note = el('div', 'abs pix', root, 'PROJETO ACADÊMICO · AINDA NÃO É UM APP OFICIAL DA FACENS', { left: '172px', top: '660px', fontSize: '14px', color: '#8fb2d9' })
  // team "player select"
  const COL = ['#f4a259', '#8fe39a', '#7cc3f5', '#f5c518', '#ff6b62', '#fde8b0']
  const team = COL.map((c, i) => el('div', 'abs', root, `<div style="width:150px;height:150px;background:#0b1e3a;border:5px solid ${c};box-shadow:6px 6px 0 #0a0f1f;display:grid;place-items:center">${icon('user', 80, c)}</div><div class="pix" style="margin-top:10px;text-align:center;font-size:13px;color:${c}">P${i + 1}</div>`, { left: 1120 + (i % 3) * 190 + 'px', top: 230 + Math.floor(i / 3) * 230 + 'px' }))
  const ready = el('div', 'abs big-pix', root, 'EQUIPE PRONTA!', { left: '1125px', top: '730px', fontSize: '28px', color: '#8fe39a' })
  const tS = WT('upx', 'segundo semestre'), tF = WT('upx', 'Facens'), tL = WT('upx', 'Lixo Zero')
  cue(0.15,'slam',0.8); for(let i=0;i<6;i++) cue(0.4+i*0.12,'blip',0.4); cue(2.3,'powerup',0.6); cue(tS,'swish',0.5)
  return (lt) => {
    tf(badge, { ...pop(lt, 0.15, 0.5), r: (1 - ease(lt, 0.15, 0.6)) * -12 })
    tf(l1, { o: ease(lt, tS - 0.1, tS + 0.2), x: (1 - ease(lt, tS - 0.1, tS + 0.4, E.back)) * -80 })
    tf(l2, { o: ease(lt, tF - 0.1, tF + 0.2), x: (1 - ease(lt, tF - 0.1, tF + 0.4, E.back)) * -80 })
    tf(note, { o: ease(lt, tL, tL + 0.3) })
    team.forEach((t, i) => { const t0 = 0.4 + i * 0.12; const p = pop(lt, t0, 0.4); tf(t, { s: p.s, o: p.o, y: -bump(lt, 2.6 + i * 0.1, 0.3) * 30 }) })
    tf(ready, { o: lt > 2.3 && Math.floor(lt * 3) % 2 === 0 ? 1 : lt > 3.4 ? 1 : 0 })
  }
})

// ---- 5. steps ----
scene('steps', 'COMO FUNCIONA', (root) => {
  const title = words(root, 'Funciona assim:', 'abs h1')
  Object.assign(title.style, { left: 0, right: 0, top: '140px', textAlign: 'center', fontSize: '76px' })
  const STEPS = [['map', 'VÁ ATÉ\nA LIXEIRA', '#f4a259', 'até uma lixeira'], ['camera', 'TIRE UMA\nFOTO', '#7cc3f5', 'tira uma foto'], ['target', 'A IA\nRECONHECE', '#8fe39a', 'inteligência'], ['shield', 'O GPS\nCONFIRMA', '#fde8b0', 'o GPS'], ['star', 'PONTOS\nNA CONTA!', '#f5c518', 'pontos na conta']]
  const line = el('div', 'abs', root, '', { left: '260px', top: '505px', width: '1400px', height: '6px', background: 'repeating-linear-gradient(90deg,#3d8fd1 0 18px,transparent 18px 30px)', transformOrigin: '0 50%' })
  const cards = STEPS.map(([ic, t, c], i) => el('div', 'abs', root, `<div style="width:190px;height:190px;margin:0 auto;display:grid;place-items:center;background:#0b1e3a;border:6px solid ${c};box-shadow:8px 8px 0 #0a0f1f">${icon(ic, 100, c)}</div>
      <div class="pix" style="margin-top:34px;text-align:center;font-size:19px;line-height:1.6;color:#fff;white-space:pre">${t}</div>
      <div class="pix" style="position:absolute;left:50%;top:-22px;margin-left:-26px;width:52px;padding:8px 0;text-align:center;font-size:16px;background:${c};color:#0a0f1f;box-shadow:4px 4px 0 #0a0f1f">0${i + 1}</div>`, { left: 175 + i * 330 + 'px', top: '400px', width: '260px' }))
  const m = Mascot(root, 90, 0, 0)
  const at = STEPS.map((s) => WT('steps', s[3]) - 0.1)
  const R = rng(3)
  const coins = Array.from({ length: 14 }, () => ({ e: el('div', 'abs', root, '<div style="width:30px;height:30px;background:#f5c518;border:4px solid #0a0f1f;box-shadow:inset -5px -5px 0 #c9972b"></div>', { left: '1550px', top: '420px' }), a: -Math.PI * (0.1 + R() * 0.8), v: 400 + R() * 500 }))
  at.forEach((t,i)=>{cue(t,'pop',0.75); if(i) cue(t,'jump',0.5)}); cue(at[4]+0.3,'coin',0.9)
  return (lt) => {
    wordsIn(title, lt, 0.05, 0.08)
    tf(line, { sx: ease(lt, at[0], at[4] + 0.3, E.io) })
    cards.forEach((c, i) => {
      const p = ease(lt, at[i], at[i] + 0.45, E.back)
      tf(c, { y: (1 - p) * 140, s: (0.5 + 0.5 * p) * (1 + bump(lt, at[i] + 0.4, 0.3) * 0.06), o: P(lt, at[i], at[i] + 0.1) })
    })
    // mascot hops from card to card
    let k = -1; at.forEach((a, i) => { if (lt >= a) k = i })
    const from = Math.max(0, k), hop = k >= 0 ? P(lt, at[k], at[k] + 0.35) : 0
    const x0 = 175 + Math.max(0, k - 1) * 330 + 85, x1 = 175 + from * 330 + 85
    const x = k <= 0 ? x1 : lerp(x0, x1, hop)
    m.set(k === 4 ? 'happy' : 'idle', lt)
    tf(m.box, { x, y: 270 - Math.sin(hop * Math.PI) * 90 * (k > 0 ? 1 : 0), o: k >= 0 ? 1 : 0 })
    coins.forEach((q) => { const t = clamp(lt - at[4] - 0.3, 0, 3); tf(q.e, { x: Math.cos(q.a) * q.v * t, y: Math.sin(q.a) * q.v * t + 900 * t * t, r: t * 400, o: t > 0 && t < 1.4 ? 1 : 0 }) })
  }
})

// ---- 6. microsoft ----
scene('microsoft', 'LOGIN MICROSOFT', (root) => {
  const ph = Phone(root)
  const ms = el('div', 'abs', ph.ov, `
    <div style="position:absolute;inset:0;background:#f3f3f3"></div>
    <div style="position:absolute;left:0;right:0;top:40px;height:44px;background:#e9e9e9;display:flex;align-items:center;justify-content:center;font:500 15px Inter;color:#333">🔒 login.microsoftonline.com</div>
    <div style="position:absolute;left:26px;right:26px;top:150px;background:#fff;padding:34px 30px;box-shadow:0 2px 8px rgba(0,0,0,.15);font-family:Inter">
      <div style="margin-bottom:22px">${MSLOGO(14)}</div>
      <div style="font:600 24px Inter;color:#1b1b1b;margin-bottom:22px">Entrar</div>
      <div class="msmail" style="border-bottom:2px solid #0067b8;padding:6px 0;font:400 17px Inter;color:#1b1b1b;height:34px"></div>
      <div style="font:400 13px Inter;color:#0067b8;margin:16px 0 26px">Conta corporativa ou de estudante</div>
      <div style="display:flex;justify-content:flex-end"><span class="msbtn" style="background:#0067b8;color:#fff;font:600 15px Inter;padding:9px 30px">Avançar</span></div>
    </div>`, { inset: 0 })
  const mail = ms.querySelector('.msmail')
  const node = (x, y, inner, w) => el('div', 'card', root, inner, { left: x + 'px', top: y + 'px', width: w + 'px', textAlign: 'center', padding: '22px 14px' })
  const n1 = node(790, 170, `<div style="display:flex;justify-content:center">${mascotSvg('idle', 60)}</div><div class="pix" style="margin-top:14px;font-size:15px;color:#fde8b0">RANKTRASH</div>`, 250)
  const n2 = node(1125, 150, `<div style="display:flex;justify-content:center">${MSLOGO(34)}</div><div style="margin-top:14px;font:700 26px Grotesk;color:#fff">Microsoft da Facens</div><div style="font:400 18px Inter;color:#8fb2d9;margin-top:4px">login oficial · Entra ID</div>`, 340)
  const n3 = node(1540, 170, `<div style="display:flex;justify-content:center">${icon('check', 60, '#8fe39a')}</div><div class="pix" style="margin-top:14px;font-size:15px;color:#8fe39a">@FACENS.BR</div>`, 250)
  const ar1 = el('div', 'abs', root, '', { left: '1046px', top: '246px', width: '74px', height: '6px', background: '#8fe39a', transformOrigin: '0 50%' })
  const ar2 = el('div', 'abs', root, '', { left: '1471px', top: '246px', width: '64px', height: '6px', background: '#8fe39a', transformOrigin: '0 50%' })
  const CH = [['cross', 'Sem cadastro, sem senha nova', 'nada de cadastro'], ['shield', 'Login na página oficial da Microsoft', 'página oficial'], ['check', 'Só entra quem é @facens.br', 'Só entra'], ['target', 'A senha nunca passa pelo app', 'senha nunca']]
  const chips = CH.map(([ic, t], i) => el('div', 'chip', root, `<span class="ic">${icon(ic, 28, '#0a0f1f')}</span>${t}`, { left: '800px', top: 420 + i * 92 + 'px' }))
  const stamp = el('div', 'stamp', root, '1 PONTO = 1 ALUNO REAL', { left: '820px', top: '800px', color: '#f5c518', fontSize: '26px', zIndex: 6 })
  const at = CH.map((c) => WT('microsoft', c[2]))
  const tLogin = WT('microsoft', 'O login'), tTap = tLogin + 0.5, tMs = WT('microsoft', 'página oficial') - 0.3, tBack = WT('microsoft', 'senha nunca'), tReal = WT('microsoft', 'aluno de verdade') - 0.4
  cue(0.05,'swish',0.6); cue(tTap,'tap',0.9); cue(tMs,'swish',0.5); for(let i=0;i<15;i++) cue(tMs+0.4+i/14,'key',0.25); cue(tBack+0.4,'success',0.6); at.forEach(t=>cue(t,'blip',0.5)); cue(tReal,'stamp',0.9)
  return (lt) => {
    // camera: in, zoom on button, tap, MS page, back to map
    const A = [195, 460, 0.86, 420, 520], Z = [195, 458, 1.55, 420, 520]
    const zk = env(lt, tLogin - 0.6, tMs + 0.1, 0.5, 0.4)
    focusMix(ph, A, Z, zk, { ry: 6 * Math.sin(lt * 0.7), o: P(lt, 0, 0.2) })
    if (lt < 0.6) ph.place(ph.x, ph.y + (1 - ease(lt, 0, 0.6, E.out5)) * 700, ph.s, { o: 1 })
    if (lt < tMs) ph.show(seq('login', lt))
    else ph.show(still('login'), seq('map', lt - tBack), ease(lt, tBack + 0.4, tBack + 0.7))
    ph.tapAt(lt, tTap, 195, 458)
    ms.style.opacity = env(lt, tMs, tBack + 0.6, 0.3, 0.3)
    tf(ms, { y: (1 - ease(lt, tMs, tMs + 0.4)) * 80 })
    const typed = 'aluno@facens.br'.slice(0, Math.floor(clamp((lt - tMs - 0.4) * 14, 0, 15)))
    mail.textContent = typed + (lt % 0.8 < 0.4 && typed.length < 15 ? '|' : '')
    ;[n1, n2, n3].forEach((n, i) => { const t0 = [0.3, tLogin, at[2] - 0.2][i]; const p = pop(lt, t0, 0.45); tf(n, { s: p.s, o: p.o }) })
    tf(ar1, { sx: ease(lt, tLogin + 0.2, tLogin + 0.5) })
    tf(ar2, { sx: ease(lt, at[2], at[2] + 0.3) })
    chips.forEach((ch, i) => tf(ch, { o: P(lt, at[i], at[i] + 0.1), x: (1 - ease(lt, at[i], at[i] + 0.4, E.back)) * 160 }))
    tf(stamp, { o: P(lt, tReal, tReal + 0.06), s: 2 - ease(lt, tReal, tReal + 0.22, E.out5), r: -4, ...shake(lt, tReal + 0.2, 0.35, 10) })
  }
})

// ---- 7. map ----
scene('map', 'O MAPA', (root) => {
  const ph = Phone(root)
  const ttl = words(root, 'Todas as lixeiras\ndo campus.', 'abs h1')
  Object.assign(ttl.style, { left: '1010px', top: '190px', fontSize: '76px' })
  const c1 = el('div', 'callout red', root, 'INEXPLORADA!<small>bônus na 1ª visita</small>', { left: '1010px', top: '470px', fontSize: '22px' })
  const c2 = el('div', 'callout green', root, 'JÁ VISITADA<small>você já descartou aqui</small>', { left: '1010px', top: '610px', fontSize: '22px' })
  const c3 = el('div', 'callout', root, 'AO VIVO!<small>o que a galera está descartando</small>', { left: '1010px', top: '470px', fontSize: '22px' })
  const bonus = el('div', 'abs big-pix', root, '+5', { left: '1500px', top: '440px', fontSize: '70px', color: '#f5c518' })
  const tR = WT('map', 'vermelhas'), tL = WT('map', 'letreiro')
  cue(tR-0.3,'zoom',0.6); cue(tR,'blip',0.6); cue(tR+0.5,'coin',0.7); cue(tR+1.1,'blip',0.5); cue(tL-0.3,'zoom',0.6); cue(tL,'blip',0.6)
  return (lt) => {
    const A = [195, 420, 0.86, 560, 520], B = [250, 360, 1.45, 560, 470], C = [195, 750, 1.6, 560, 520]
    if (lt < tR - 0.3) focusMix(ph, [195, 420, 0.7, 560, 520], A, ease(lt, 0, 0.6, E.out5))
    else if (lt < tL - 0.3) focusMix(ph, A, B, ease(lt, tR - 0.3, tR + 0.3, E.io))
    else focusMix(ph, B, C, ease(lt, tL - 0.3, tL + 0.3, E.io))
    ph.show(seq('map', lt, 0.6))
    wordsIn(ttl, lt, 0.2, 0.06, 0.45)
    const o12 = 1 - ease(lt, tL - 0.4, tL - 0.1)
    tf(c1, { o: P(lt, tR, tR + 0.1) * o12, x: (1 - ease(lt, tR, tR + 0.4, E.back)) * 120 })
    tf(bonus, { ...pop(lt, tR + 0.5), o: P(lt, tR + 0.5, tR + 0.55) * o12, y: Math.sin(lt * 6) * 6 })
    tf(c2, { o: P(lt, tR + 1.1, tR + 1.2) * o12, x: (1 - ease(lt, tR + 1.1, tR + 1.5, E.back)) * 120 })
    tf(c3, { o: P(lt, tL, tL + 0.1), x: (1 - ease(lt, tL, tL + 0.4, E.back)) * 120 })
  }
})

// ---- 8. camera ----
scene('camera', 'DESCARTAR', (root) => {
  const ph = Phone(root)
  const ttl = words(root, 'Achou a lixeira?\n<span class="hl">Abre a câmera.</span>', 'abs h1')
  Object.assign(ttl.style, { left: '1090px', top: '170px', fontSize: '74px' })
  const labels = [['LIXEIRA MAIS PRÓXIMA', 'mais perto', '#fde8b0'], ['DISTÂNCIA: 0 m', 'distância', '#8fe39a'], ['PRECISÃO: ±6 m', 'precisão', '#7cc3f5']]
    .map(([t, w, c], i) => [el('div', 'chip', root, `<span class="ic" style="background:${c}">${icon(['bin', 'map', 'target'][i], 28, '#0a0f1f')}</span>${t}`, { left: '1090px', top: 470 + i * 100 + 'px' }), w])
  const rings = [0, 1, 2].map(() => el('div', 'abs', root, '', { left: '1700px', top: '720px', width: '120px', height: '120px', marginLeft: '-60px', marginTop: '-60px', borderRadius: '50%', border: '4px solid #8fe39a' }))
  const tCam = WT('camera', 'Abre a câmera'), tG = WT('camera', 'O GPS')
  const at = labels.map(([, w]) => WT('camera', w))
  cue(tCam-0.3,'swish',0.7); cue(tG-0.2,'zoom',0.6); at.forEach(t=>cue(t,'blip',0.5)); cue(tG,'radar',0.5)
  return (lt) => {
    const A = [195, 420, 0.86, 520, 520], Z = [120, 85, 1.9, 480, 330]
    const zk = env(lt, tG - 0.2, at[2] + 1.2, 0.5, 0.5)
    const enter = ease(lt, tCam - 0.3, tCam + 0.3, E.out5)
    focusMix(ph, A, Z, zk, { r: (1 - enter) * -10 })
    if (lt < tCam - 0.3) ph.place(ph.x, ph.y + 900, ph.s)
    else if (lt < tCam + 0.3) ph.place(ph.x, ph.y + (1 - enter) * 900, ph.s, { r: (1 - enter) * -10 })
    ph.show(seq('camera', lt - tCam, 0.45))
    wordsIn(ttl, lt, 0.05, 0.06)
    labels.forEach(([e], i) => tf(e, { o: P(lt, at[i], at[i] + 0.1), x: (1 - ease(lt, at[i], at[i] + 0.4, E.back)) * 140 }))
    rings.forEach((r, i) => { const q = ((lt + i * 0.6) % 1.8) / 1.8; tf(r, { s: 0.3 + q * 1.4, o: lt > tG ? (1 - q) * 0.8 : 0 }) })
  }
})

// ---- 9. ai (smooth custom scanner over the captured photo) ----
scene('ai', 'INTELIGÊNCIA ARTIFICIAL', (root) => {
  const ph = Phone(root)
  // overlay inside the phone screen (screen coords = 7 + ax*APP, 40 + ay*APP)
  const sx = (ax) => 7 + ax * APP, sy = (ay) => 40 + ay * APP
  const ov = el('div', 'abs', ph.ov, '', { inset: 0 })
  const tint = el('div', 'abs', ov, '', { left: sx(14) + 'px', top: sy(68) + 'px', width: 362 * APP + 'px', height: 574 * APP + 'px', background: 'rgba(11,30,58,.25)', backgroundImage: 'linear-gradient(rgba(143,227,154,.18) 1px, transparent 1px), linear-gradient(90deg, rgba(143,227,154,.18) 1px, transparent 1px)', backgroundSize: '28px 28px' })
  const line = el('div', 'scanline', ov, '', { left: sx(14) + 'px', width: 362 * APP + 'px', right: 'auto' })
  const boxCan = el('div', 'detbox', ov, '<b>LATA · 97%</b>', { left: sx(180) + 'px', top: sy(118) + 'px', width: 100 * APP + 'px', height: 160 * APP + 'px' })
  const boxBin = el('div', 'detbox', ov, '<b>LIXEIRA METAL</b>', { left: sx(78) + 'px', top: sy(292) + 'px', width: 246 * APP + 'px', height: 345 * APP + 'px', borderColor: '#f5c518' })
  boxBin.querySelector('b').style.background = '#f5c518'
  const bar = el('div', 'abs', ov, `${mascotSvg('look', 34)}<span class="pix" style="font-size:12px;color:#fff;margin-left:12px">ANALISANDO RESÍDUO…</span>`, { left: sx(14) + 'px', top: sy(645) + 'px', width: 362 * APP + 'px', height: 70 * APP + 'px', background: '#0b1e3a', display: 'flex', alignItems: 'center', justifyContent: 'center', borderTop: '4px solid #3d8fd1' })
  // AI panel
  const panel = el('div', 'card', root, '', { left: '940px', top: '160px', width: '820px', padding: '30px 36px' })
  el('div', '', panel, `<div style="display:flex;align-items:center;gap:16px"><svg class="spark" width="48" height="48" viewBox="0 0 24 24"><path d="M12 1 C13 7 17 11 23 12 C17 13 13 17 12 23 C11 17 7 13 1 12 C7 11 11 7 12 1Z" fill="url(#gg)"/><defs><linearGradient id="gg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4f8df5"/><stop offset=".6" stop-color="#9b72e8"/><stop offset="1" stop-color="#e8738a"/></linearGradient></defs></svg>
    <div><div style="font:700 36px Grotesk;color:#fff">Análise por IA</div><div style="font:400 20px Inter;color:#8fb2d9">Google Gemini · leitura da foto</div></div></div>`)
  const spark = panel.querySelector('.spark')
  const rows = [['ITEM', 'Lata de refrigerante', 'item'], ['MATERIAL', 'Alumínio', 'material'], ['ESTADO', 'Amassada', 'amassada'], ['FOTO DE TELA?', 'Não', 'amassada'], ['CONFIANÇA', '', 'amassada']]
  const rEls = rows.map(([k]) => el('div', '', panel, `<span class="pix" style="font-size:15px;color:#8fb2d9;display:inline-block;width:250px">${k}</span><span class="v vt" style="font-size:44px;color:#8fe39a"></span>`, { marginTop: '22px', display: 'flex', alignItems: 'center' }))
  const barW = el('div', '', rEls[4].querySelector('.v'), '', { display: 'inline-block', width: '380px', height: '26px', background: '#16335e', verticalAlign: 'middle', position: 'relative' })
  const fill = el('div', '', barW, '', { position: 'absolute', left: 0, top: 0, bottom: 0, width: '0', background: 'linear-gradient(90deg,#5fb96a,#8fe39a)' })
  const pc = el('span', 'vt', rEls[4].querySelector('.v'), '', { marginLeft: '16px', fontSize: '44px', color: '#8fe39a' })
  const fast = el('div', 'stamp', root, 'EM SEGUNDOS!', { left: '1290px', top: '760px', color: '#fde8b0', fontSize: '24px' })
  const tClick = WT('ai', 'Clique'), tShot = tClick + 0.25
  const at = [WT('ai', 'analisa') + 0.3, WT('ai', 'qual é o material'), WT('ai', 'amassada'), WT('ai', 'amassada') + 0.4, WT('ai', 'amassada') + 0.8]
  const tSec = WT('ai', 'em segundos')
  cue(tClick,'tap',0.8); cue(tShot,'shutter',1); cue(tShot+0.3,'scan',0.7); cue(at[0],'detect',0.7); cue(at[1],'detect',0.7); for(let i=0;i<5;i++) cue(at[i],'key',0.3); cue(tSec,'stamp',0.8)
  return (lt) => {
    const kk = bump(lt, tShot, 0.3) * 0.04
    ph.focus(195, 420, 0.86 + kk, 560, 520, {})
    ph.tapAt(lt, tClick, 110, 660)
    ph.flashAt(lt, tShot)
    ph.show(lt < tShot ? seq('camera', 2.5 + lt) : still('preview'))
    const scanning = lt > tShot + 0.3
    ov.style.opacity = scanning ? 1 : 0
    const sp = ((lt - tShot) % 1.6) / 1.6, yy = 68 + (Math.sin(sp * Math.PI * 2 - Math.PI / 2) * 0.5 + 0.5) * 570
    line.style.top = sy(yy) + 'px'
    tint.style.opacity = 0.9
    tf(boxCan, { ...pop(lt, at[0], 0.35) })
    tf(boxBin, { ...pop(lt, at[1], 0.35) })
    tf(panel, { o: ease(lt, 0.2, 0.5), x: (1 - ease(lt, 0.2, 0.7, E.back)) * 100 })
    spark.style.transform = `rotate(${lt * 90}deg) scale(${1 + 0.15 * Math.sin(lt * 6)})`
    rows.forEach(([k, v], i) => {
      tf(rEls[i], { o: ease(lt, at[i] - 0.1, at[i] + 0.1) })
      if (v) { const n = Math.floor(clamp((lt - at[i]) * 32, 0, v.length)); rEls[i].querySelector('.v').textContent = v.slice(0, n) + (n < v.length && n > 0 ? '█' : '') }
    })
    const cp = ease(lt, at[4], at[4] + 0.8)
    fill.style.width = cp * 97 + '%'; pc.textContent = Math.round(cp * 97) + '%'
    tf(fast, { o: P(lt, tSec, tSec + 0.06), s: 1.6 - 0.6 * ease(lt, tSec, tSec + 0.25, E.out5), r: -5 })
  }
})

// ---- 10. result ----
scene('result', 'RESULTADO', (root) => {
  const ph = Phone(root)
  const val = el('div', 'stamp', root, 'DESCARTE VALIDADO!', { left: '940px', top: '160px', color: '#8fe39a', fontSize: '34px' })
  const pts = el('div', 'abs big-pix', root, '+15', { left: '960px', top: '290px', fontSize: '170px', color: '#8fe39a', textShadow: '10px 10px 0 #0a0f1f' })
  const ptsL = el('div', 'abs pix', root, 'PONTOS', { left: '1540px', top: '400px', fontSize: '34px', color: '#fff' })
  const R = rng(5)
  const coins = Array.from({ length: 22 }, () => ({ e: el('div', 'abs', root, '<div style="width:34px;height:34px;background:#f5c518;border:4px solid #0a0f1f;box-shadow:inset -6px -6px 0 #c9972b"></div>', { left: '1150px', top: '360px' }), a: -Math.PI * (0.1 + R() * 0.8), v: 500 + R() * 700, sp: R() * 720 }))
  const yel = el('div', 'card', root, `<div style="display:flex;align-items:center;gap:22px"><div style="width:64px;height:64px;background:#f5c518;border:4px solid #0a0f1f;flex:none"></div><div><div class="pix" style="font-size:15px;color:#8fb2d9">LATA VAI NA LIXEIRA</div><div style="font:700 44px Grotesk;color:#f5c518;margin-top:6px">AMARELA · metal</div></div></div>`, { left: '940px', top: '560px', width: '760px' })
  const aula = el('div', 'card cream', root, `<div style="display:flex;align-items:center;gap:22px">${mascotSvg('happy', 64)}<div style="font:700 36px Grotesk;color:#0a0f1f">Cada descarte vira uma<br>mini aula de educação ambiental</div></div>`, { left: '940px', top: '730px', width: '760px' })
  const tP = WT('result', 'Mais 15'), tY = WT('result', 'amarela'), tA = WT('result', 'mini aula')
  cue(0.1,'stamp',0.8); cue(0.12,'success',0.7); cue(tP-0.1,'coin',1); cue(tP,'coins',0.8); cue(tY-0.5,'zoom',0.6); cue(tY-0.2,'blip',0.6); cue(tA-0.2,'blip',0.6)
  return (lt) => {
    const A = [195, 300, 0.86, 560, 520], Z = [195, 410, 1.9, 560, 500]
    focusMix(ph, A, Z, env(lt, tY - 0.5, tA + 0.2, 0.45, 0.45))
    ph.flashAt(lt, 0)
    ph.show(seq('result', lt))
    tf(val, { o: P(lt, 0.1, 0.16), s: 1.8 - 0.8 * ease(lt, 0.1, 0.32, E.out5), r: -4, ...shake(lt, 0.3, 0.3, 8) })
    const p = pop(lt, tP - 0.1, 0.5)
    tf(pts, { s: p.s * (1 + bump(lt, tP + 0.5, 0.25) * 0.08), o: p.o, r: (1 - ease(lt, tP - 0.1, tP + 0.4)) * -12 })
    tf(ptsL, { o: ease(lt, tP + 0.2, tP + 0.4) })
    coins.forEach((q) => { const t = clamp(lt - tP, 0, 3); tf(q.e, { x: Math.cos(q.a) * q.v * t, y: Math.sin(q.a) * q.v * t + 1000 * t * t, r: q.sp * t, o: lt > tP && t < 1.6 ? 1 : 0 }) })
    tf(yel, { o: P(lt, tY - 0.2, tY - 0.1), x: (1 - ease(lt, tY - 0.2, tY + 0.25, E.back)) * 160 })
    tf(aula, { o: P(lt, tA - 0.2, tA - 0.1), x: (1 - ease(lt, tA - 0.2, tA + 0.25, E.back)) * 160 })
  }
})

// ---- 11. antifraud ----
scene('antifraud', 'JOGO LIMPO', (root) => {
  const ph = Phone(root)
  const rej = el('div', 'stamp', root, 'RECUSADO', { left: '330px', top: '430px', color: '#ff4b42', fontSize: '50px', zIndex: 7 })
  const ttl = words(root, 'Nem adianta\n<span class="hlo">trapacear!</span>', 'abs h1')
  Object.assign(ttl.style, { left: '960px', top: '140px', fontSize: '80px' })
  const m = Mascot(root, 110, 1660, 190, 'left')
  const L = [['camera', 'Foto repetida? Reconhecida.', 'Foto repetida'], ['phone', 'Foto da tela? Recusada.', 'Foto da tela'], ['flame', 'Limite de registros por dia', 'limite'], ['shield', 'Pontos calculados no servidor', 'servidor'], ['user', 'Auditoria do top 10', 'auditoria']]
  const items = L.map(([ic, t], i) => el('div', 'chip', root, `<span class="ic" style="background:${i === 4 ? '#f4a259' : '#5fb96a'}">${icon(ic, 28, '#0a0f1f')}</span>${t}`, { left: '960px', top: 410 + i * 92 + 'px', fontSize: '28px' }))
  const at = L.map((l) => WT('antifraud', l[2]))
  const tStamp = at[0] + 0.8
  cue(0.6,'error',0.6); cue(tStamp,'stamp',1); cue(tStamp,'error',0.8); at.forEach(t=>cue(t-0.1,'pop',0.6))
  return (lt) => {
    const sh = shake(lt, tStamp + 0.15, 0.4, 16)
    ph.focus(195, 300, 0.86, 560 + sh.x, 520 + sh.y)
    ph.show(still('result2'))
    tf(rej, { o: P(lt, tStamp, tStamp + 0.05), s: 2.4 - 1.4 * ease(lt, tStamp, tStamp + 0.2, E.out5), r: -12 })
    wordsIn(ttl, lt, 0.05, 0.08)
    m.set('angry', lt)
    m.say('NEM VEM!', env(lt, 0.6, at[0] - 0.1, 0.2, 0.2))
    tf(m.box, { ...pop(lt, 0.3), y: -bump(lt, 0.6, 0.3) * 30 })
    items.forEach((it, i) => tf(it, { o: P(lt, at[i] - 0.1, at[i]), x: (1 - ease(lt, at[i] - 0.1, at[i] + 0.3, E.back)) * 160 }))
  }
})

// ---- 12. ranking ----
scene('ranking', 'RANKING', (root) => {
  const ph = Phone(root), ph2 = Phone(root)
  const ttl = words(root, 'Que comece\na <span class="hly">competição!</span>', 'abs h2')
  Object.assign(ttl.style, { left: '1240px', top: '150px', fontSize: '62px' })
  const pod = [[2, '#cfd6df', 160], [1, '#f5c518', 230], [3, '#f4a259', 110]].map(([n, col, h], i) => el('div', 'abs', root,
    `<div style="display:flex;justify-content:center;margin-bottom:12px">${icon('trophy', 54, col)}</div><div style="height:${h}px;background:${col};border:5px solid #0a0f1f;box-shadow:8px 8px 0 #0a0f1f;display:grid;place-items:center" class="pix"><span style="font-size:34px;color:#0a0f1f">${n}º</span></div>`, { left: 1260 + i * 160 + 'px', top: 690 - h + 'px', width: '140px', transformOrigin: '50% 100%' }))
  const tags = ['MENSAL · COM PRÊMIOS', 'GUERRA DE CURSOS', 'RANKING DA SEMANA'].map((t, i) => el('div', 'sticker', root, t, { left: '1260px', top: '770px', fontSize: '18px', background: ['#f5c518', '#f4a259', '#8fe39a'][i] }))
  const tM = WT('ranking', 'ranking mensal'), tC = WT('ranking', 'guerra'), tS = WT('ranking', 'da semana')
  cue(0.05,'swish',0.6); cue(tM,'powerup',0.6); cue(tC-0.3,'swish',0.7); cue(tS-0.2,'tap',0.7)
  return (lt) => {
    const e1 = ease(lt, 0, 0.5, E.out5)
    ph.focus(195, 420, 0.82, 400, 520 + (1 - e1) * 700, { r: (1 - e1) * 6 })
    ph.show(lt < 2.2 ? seq('ranking', lt) : seq('ranking-scroll', lt - 2.2))
    const p2 = ease(lt, tC - 0.3, tC + 0.2, E.out5)
    ph2.focus(195, 420, 0.82, 850 + (1 - p2) * 1300, 520, { o: P(lt, tC - 0.3, tC - 0.2), r: (1 - p2) * -8 })
    ph2.show(still('ranking-cursos'), still('ranking-semana'), ease(lt, tS, tS + 0.25))
    ph2.tapAt(lt, tS - 0.2, 340, 120)
    wordsIn(ttl, lt, 0.05, 0.08)
    pod.forEach((d, i) => { const t0 = tM + [0.2, 0, 0.4][i]; tf(d, { sy: ease(lt, t0, t0 + 0.45, E.back), o: P(lt, t0, t0 + 0.05) }) })
    const tt = [tM, tC, tS]
    tags.forEach((g, i) => tf(g, { o: env(lt, tt[i], tt[i + 1] ?? 99, 0.1, 0.1), s: 1 + bump(lt, tt[i], 0.3) * 0.2 }))
  }
})

// ---- 13. profile ----
scene('profile', 'PERFIL', (root) => {
  const ph = Phone(root)
  const lvl = el('div', 'abs big-pix', root, 'LEVEL UP!', { left: '960px', top: '150px', fontSize: '76px', color: '#f5c518' })
  const C = [['flame', 'SEQUÊNCIA', 'dias seguidos', '#f4a259', 'sequência'], ['trophy', 'CONQUISTAS', 'medalhas pixel', '#7cc3f5', 'conquistas'], ['check', 'IMPACTO', 'itens e kg fora do aterro', '#8fe39a', 'impacto']]
  const cards = C.map(([ic, t, s, col]) => el('div', 'card', root, `<div style="display:flex;align-items:center;gap:22px">${icon(ic, 56, col)}<div><div class="pix" style="font-size:20px;color:${col}">${t}</div><div style="font:500 26px Inter;color:#8fb2d9;margin-top:8px">${s}</div></div></div>`, { width: '440px' }))
  const kgN = el('div', 'abs big-pix', root, '', { left: '1480px', top: '540px', fontSize: '58px', color: '#8fe39a' })
  const kgL = el('div', 'abs pix', root, 'KG FORA DO ATERRO', { left: '1480px', top: '625px', fontSize: '15px', color: '#fde8b0' })
  const tL = WT('profile', 'sobe de nível'), at = C.map((c) => WT('profile', c[4])), tK = WT('profile', 'quilos')
  cue(tL,'levelup',0.9); at.forEach(t=>cue(t-0.1,'pop',0.55)); cue(tK,'countdown',0.4)
  return (lt) => {
    ph.focus(195, 420, 0.86, 520, 520)
    ph.show(seq('perfil-scroll', clamp(lt - at[1], 0, 99) * 0.9))
    tf(lvl, { o: P(lt, tL, tL + 0.05), s: (1.8 - 0.8 * ease(lt, tL, tL + 0.3, E.out5)) * (1 + 0.04 * Math.sin(lt * 10)), r: -3 })
    cards.forEach((cd, i) => { cd.style.left = '960px'; cd.style.top = 330 + i * 160 + 'px'; tf(cd, { o: P(lt, at[i] - 0.1, at[i]), x: (1 - ease(lt, at[i] - 0.1, at[i] + 0.3, E.back)) * 160 }) })
    kgN.textContent = (ease(lt, tK, tK + 1.5) * 0.05).toFixed(2).replace('.', ',')
    tf(kgN, { o: P(lt, tK, tK + 0.1) }); tf(kgL, { o: P(lt, tK, tK + 0.1) })
  }
})

// ---- 14. admin ----
scene('admin', 'PAINEL ADMIN', (root) => {
  const S = [['admin', 'LIXEIRAS NO MAPA', 'lixeiras no mapa'], ['admin-revis', 'FILA DE REVISÃO', 'fila'], ['admin-temporada', 'AUDITORIA DO TOP 10', 'auditoria'], ['admin-usu', 'GESTÃO DE USUÁRIOS', 'gestão']]
  const phones = S.map(() => Phone(root))
  const labels = S.map(([, t]) => el('div', 'sticker', root, t, { fontSize: '15px', zIndex: 8 }))
  const ttl = words(root, 'Painel para quem <span class="hl">organiza</span>', 'abs h2')
  Object.assign(ttl.style, { left: 0, right: 0, top: '100px', textAlign: 'center', fontSize: '54px' })
  const hiT = S.map((s) => WT('admin', s[2]) - 0.1)
  for(let i=0;i<4;i++) cue(0.1+i*0.1,'swish',0.35); hiT.forEach(t=>cue(t,'blip',0.55))
  return (lt) => {
    wordsIn(ttl, lt, 0.05, 0.07)
    let active = -1; hiT.forEach((t, i) => { if (lt > t) active = i })
    phones.forEach((ph, i) => {
      const t0 = 0.1 + i * 0.1, p = ease(lt, t0, t0 + 0.5, E.out5)
      const act = i === active, a = act ? ease(lt, hiT[i], hiT[i] + 0.25, E.back) : 0
      const cx = 360 + i * 400
      ph.focus(195, 420, 0.6 + a * 0.08, cx, 510 + (1 - p) * 800 - a * 20, { o: P(lt, t0, t0 + 0.1) })
      ph.e.style.filter = active >= 0 && !act ? 'brightness(.5)' : 'none'
      ph.e.style.zIndex = act ? 3 : 1
      ph.show(still(S[i][0]))
      const lb = labels[i]; lb.style.left = cx + 'px'; lb.style.top = '815px'
      tf(lb, { x: -lb.offsetWidth / 2, o: lt > hiT[i] ? (act ? 1 : 0.6) : 0, s: act ? 1 + bump(lt, hiT[i], 0.3) * 0.2 : 1 })
    })
  }
})

// ---- 15. data ----
scene('data', 'DADOS', (root) => {
  const ttl = words(root, 'O melhor de tudo: <span class="hl">dados.</span>', 'abs h1')
  Object.assign(ttl.style, { left: '140px', top: '120px', fontSize: '74px' })
  const note = el('div', 'abs pix', root, 'ILUSTRAÇÃO · OS NÚMEROS REAIS VIRÃO DO PILOTO', { left: '140px', top: '860px', fontSize: '13px', color: '#8fb2d9' })
  const box = (x, y, w, h, t) => el('div', 'card', root, `<div class="pix" style="font-size:17px;color:#fde8b0">${t}</div>`, { left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px' })
  const b1 = box(140, 260, 560, 570, 'O QUÊ? · MATERIAL')
  const MAT = [['Plástico', '#e0413a', 0.86], ['Papel', '#2d6fd6', 0.72], ['Alumínio', '#f5c518', 0.55], ['Orgânico', '#8a5a2b', 0.4], ['Vidro', '#2f9a4a', 0.22], ['Eletrônico', '#f4a259', 0.1]]
  const bars = MAT.map(([n, c, v], i) => { const r = el('div', '', b1, `<div style="font:500 22px Inter;color:#e8f1ff;width:140px">${n}</div><div style="flex:1;height:36px;background:#16335e;position:relative"><i style="position:absolute;left:0;top:0;bottom:0;background:${c};width:0"></i></div>`, { display: 'flex', alignItems: 'center', gap: '14px', marginTop: i ? '26px' : '40px' }); return { i: r.querySelector('i'), v } })
  const b2 = box(740, 260, 520, 570, 'ONDE? · LIXEIRA')
  const map = el('div', '', b2, '', { position: 'relative', marginTop: '20px', height: '470px', background: '#0b1e3a', border: '3px solid #16335e', overflow: 'hidden' })
  ;[[40, 60, 160, 90], [260, 40, 150, 120], [90, 260, 220, 110]].forEach(([x, y, w, h]) => el('div', '', map, '', { position: 'absolute', left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px', background: '#1a3a66' }))
  el('div', '', map, '', { position: 'absolute', left: '0', top: '210px', width: '100%', height: '10px', background: '#2b4f80' })
  const dots = [[120, 170, 70], [330, 190, 50], [210, 230, 95], [380, 330, 35], [140, 400, 45], [60, 300, 25]].map(([x, y, s]) => el('div', '', map, '', { position: 'absolute', left: x + 'px', top: y + 'px', width: s + 'px', height: s + 'px', marginLeft: -s / 2 + 'px', marginTop: -s / 2 + 'px', borderRadius: '50%', background: 'rgba(143,227,154,.55)', border: '3px solid #8fe39a' }))
  const b3 = box(1300, 260, 480, 570, 'QUANDO? · HORÁRIO')
  const hm = el('div', '', b3, '', { display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: '6px', marginTop: '30px' })
  const R = rng(9)
  const cells = Array.from({ length: 72 }, (_, i) => { const col = i % 8, row = Math.floor(i / 8); const peak = Math.exp(-Math.pow(col - 3.2, 2) / 3) * 0.8 + Math.exp(-Math.pow(col - 6.5, 2) / 2) * 0.5; const v = clamp(peak * (row < 5 ? 1 : 0.4) + R() * 0.2); return el('div', '', hm, '', { height: '44px', background: `rgba(244,162,89,${0.12 + v * 0.88})` }) })
  el('div', '', b3, '<span>7h</span><span>12h</span><span>18h</span><span>22h</span>', { display: 'flex', justifyContent: 'space-between', marginTop: '14px', font: '400 20px Inter', color: '#8fb2d9' })
  const tQ = WT('data', 'o que foi'), tO = WT('data', 'onde'), tN = WT('data', 'quando'), tPlan = WT('data', 'planejar')
  cue(tQ-0.15,'pop',0.6); cue(tO-0.15,'pop',0.6); cue(tN-0.15,'pop',0.6); cue(tPlan,'sparkle',0.5)
  return (lt) => {
    wordsIn(ttl, lt, 0.05, 0.07)
    tf(note, { o: ease(lt, tQ, tQ + 0.4) * 0.9 })
    ;[[b1, tQ], [b2, tO], [b3, tN]].forEach(([b, t0], i) => {
      const glow = env(lt, t0, t0 + 1.2, 0.15, 0.3) + bump(lt, tPlan + i * 0.15, 0.4)
      b.style.borderColor = glow > 0.05 ? '#8fe39a' : '#3d8fd1'
      const p = ease(lt, t0 - 0.15, t0 + 0.3, E.back)
      tf(b, { o: P(lt, t0 - 0.15, t0 - 0.05), y: (1 - p) * 120 - glow * 14 })
    })
    bars.forEach((b, i) => { b.i.style.width = ease(lt, tQ + 0.1 + i * 0.08, tQ + 0.8 + i * 0.08) * b.v * 100 + '%' })
    dots.forEach((d, i) => tf(d, { ...pop(lt, tO + 0.1 + i * 0.08, 0.35), s: ease(lt, tO + 0.1 + i * 0.08, tO + 0.45 + i * 0.08, E.back) * (1 + 0.08 * Math.sin(lt * 4 + i)) }))
    cells.forEach((c, i) => tf(c, { o: ease(lt, tN + 0.05 + i * 0.008, tN + 0.3 + i * 0.008) }))
  }
})

// ---- 16. impact ----
scene('impact', 'POR QUE IMPORTA', (root) => {
  const COLS = [['FACENS', 'Inovação feita pelos próprios alunos.', 'shield', '#7cc3f5', 'Para a Facens'], ['COMUNIDADE', 'Um hábito que vai junto pra casa.', 'user', '#f4a259', 'comunidade'], ['MUNDO', 'Um passo rumo aos Objetivos de Desenvolvimento Sustentável da ONU.', 'map', '#8fe39a', 'para o mundo']]
  const cols = COLS.map(([t, d, ic, col]) => el('div', 'card', root, `<div style="display:flex;align-items:center;gap:20px">${icon(ic, 64, col)}<div class="pix" style="font-size:26px;color:${col}">${t}</div></div><div style="font:600 36px Grotesk;line-height:1.2;color:#fff;margin-top:28px">${d}</div>`, { width: '520px', height: '330px', padding: '36px' }))
  const ODS = [[12, 'CONSUMO E PRODUÇÃO\nRESPONSÁVEIS', '#BF8B2E'], [4, 'EDUCAÇÃO DE\nQUALIDADE', '#C5192D'], [11, 'CIDADES E COMUNIDADES\nSUSTENTÁVEIS', '#FD9D24'], [13, 'AÇÃO CONTRA A MUDANÇA\nGLOBAL DO CLIMA', '#3F7E44']]
  const tiles = ODS.map(([n, t, col], i) => el('div', 'abs', root, `<div style="background:${col};color:#fff;padding:16px 20px;height:100%;box-shadow:8px 8px 0 #0a0f1f"><div style="font:700 56px Grotesk;line-height:1">${n}</div><div style="font:700 16px Inter;line-height:1.25;margin-top:8px;white-space:pre">${t}</div></div>`, { left: 140 + i * 420 + 'px', top: '640px', width: '380px', height: '180px' }))
  const at = COLS.map((c) => WT('impact', c[4]))
  const tO = WT('impact', 'Objetivos')
  at.forEach(t=>cue(t-0.1,'slam',0.7)); for(let i=0;i<4;i++) cue(tO+i*0.12,'blip',0.45); cue(tO+0.5,'sparkle',0.7)
  return (lt) => {
    cols.forEach((cl, i) => {
      cl.style.left = 140 + i * 560 + 'px'; cl.style.top = '190px'
      const p = ease(lt, at[i] - 0.1, at[i] + 0.35, E.back)
      tf(cl, { o: P(lt, at[i] - 0.1, at[i]), y: (1 - p) * 160, s: 1 + bump(lt, at[i] + 0.3, 0.3) * 0.03 })
    })
    tiles.forEach((tl, i) => { const t0 = tO + i * 0.12; tf(tl, { ...pop(lt, t0, 0.4), y: (1 - ease(lt, t0, t0 + 0.4)) * 60 }) })
  }
})

// ---- 17. cost ----
scene('cost', 'CUSTO E ESCALA', (root) => {
  const big = el('div', 'abs big-pix', root, '', { left: '140px', top: '200px', fontSize: '170px', color: '#8fe39a', textShadow: '10px 10px 0 #0a0f1f' })
  const sub = el('div', 'abs h3', root, 'custo praticamente zero', { left: '150px', top: '420px', fontWeight: 500, fontSize: '42px', color: '#8fb2d9' })
  const CH = [['phone', 'Funciona em qualquer celular', 'qualquer celular'], ['addBox', 'Sem baixar nada da loja (PWA)', 'sem baixar'], ['share', 'Pronto para outras universidades', 'universidade']]
  const chips = CH.map(([ic, t]) => el('div', 'chip', root, `<span class="ic">${icon(ic, 28, '#0a0f1f')}</span>${t}`, { left: '150px' }))
  const grid = el('div', 'abs', root, '', { left: '1180px', top: '200px', width: '620px', height: '620px' })
  const R = rng(21)
  const camp = Array.from({ length: 30 }, (_, i) => { const c = i % 6, r = Math.floor(i / 6); return { e: el('div', 'abs', grid, mascotSvg('idle', 64), { left: c * 104 + 'px', top: r * 120 + 'px' }), d: i === 14 ? 0 : Math.hypot(c - 2, r - 2) * 0.12 + R() * 0.1 } })
  const fac = el('div', 'sticker', root, 'FACENS', { left: '1386px', top: '532px', zIndex: 4 })
  const at = CH.map((c) => WT('cost', c[2]))
  cue(0.05,'countdown',0.6); cue(1.0,'coin',0.8); at.forEach(t=>cue(t-0.1,'pop',0.55)); for(let i=0;i<8;i++) cue(at[2]-0.2+i*0.08,'blip',0.3)
  return (lt) => {
    const v = ease(lt, 0.05, 1.0)
    big.textContent = 'R$ ' + Math.round((1 - v) * 999)
    tf(big, { o: P(lt, 0, 0.1), s: 1 + bump(lt, 1.0, 0.3) * 0.12 })
    tf(sub, { o: ease(lt, 0.9, 1.2) })
    chips.forEach((ch, i) => { ch.style.top = 520 + i * 100 + 'px'; tf(ch, { o: P(lt, at[i] - 0.1, at[i]), x: (1 - ease(lt, at[i] - 0.1, at[i] + 0.3, E.back)) * -160 }) })
    camp.forEach((q, i) => { const t0 = i === 14 ? 0.3 : at[2] - 0.2 + q.d; tf(q.e, { ...pop(lt, t0, 0.35), y: -bump(lt, t0 + 0.4, 0.3) * 20 }) })
    tf(fac, { o: ease(lt, 0.5, 0.7) })
  }
})

// ---- 18. close ----
scene('close', '', (root) => {
  const m = Mascot(root, 170, 250, 250)
  const plate = el('div', 'abs', root, `<div class="plate" style="font-size:58px">RANK ${EYES_LOGO(96)} TRASH</div>`, { left: '140px', top: '480px' })
  const tag = el('div', 'abs pix', root, 'DESCARTE CERTO · GANHE PONTOS<br>SUBA NO RANKING', { left: '150px', top: '640px', fontSize: '22px', lineHeight: '1.8', color: '#fde8b0' })
  const qr = el('div', 'abs', root, `<div style="padding:18px;background:#fff;box-shadow:12px 12px 0 #0a0f1f">${QR_SVG(330)}</div>`, { left: '1250px', top: '200px' })
  const more = el('div', 'abs pix', root, 'SAIBA MAIS', { left: '1250px', top: '590px', width: '366px', textAlign: 'center', fontSize: '20px', color: '#8fb2d9' })
  const url = el('div', 'abs', root, 'ranktrash.eco.br', { left: '1180px', top: '635px', width: '506px', textAlign: 'center', font: '700 54px Grotesk', color: '#8fe39a' })
  const tS = WT('close', 'Saiba mais')
  cue(0.0,'fall',0.5); cue(0.2,'impact',1); cue(tS-0.3,'pop',0.8); cue(tS+0.8,'sparkle',0.7)
  return (lt) => {
    m.set(lt > 0.6 ? 'happy' : 'idle', lt)
    tf(m.box, { y: (1 - ease(lt, 0, 0.5, E.back)) * -400 - Math.abs(Math.sin(lt * 4)) * 14 * (lt > 0.6 ? 1 : 0), o: P(lt, 0, 0.05) })
    tf(plate, { s: 1.8 - 0.8 * ease(lt, 0.2, 0.45, E.out5), o: P(lt, 0.2, 0.25), ...shake(lt, 0.45, 0.35, 10) })
    tf(tag, { o: ease(lt, 0.8, 1.1) })
    const q = pop(lt, tS - 0.3, 0.5)
    tf(qr, { s: q.s, o: q.o, r: (1 - ease(lt, tS - 0.3, tS + 0.2)) * 8 })
    tf(more, { o: ease(lt, tS, tS + 0.2) })
    tf(url, { o: ease(lt, tS + 0.2, tS + 0.4), s: 1 + bump(lt, tS + 0.8, 0.35) * 0.1 })
  }
}, { pad: 1.2 })

// ---- 19. credits: arcade high-score table ----
scene('credits', '', (root) => {
  const head = el('div', 'abs big-pix', root, 'HIGH SCORES', { left: '140px', top: '120px', fontSize: '60px', color: '#f5c518' })
  const sub = el('div', 'abs pix', root, 'EQUIPE RANKTRASH', { left: '144px', top: '210px', fontSize: '20px', color: '#8fb2d9' })
  const NAMES = ['Mateus Sonnenberg', 'Pedro Wagner', 'Jhonny Walter', 'Rodrigo Vieira', 'Samuel Barbosa', 'Daniel Moroni']
  const COL = ['#f4a259', '#8fe39a', '#7cc3f5', '#f5c518', '#ff6b62', '#fde8b0']
  const rows = NAMES.map((n, i) => el('div', 'abs hs-row', root, `<span class="rk">${i + 1}º</span><span class="nm" style="color:${COL[i]}"></span><span class="sc"></span>`, { left: '144px', top: 270 + i * 82 + 'px', width: '980px', borderBottom: '3px dashed rgba(124,195,245,.25)' }))
  const qr = el('div', 'abs', root, `<div style="padding:14px;background:#fff;box-shadow:10px 10px 0 #0a0f1f">${QR_SVG(250)}</div>`, { left: '1360px', top: '200px' })
  const url = el('div', 'abs', root, 'ranktrash.eco.br', { left: '1300px', top: '510px', width: '398px', textAlign: 'center', font: '700 40px Grotesk', color: '#8fe39a' })
  const foot = el('div', 'abs', root, `<div class="pix" style="font-size:17px;color:#fde8b0;line-height:1.9">PROJETO UPX · 2º SEMESTRE<br>ENGENHARIA DA COMPUTAÇÃO · FACENS</div><div style="font:400 20px Inter;color:#8fb2d9;margin-top:10px">Projeto acadêmico de alunos. Ainda não é um app oficial da Facens.</div>`, { left: '1250px', top: '600px', width: '560px', textAlign: 'center' })
  const m = Mascot(root, 100, 1740, 840, 'left')
  cue(0.1,'coin',0.8); for(let i=0;i<6;i++) cue(0.6+i*0.45,'blip',0.6); cue(3.6,'jump',0.6); cue(4.0,'success',0.7)
  return (lt) => {
    tf(head, { o: lt > 0.1 && (lt > 1.2 || Math.floor(lt * 6) % 2 === 0) ? 1 : 0 })
    tf(sub, { o: ease(lt, 0.3, 0.5) })
    rows.forEach((r, i) => {
      const t0 = 0.6 + i * 0.45
      tf(r, { o: P(lt, t0, t0 + 0.05), x: (1 - ease(lt, t0, t0 + 0.3, E.out5)) * -60 })
      const nm = NAMES[i].toUpperCase(), k = Math.floor(clamp((lt - t0) * 30, 0, nm.length))
      r.querySelector('.nm').textContent = nm.slice(0, k) + (k < nm.length && k > 0 ? '█' : '')
      r.querySelector('.sc').textContent = String(Math.round(ease(lt, t0 + 0.2, t0 + 1.0) * 99990)).padStart(6, '0')
    })
    tf(qr, { ...pop(lt, 0.4, 0.5) })
    tf(url, { o: ease(lt, 0.7, 0.9) })
    tf(foot, { o: ease(lt, 1.0, 1.3) })
    m.set('happy', lt)
    tf(m.box, { ...pop(lt, 3.6, 0.4), y: -Math.abs(Math.sin(lt * 5)) * 20 })
    m.say('VALEU!', env(lt, 4.0, 99, 0.2, 0.1))
  }
}, { dur: 8.5 })

// =====================================================================================
// ENGINE
// =====================================================================================
let acc = 0
SCENES.forEach((s) => { s.start = acc; acc += s.dur; s.end = acc })
const TOTAL = acc
const WIPES = new Set(['hook', 'reveal', 'microsoft', 'antifraud', 'data', 'close'])
const FLASH = new Set(['upx', 'result', 'credits'])
const root0 = $('#scenes')
SCENES.forEach((s) => { s.root = el('div', 'scene', root0); BUILDING = s; s.update = s.build(s.root) })
const chapters = SCENES.filter((s) => s.chapter)
const sceneAt = (t) => SCENES.find((s) => t >= s.start && t < s.end) || SCENES[SCENES.length - 1]
// drums / beat pulse are active from the reveal on (matches audio/mix.py)
const PULSE_FROM = SCENES.find((s) => s.key === 'reveal').start

window.TIMELINE = { total: TOTAL, beat: BEAT, scenes: SCENES.map((s) => ({ key: s.key, start: s.start, end: s.end, narr: N[s.key] ? s.start + NARR_OFFSET : null })), wipes: SCENES.filter((s) => WIPES.has(s.key)).map((s) => s.start), flashes: SCENES.filter((s) => FLASH.has(s.key)).map((s) => s.start) }

window.CUES = [
  ...CUE_LIST.map((c) => ({ t: +(c.s.start + c.lt).toFixed(3), name: c.name, gain: c.gain })),
  ...window.TIMELINE.wipes.map((w) => ({ t: w - WD, name: 'whoosh', gain: 0.9 })),
  ...SCENES.filter((s, i) => i > 0 && !WIPES.has(s.key) && !FLASH.has(s.key)).map((s) => ({ t: s.start - 0.2, name: 'swish', gain: 0.55 })),
  ...window.TIMELINE.flashes.map((f) => ({ t: f - 0.05, name: 'impact', gain: 0.6 })),
].sort((a, b) => a.t - b.t)

window.seek = async function (t) {
  pending.length = 0
  const bp = ((t % BEAT) + BEAT) % BEAT
  PULSE = t > PULSE_FROM ? Math.exp(-bp * 9) : 0
  drawBg(t)
  const cur = sceneAt(t)
  SCENES.forEach((s) => {
    const vis = s === cur
    s.root.style.display = vis ? 'block' : 'none'
    if (!vis) return
    const lt = t - s.start
    s.update(lt)
    // non-wipe cuts: quick whip (slide + blur) between scenes
    const idx = SCENES.indexOf(s), nxt = SCENES[idx + 1]
    const whipIn = !WIPES.has(s.key) && !FLASH.has(s.key) && idx > 0
    const whipOut = nxt && !WIPES.has(nxt.key) && !FLASH.has(nxt.key)
    const pin = whipIn ? 1 - ease(lt, 0, 0.22, E.out) : 0
    const pout = whipOut ? ease(t, s.end - 0.2, s.end, E.in) : 0
    const x = pin * 260 - pout * 260
    s.root.style.transform = `translateX(${x}px) scale(${1 + PULSE * 0.004})`
    s.root.style.filter = pin + pout > 0.02 ? `blur(${(pin + pout) * 14}px)` : 'none'
    s.root.style.opacity = 1 - Math.max(pin, pout) * 0.6
  })
  let T = null
  for (const w of window.TIMELINE.wipes) if (Math.abs(t - w) < WD + 0.02) T = w
  drawWipe(t, T)
  let fl = 0
  for (const f of window.TIMELINE.flashes) if (t >= f - 0.05 && t < f + 0.3) fl = Math.max(fl, t < f ? P(t, f - 0.05, f) : 1 - P(t, f, f + 0.3))
  $('#flash').style.opacity = fl * 0.85
  // hud
  const hudOn = cur.key !== 'intro'
  $('#hud').style.opacity = hudOn ? 1 : 0
  const chapIdx = chapters.indexOf(cur)
  $('#chapNum').parentElement.style.opacity = cur.chapter ? 1 : 0
  $('#chapNum').textContent = 'FASE ' + String(chapIdx + 1).padStart(2, '0')
  $('#chapName').textContent = cur.chapter
  $('#chapName').style.maxWidth = ease(t - cur.start, 0.05, 0.5, E.io) * 600 + 'px'
  $('.hud-dot').style.transform = `scale(${1 + PULSE * 0.8})`
  $('#prog').style.width = (t / TOTAL) * 100 + '%'
  // captions
  let capTxt = '', capO = 0
  if (N[cur.key]) {
    const lt = t - cur.start - NARR_OFFSET
    for (const c of N[cur.key].caps) if (lt >= c.t - 0.05 && lt < c.t + c.d + 0.15) { capTxt = c.text; capO = Math.min(P(lt, c.t - 0.05, c.t + 0.08), 1 - P(lt, c.t + c.d + 0.05, c.t + c.d + 0.15)) }
  }
  const ct = $('#capText'); if (ct.textContent !== capTxt) ct.textContent = capTxt
  ct.parentElement.style.opacity = capTxt ? capO : 0
  $('#fade').style.opacity = Math.max(1 - P(t, 0, 0.4), P(t, TOTAL - 1.2, TOTAL))
  await Promise.all(pending)
}
window.ready = (async () => { await document.fonts.ready; await window.seek(0) })()

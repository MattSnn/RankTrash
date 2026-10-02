/* RankTrash · video pitch — deterministic, frame-seekable motion composition.
   window.seek(t) renders the frame at time t (seconds) and resolves when every image is decoded. */
'use strict'
const W = 1920, H = 1080, FPS = 30
const FR = 'frames/'
const $ = (s) => document.querySelector(s)

// ---------- math / easing ----------
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v))
const lerp = (a, b, t) => a + (b - a) * t
const P = (t, a, b) => clamp((t - a) / (b - a))
const E = {
  out: (t) => 1 - Math.pow(1 - t, 3),
  out5: (t) => 1 - Math.pow(1 - t, 5),
  in: (t) => t * t * t,
  io: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  back: (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2) },
  elastic: (t) => (t === 0 || t === 1 ? t : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1),
}
const ease = (t, a, b, fn = E.out) => fn(P(t, a, b))
// in/out envelope: rises over [a, a+ri], falls over [b-ro, b]
const env = (t, a, b, ri = 0.5, ro = 0.5) => Math.min(ease(t, a, a + ri), 1 - ease(t, b - ro, b, E.in))
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296) }

// ---------- DOM helpers ----------
function el(tag, cls, parent, html, style) {
  const e = document.createElement(tag)
  if (cls) e.className = cls
  if (html != null) e.innerHTML = html
  if (style) Object.assign(e.style, style)
  if (parent) parent.appendChild(e)
  return e
}
function tf(e, { x = 0, y = 0, s = 1, sx, sy, r = 0, o, rx = 0, ry = 0, z = 0, blur } = {}) {
  const scale = sx != null || sy != null ? `scale(${sx ?? s},${sy ?? s})` : `scale(${s})`
  const persp = rx || ry ? 'perspective(1600px) ' : ''
  e.style.transform = `${persp}translate3d(${x}px,${y}px,${z}px) ${scale} rotate(${r}deg)${rx ? ` rotateX(${rx}deg)` : ''}${ry ? ` rotateY(${ry}deg)` : ''}`
  if (o != null) e.style.opacity = o
  if (blur != null) e.style.filter = blur > 0.05 ? `blur(${blur}px)` : 'none'
}
function pixelSvg(rows, palette, size) {
  const w = Math.max(...rows.map((r) => r.length)), h = rows.length
  const paths = {}
  rows.forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== '.' && ch !== ' ') paths[ch] = (paths[ch] || '') + `M${x} ${y}h1v1h-1z` }))
  return `<svg viewBox="0 0 ${w} ${h}" width="${size}" height="${(size * h) / w}" shape-rendering="crispEdges">${Object.entries(paths)
    .map(([c, d]) => `<path d="${d}" fill="${palette[c] || 'currentColor'}"/>`).join('')}</svg>`
}
const icon = (name, size = 28, color = 'currentColor') => pixelSvg(ICONS[name], { K: color }, size)
const MASCOT_ROWS = (mood) => {
  const HEAD = ['......KKKK......', '.....KGGGGK.....', '..KKKKKKKKKKKK..', '.KGGGGGGGGGGGGK.', '.KggggggggggggK.', '..KKKKKKKKKKKK..', '..KBBBBBBBBBBK..']
  const EYES = {
    idle: ['..KBWWWBBWWWBK..', '..KWWWWBBWWWWK..', '..KWWWWBBWWWWK..', '..KBWWBBBBWWBK..'],
    happy: ['..KBBBBBBBBBBK..', '..KBWWBBBBWWBK..', '..KWBBWBBWBBWK..', '..KBBBBBBBBBBK..'],
    blink: ['..KBBBBBBBBBBK..', '..KBBBBBBBBBBK..', '..KWWWWBBWWWWK..', '..KBBBBBBBBBBK..'],
  }
  const BODY = ['..KBBBBBBBBBBK..', '..KBBbBBBBbBBK..', '..KBBbBBBBbBBK..', '...KBbBBBBbBK...', '...KKKKKKKKKK...']
  return [...HEAD, ...EYES[mood], ...BODY]
}
const MASCOT_PAL = { K: '#0a0f1f', G: '#6fd07c', g: '#2f7a3c', B: '#3d8fd1', b: '#1d5a92', W: '#ffffff' }
const mascot = (mood, size) => pixelSvg(MASCOT_ROWS(mood), MASCOT_PAL, size)
const EYES_LOGO = (size) => pixelSvg(['.KKKKKKKKKKKK.', 'KRRRRRRRRRRRRK', 'KRWWWRRRRWWWRK', 'KWWWWRRRRWWWWK', 'KWWWWRRRRWWWWK', 'KRWWRRRRRRWWRK', '.KKKKKKKKKKKK.'], { K: '#0a0f1f', R: '#6fd07c', W: '#fff' }, size)

// words that rise in, one by one
function words(parent, html, cls = '') {
  const box = el('div', cls, parent)
  const out = []
  html.split('\n').forEach((ln) => {
    const line = el('span', 'line', box, ln)
    const walk = (node) => [...node.childNodes].forEach((n) => {
      if (n.nodeType === 3) {
        const frag = document.createDocumentFragment()
        n.textContent.split(/(\s+)/).forEach((w) => { if (!w) return; if (/^\s+$/.test(w)) frag.appendChild(document.createTextNode(' ')); else { const sp = el('span', 'word', null, null); sp.textContent = w; out.push(sp); frag.appendChild(sp) } })
        node.replaceChild(frag, n)
      } else walk(n)
    })
    walk(line)
  })
  box.words = out
  return box
}
function wordsIn(box, lt, t0, stagger = 0.06, dur = 0.55, outAt = null) {
  box.words.forEach((w, i) => {
    const p = ease(lt, t0 + i * stagger, t0 + i * stagger + dur, E.out5)
    let o = p, y = (1 - p) * 70
    if (outAt != null) { const q = ease(lt, outAt + i * 0.02, outAt + i * 0.02 + 0.35, E.in); o *= 1 - q; y -= q * 40 }
    tf(w, { y, o })
  })
}

// ---------- image loading ----------
const pending = []
function setImg(img, url) {
  if (img.dataset.src === url) return
  img.dataset.src = url
  img.src = url
  pending.push(img.decode().catch(() => {}))
}
const seqUrl = (name, lt, n, { fps = FPS, loop = false } = {}) => {
  let i = Math.floor(lt * fps)
  i = loop ? ((i % n) + n) % n : clamp(i, 0, n - 1)
  return `${FR}${name}/${String(i).padStart(4, '0')}.jpg`
}
const still = (name) => `${FR}stills/${name}.png`
const SEQ = { camera: 90, login: 90, map: 180, 'perfil-scroll': 120, preview: 30, 'ranking-scroll': 90, ranking: 90, 'regras-scroll': 90, 'result-scroll': 90, result: 120, scan: 49 }
const seq = (name, lt, opt) => seqUrl(name, lt, SEQ[name], opt)

// ---------- phone ----------
function Phone(parent) {
  const e = el('div', 'phone', parent)
  const scr = el('div', 'scr', e)
  const a = el('img', 'a', scr), b = el('img', 'b', scr)
  el('div', 'status', scr, `<span>9:41</span><span class="r"><span class="bars"><i style="height:4px"></i><i style="height:6px"></i><i style="height:9px"></i><i style="height:12px"></i></span><span class="batt"><i></i></span></span>`)
  const ov = el('div', 'overlay', scr)
  el('div', 'island', e); el('div', 'glare', e)
  const tap = el('div', 'tap', scr)
  const ph = { e, a, b, ov, tap, x: 0, y: 0, s: 1, r: 0 }
  ph.place = (x, y, s = 1, extra = {}) => { Object.assign(ph, { x, y, s }); tf(e, { x, y, s, ...extra }) }
  // show url (and optional crossfade into urlB with mix 0..1)
  ph.show = (url, urlB = null, mix = 0) => {
    setImg(a, url)
    if (urlB && mix > 0) { setImg(b, urlB); b.style.opacity = mix } else b.style.opacity = 0
  }
  // app coordinates (390x844) -> stage coordinates
  ph.pt = (ax, ay) => {
    const lx = 15 + 7 + ax * 0.9893, ly = 15 + 40 + ay * 0.9893
    return { x: ph.x + 215 + (lx - 215) * ph.s, y: ph.y + 452.5 + (ly - 452.5) * ph.s }
  }
  ph.tapAt = (lt, t0, ax, ay) => {
    const p = P(lt, t0, t0 + 0.55)
    const lx = 7 + ax * 0.9893, ly = 40 + ay * 0.9893
    tap.style.left = lx + 'px'; tap.style.top = ly + 'px'
    tf(tap, { s: 0.4 + p * 0.9, o: p > 0 && p < 1 ? (1 - p) * 0.95 : 0 })
  }
  return ph
}

// leader line svg (stage coords)
function Lead(parent, color = '#fde8b0') {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('class', 'lead'); parent.appendChild(svg)
  const path = document.createElementNS(svg.namespaceURI, 'path')
  path.setAttribute('fill', 'none'); path.setAttribute('stroke', color); path.setAttribute('stroke-width', '3'); path.setAttribute('stroke-dasharray', '2000')
  const dot = document.createElementNS(svg.namespaceURI, 'rect'); dot.setAttribute('width', 14); dot.setAttribute('height', 14); dot.setAttribute('fill', color)
  svg.append(path, dot)
  return {
    set(x1, y1, x2, y2, p) {
      const mx = x1 + (x2 - x1) * 0.35
      path.setAttribute('d', `M${x1} ${y1} L${mx} ${y1} L${x2} ${y2}`)
      path.setAttribute('stroke-dashoffset', 2000 - 2000 * p * 0.9999)
      const len = Math.abs(mx - x1) + Math.hypot(x2 - mx, y2 - y1)
      path.setAttribute('stroke-dasharray', `${len} 4000`); path.setAttribute('stroke-dashoffset', len * (1 - p))
      dot.setAttribute('x', x1 - 7); dot.setAttribute('y', y1 - 7); dot.setAttribute('opacity', p > 0 ? 1 : 0)
    },
  }
}

// ---------- timeline ----------
const NARR_OFFSET = 0.45
const N = Object.fromEntries(NARR.map((n) => [n.key, n]))
const cap = (key, i) => NARR_OFFSET + N[key].caps[i].t // local time a sentence starts
const capEnd = (key, i) => cap(key, i) + N[key].caps[i].d
const SCENES = []
function scene(key, chapter, build, { pad = 1.0, dur } = {}) { SCENES.push({ key, chapter, build, dur: dur ?? N[key].dur + NARR_OFFSET + pad }) }

// background: blueprint grid + drifting pixels
const bg = $('#bg').getContext('2d')
const R0 = rng(7); const DUST = Array.from({ length: 70 }, () => ({ x: R0() * W, y: R0() * H, s: 2 + Math.floor(R0() * 4), v: 6 + R0() * 22, a: 0.08 + R0() * 0.25 }))
let bgTint = [7, 20, 42]
function drawBg(t) {
  bg.fillStyle = `rgb(${bgTint.join(',')})`; bg.fillRect(0, 0, W, H)
  const g = bg.createRadialGradient(W / 2, H / 2, 200, W / 2, H / 2, 1200)
  g.addColorStop(0, 'rgba(31,58,158,0.28)'); g.addColorStop(1, 'rgba(0,0,0,0.35)')
  bg.fillStyle = g; bg.fillRect(0, 0, W, H)
  const off = (t * 12) % 60
  bg.strokeStyle = 'rgba(61,143,209,0.07)'; bg.lineWidth = 1
  bg.beginPath()
  for (let x = -60 + off; x < W; x += 60) { bg.moveTo(x, 0); bg.lineTo(x, H) }
  for (let y = -60 + off; y < H; y += 60) { bg.moveTo(0, y); bg.lineTo(W, y) }
  bg.stroke()
  DUST.forEach((d) => { const y = (d.y - t * d.v + H * 10) % H; bg.fillStyle = `rgba(143,227,154,${d.a})`; bg.fillRect(d.x, y, d.s, d.s) })
}

// pixel-block wipe transition centered at time T
const wipe = $('#wipe').getContext('2d')
const BS = 60, BC = W / BS, BR = H / BS
const WR = rng(42); const WTH = Array.from({ length: BC * BR }, (_, i) => { const cx = i % BC, cy = Math.floor(i / BC); return 0.55 * (cx / BC) + 0.25 * (cy / BR) + 0.2 * WR() })
const WCOL = ['#3d8fd1', '#1f3a9e', '#0b1e3a', '#5fb96a', '#f4a259']
function drawWipe(t, T) {
  const D = 0.42
  wipe.clearRect(0, 0, W, H)
  if (T == null || t < T - D || t > T + D) return
  const into = t < T, p = into ? P(t, T - D, T) : P(t, T, T + D)
  for (let i = 0; i < WTH.length; i++) {
    const on = into ? WTH[i] < p * 1.05 : WTH[i] > p * 1.05 - 0.05
    if (!on) continue
    wipe.fillStyle = WCOL[(i * 7 + (i >> 3)) % 5 === 3 ? 3 : (i * 3) % 3]
    wipe.fillRect((i % BC) * BS, Math.floor(i / BC) * BS, BS, BS)
  }
}

// =====================================================================================
// SCENES
// =====================================================================================

// ---- 0. intro ----
scene('intro', '', (root) => {
  const m = el('div', 'abs', root, mascot('idle', 150), { left: '885px', top: '330px' })
  const t1 = el('div', 'abs pix', root, 'UM PROJETO DE ALUNOS DA FACENS', { left: 0, right: 0, top: '560px', textAlign: 'center', fontSize: '22px', color: '#8fb2d9', letterSpacing: '3px' })
  const t2 = el('div', 'abs pix', root, 'CAMPANHA LIXO ZERO', { left: 0, right: 0, top: '610px', textAlign: 'center', fontSize: '30px', color: '#8fe39a', letterSpacing: '3px' })
  const line = el('div', 'abs', root, '', { left: '660px', top: '670px', width: '600px', height: '4px', background: '#3d8fd1', transformOrigin: '0 50%' })
  return (lt) => {
    const o = 1 - ease(lt, 3.0, 3.5)
    tf(m, { y: (1 - ease(lt, 0.2, 1.1, E.back)) * 60, s: 0.6 + 0.4 * ease(lt, 0.2, 1.1, E.back), o: ease(lt, 0.2, 0.6) * o })
    m.innerHTML = mascot(lt % 2.2 > 2.05 ? 'blink' : 'idle', 150)
    tf(t1, { y: (1 - ease(lt, 0.7, 1.4)) * 30, o: ease(lt, 0.7, 1.4) * o })
    tf(t2, { y: (1 - ease(lt, 1.0, 1.7)) * 30, o: ease(lt, 1.0, 1.7) * o })
    tf(line, { sx: ease(lt, 1.2, 2.2, E.io), o })
  }
}, { dur: 3.6 })

// ---- 1. hook ----
scene('hook', 'O DESAFIO', (root) => {
  // crowd of pixel people walking
  const crowd = el('div', 'abs', root, '', { left: 0, top: 0, width: W + 'px', height: H + 'px' })
  const R = rng(3)
  const people = Array.from({ length: 46 }, (_, i) => {
    const c = ['#8fb2d9', '#fde8b0', '#7cc3f5', '#f4a259', '#8fe39a'][i % 5]
    const p = el('div', 'abs', crowd, icon('user', 34 + Math.floor(R() * 18), c))
    return { p, row: Math.floor(R() * 4), x0: R() * W, v: 70 + R() * 90, ph: R() * 6 }
  })
  const h = words(root, 'Todos os dias,\n<span class="hl">milhares de pessoas</span>\npassam pelo campus.', 'abs h1')
  Object.assign(h.style, { left: '140px', top: '210px' })
  // bins row
  const BINS = [['#2d6fd6', 'PAPEL'], ['#e0413a', 'PLÁSTICO'], ['#2f9a4a', 'VIDRO'], ['#f5c518', 'METAL'], ['#8a5a2b', 'ORGÂNICO'], ['#8b8f97', 'REJEITO']]
  const bins = BINS.map(([c, n], i) => {
    const b = el('div', 'abs', root, `<svg width="170" height="210" viewBox="0 0 34 42" shape-rendering="crispEdges">
      <rect x="1" y="4" width="32" height="5" fill="#0a0f1f"/><rect x="2" y="5" width="30" height="3" fill="${c}"/><rect x="13" y="1" width="8" height="4" fill="#0a0f1f"/><rect x="14" y="2" width="6" height="2" fill="${c}"/>
      <rect x="3" y="9" width="28" height="32" fill="#0a0f1f"/><rect x="4" y="9" width="26" height="31" fill="${c}"/><rect x="4" y="9" width="4" height="31" fill="rgba(255,255,255,.18)"/><rect x="26" y="9" width="4" height="31" fill="rgba(0,0,0,.18)"/>
      <rect x="12" y="20" width="10" height="10" fill="rgba(0,0,0,.25)"/></svg>
      <div class="pix" style="text-align:center;font-size:15px;margin-top:14px;color:${c === '#8b8f97' ? '#c9ccd2' : c}">${n}</div>`, { left: 225 + i * 250 + 'px', top: '560px', width: '170px' })
    return b
  })
  const can = el('div', 'abs', root, `<svg width="70" height="110" viewBox="0 0 14 22" shape-rendering="crispEdges"><rect x="1" y="0" width="12" height="2" fill="#cfd6df"/><rect x="0" y="2" width="14" height="18" fill="#d81e2a"/><rect x="2" y="2" width="3" height="18" fill="#ff6b6b"/><rect x="0" y="8" width="14" height="3" fill="#fff"/><rect x="1" y="20" width="12" height="2" fill="#cfd6df"/></svg>`, { left: '925px', top: '330px' })
  const q = el('div', 'abs pix', root, '?', { left: '1010px', top: '300px', fontSize: '64px', color: '#f5c518', textShadow: '6px 6px 0 #0a0f1f' })
  const big = words(root, 'Em qual lixeira <span class="hly">isso vai?</span>', 'abs h1')
  Object.assign(big.style, { left: 0, right: 0, top: '170px', textAlign: 'center' })
  const s2 = cap('hook', 1) + 2.0, sQ = cap('hook', 2) - 0.15
  return (lt) => {
    const crowdO = 1 - ease(lt, s2 - 0.4, s2 + 0.2)
    people.forEach((q, i) => {
      const x = ((q.x0 + lt * q.v) % (W + 200)) - 100
      const y = 690 + q.row * 70 + Math.abs(Math.sin(lt * 7 + q.ph)) * -8
      tf(q.p, { x, y, o: ease(lt, 0.1 + i * 0.03, 0.6 + i * 0.03) * crowdO * (0.5 + q.row * 0.15) })
    })
    wordsIn(h, lt, 0.3, 0.09, 0.6, s2 - 0.5)
    bins.forEach((b, i) => { const p = ease(lt, s2 + 0.1 + i * 0.08, s2 + 0.7 + i * 0.08, E.back); tf(b, { y: (1 - p) * 220, o: P(lt, s2 + i * 0.08, s2 + 0.3 + i * 0.08) }) })
    const cp = ease(lt, s2 + 0.5, s2 + 1.1, E.back)
    const sway = Math.sin((lt - s2) * 2.2) * 520
    tf(can, { x: sway, y: Math.sin(lt * 4) * 10 + (1 - cp) * -300, r: Math.sin((lt - s2) * 2.2 + 1.2) * 14, o: P(lt, s2 + 0.4, s2 + 0.6) })
    tf(q, { x: sway, y: Math.sin(lt * 5) * 12, o: P(lt, s2 + 0.9, s2 + 1.1), s: 0.6 + 0.4 * ease(lt, s2 + 0.9, s2 + 1.3, E.back) })
    wordsIn(big, lt, sQ, 0.08)
  }
})

// ---- 2. problem ----
scene('problem', 'O PROBLEMA', (root) => {
  // contamination grid
  const grid = el('div', 'abs', root, '', { left: '170px', top: '250px', width: '640px', height: '520px' })
  const cells = []
  for (let r = 0; r < 6; r++) for (let c = 0; c < 8; c++) {
    const d = el('div', 'abs', grid, icon('bin', 34, '#0a0f1f'), { left: c * 80 + 'px', top: r * 84 + 'px', width: '68px', height: '72px', display: 'grid', placeItems: 'center', background: '#8fe39a', boxShadow: '4px 4px 0 #0a0f1f' })
    cells.push({ d, dist: Math.hypot(c - 3.5, r - 2.5) })
  }
  const g1 = words(root, 'Um único item errado\npode <span style="color:#ff6b62">contaminar</span>\num lote inteiro.', 'abs h2')
  Object.assign(g1.style, { left: '920px', top: '320px' })
  const tag = el('div', 'sticker', root, 'LOTE CONTAMINADO', { left: '360px', top: '200px', background: '#e0413a', color: '#fff' })
  // waffle
  const wf = el('div', 'abs', root, '', { left: '200px', top: '210px', width: '560px', height: '560px' })
  const wcells = Array.from({ length: 100 }, (_, i) => el('div', 'abs', wf, '', { left: (i % 10) * 56 + 'px', top: Math.floor(i / 10) * 56 + 'px', width: '46px', height: '46px', background: '#16335e' }))
  const pct = el('div', 'abs', root, '<span class="pix" style="font-size:150px;color:#8fe39a;text-shadow:10px 10px 0 #0a0f1f">&lt;5%</span>', { left: '900px', top: '250px' })
  const pctT = el('div', 'abs h3', root, 'dos resíduos sólidos são<br>reciclados no Brasil.', { left: '905px', top: '470px', fontSize: '46px' })
  const src = el('div', 'abs', root, 'Fonte: Panorama dos Resíduos Sólidos no Brasil (Abrelpe/Abrema)', { left: '908px', top: '610px', fontSize: '20px', color: '#8fb2d9' })
  // not bins, but...
  const nb = el('div', 'abs h1', root, 'Não é falta de lixeira.', { left: 0, right: 0, top: '240px', textAlign: 'center' })
  const strike = el('div', 'abs', root, '', { left: '510px', top: '297px', width: '900px', height: '10px', background: '#e0413a', transformOrigin: '0 50%' })
  const lack = el('div', 'abs kicker', root, 'É FALTA DE', { left: 0, right: 0, top: '420px', textAlign: 'center', fontSize: '22px' })
  const three = ['INFORMAÇÃO', 'HÁBITO', 'MOTIVAÇÃO'].map((t, i) => el('div', 'card cream pix', root, t, { left: 330 + i * 430 + 'px', top: '490px', width: '390px', textAlign: 'center', fontSize: '26px', padding: '40px 10px' }))
  const s1 = cap('problem', 1), s2 = cap('problem', 2), s3 = cap('problem', 3)
  return (lt) => {
    // part A
    const oA = 1 - ease(lt, s1 - 0.5, s1 - 0.1)
    const drop = 1.3, spread = P(lt, drop + 0.3, drop + 2.6)
    cells.forEach((c, i) => {
      const inP = ease(lt, 0.1 + i * 0.012, 0.5 + i * 0.012, E.back)
      const bad = spread * 5 > c.dist
      c.d.style.background = bad ? (c.dist < 0.8 ? '#e0413a' : '#7a2a2a') : '#8fe39a'
      tf(c.d, { s: inP * (bad ? 0.92 : 1), o: oA })
    })
    tf(tag, { o: P(lt, drop + 1.2, drop + 1.5) * oA, s: 0.7 + 0.3 * ease(lt, drop + 1.2, drop + 1.6, E.back) })
    wordsIn(g1, lt, 0.4, 0.07, 0.55, s1 - 0.6)
    // part B
    const oB = 1 - ease(lt, s2 - 0.6, s2 - 0.2)
    wcells.forEach((c, i) => {
      const p = ease(lt, s1 + i * 0.008, s1 + 0.3 + i * 0.008)
      const green = i >= 96 && lt > s1 + 1.2 + (i - 96) * 0.15
      c.style.background = green ? '#8fe39a' : '#1d3a66'
      tf(c, { s: p * (green ? 1.08 : 1), o: p * oB })
    })
    tf(pct, { o: ease(lt, s1 + 0.2, s1 + 0.6) * oB, s: 0.8 + 0.2 * ease(lt, s1 + 0.2, s1 + 0.8, E.back) })
    tf(pctT, { o: ease(lt, s1 + 0.6, s1 + 1.0) * oB, y: (1 - ease(lt, s1 + 0.6, s1 + 1.0)) * 20 })
    tf(src, { o: ease(lt, s1 + 1.0, s1 + 1.4) * oB * 0.9 })
    // part C
    tf(nb, { o: ease(lt, s2 - 0.2, s2 + 0.2), y: (1 - ease(lt, s2 - 0.2, s2 + 0.3)) * 40 })
    tf(strike, { sx: ease(lt, s2 + 1.2, s2 + 1.6, E.io), o: P(lt, s2 + 1.2, s2 + 1.25) })
    tf(lack, { o: ease(lt, s3, s3 + 0.3) })
    three.forEach((c, i) => { const t0 = s3 + 0.5 + i * 0.75; tf(c, { o: ease(lt, t0, t0 + 0.3), y: (1 - ease(lt, t0, t0 + 0.5, E.back)) * 80, r: (1 - ease(lt, t0, t0 + 0.5)) * -6 }) })
  }
})

// ---- 3. reveal ----
scene('reveal', 'A SOLUÇÃO', (root) => {
  const glow = el('div', 'abs', root, '', { left: '660px', top: '120px', width: '600px', height: '600px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(143,227,154,.25), rgba(143,227,154,0) 65%)' })
  const m = el('div', 'abs', root, '', { left: '840px', top: '150px' })
  const plate = el('div', 'abs', root, `<div class="plate" style="font-size:64px">RANK ${EYES_LOGO(110)} TRASH</div>`, { left: 0, right: 0, top: '470px', textAlign: 'center' })
  const sub = el('div', 'abs h3', root, 'O app da campanha <span class="hl">Lixo Zero</span> da Facens', { left: 0, right: 0, top: '650px', textAlign: 'center', fontWeight: 500, fontSize: '40px' })
  const game = el('div', 'abs pix', root, 'DESCARTE CORRETO = JOGO', { left: 0, right: 0, top: '735px', textAlign: 'center', fontSize: '26px', color: '#fde8b0' })
  const R = rng(11)
  const stars = Array.from({ length: 22 }, () => ({ e: el('div', 'abs', root, icon('star', 22 + Math.floor(R() * 20), ['#f5c518', '#8fe39a', '#fde8b0'][Math.floor(R() * 3)]), { left: '950px', top: '560px' }), a: R() * Math.PI * 2, d: 300 + R() * 500, r: R() * 360 }))
  const s1 = cap('reveal', 1)
  return (lt) => {
    const mp = ease(lt, 0.1, 0.9, E.back)
    m.innerHTML = mascot(lt > s1 + 0.3 ? 'happy' : lt % 2 > 1.85 ? 'blink' : 'idle', 240)
    tf(m, { y: (1 - mp) * -300 + Math.sin(lt * 2.4) * 8, o: P(lt, 0.1, 0.3), s: 1 + 0.06 * Math.sin(lt * 2.4) })
    tf(glow, { o: ease(lt, 0.3, 1.2) * (0.7 + 0.3 * Math.sin(lt * 2)), s: 0.9 + 0.1 * Math.sin(lt * 2) })
    const pp = ease(lt, 0.7, 1.3, E.back)
    tf(plate, { s: 0.6 + 0.4 * pp, o: P(lt, 0.7, 0.9) })
    tf(sub, { o: ease(lt, 1.6, 2.1), y: (1 - ease(lt, 1.6, 2.1)) * 30 })
    const g = ease(lt, s1 + 0.2, s1 + 0.7, E.back)
    tf(game, { o: P(lt, s1 + 0.2, s1 + 0.4), s: 0.5 + 0.5 * g })
    stars.forEach((s) => { const p = ease(lt, s1 + 0.3, s1 + 1.6); tf(s.e, { x: Math.cos(s.a) * s.d * p, y: Math.sin(s.a) * s.d * 0.55 * p, r: s.r * p, o: p > 0 ? (1 - P(lt, s1 + 1.0, s1 + 1.8)) : 0 }) })
  }
})

// ---- 4. steps ----
scene('steps', 'COMO FUNCIONA', (root) => {
  const title = words(root, 'Simples assim.', 'abs h2')
  Object.assign(title.style, { left: 0, right: 0, top: '170px', textAlign: 'center' })
  const STEPS = [['map', 'VÁ ATÉ\nUMA LIXEIRA', '#f4a259'], ['camera', 'FOTOGRAFE\nO RESÍDUO', '#7cc3f5'], ['target', 'A IA\nIDENTIFICA', '#8fe39a'], ['shield', 'O GPS\nCONFIRMA', '#fde8b0'], ['star', 'GANHE\nPONTOS', '#f5c518']]
  const line = el('div', 'abs', root, '', { left: '260px', top: '505px', width: '1400px', height: '6px', background: 'repeating-linear-gradient(90deg,#3d8fd1 0 18px,transparent 18px 30px)', transformOrigin: '0 50%' })
  const cards = STEPS.map(([ic, t, c], i) => {
    const d = el('div', 'abs', root, `<div style="width:190px;height:190px;margin:0 auto;display:grid;place-items:center;background:#0b1e3a;border:6px solid ${c};box-shadow:8px 8px 0 #0a0f1f">${icon(ic, 100, c)}</div>
      <div class="pix" style="margin-top:34px;text-align:center;font-size:19px;line-height:1.6;color:#fff;white-space:pre">${t}</div>
      <div class="pix" style="position:absolute;left:50%;top:-22px;margin-left:-26px;width:52px;padding:8px 0;text-align:center;font-size:16px;background:${c};color:#0a0f1f;box-shadow:4px 4px 0 #0a0f1f">0${i + 1}</div>`, { left: 175 + i * 330 + 'px', top: '400px', width: '260px' })
    return d
  })
  // word-synced pops over sentence 2
  const s1 = cap('steps', 1), d1 = N.steps.caps[1].d
  const at = [0.0, 0.2, 0.42, 0.68, 0.88].map((f) => s1 + f * d1 - 0.15)
  return (lt) => {
    wordsIn(title, lt, 0.2, 0.08)
    tf(line, { sx: ease(lt, at[0], at[4] + 0.3, E.io) })
    cards.forEach((c, i) => {
      const p = ease(lt, at[i], at[i] + 0.55, E.back)
      const pulse = lt > at[i] + 0.6 ? 1 + 0.03 * Math.sin((lt - at[i]) * 4) : 1
      tf(c, { y: (1 - p) * 120, s: (0.6 + 0.4 * p) * pulse, o: P(lt, at[i], at[i] + 0.2) })
    })
  }
})

// ---- 5. microsoft ----
scene('microsoft', 'INTEGRAÇÃO MICROSOFT', (root) => {
  const ph = Phone(root)
  // illustrative microsoft sign-in card inside the phone
  const ms = el('div', 'abs', ph.ov, `
    <div style="position:absolute;inset:0;background:#f3f3f3"></div>
    <div style="position:absolute;left:0;right:0;top:40px;height:44px;background:#e9e9e9;display:flex;align-items:center;justify-content:center;font:500 15px Inter;color:#333">🔒 login.microsoftonline.com</div>
    <div style="position:absolute;left:26px;right:26px;top:150px;background:#fff;padding:34px 30px;box-shadow:0 2px 8px rgba(0,0,0,.15);font-family:Inter">
      <div style="display:grid;grid-template-columns:14px 14px;gap:2px;margin-bottom:22px"><i style="height:14px;background:#f25022"></i><i style="height:14px;background:#7fba00"></i><i style="height:14px;background:#00a4ef"></i><i style="height:14px;background:#ffb900"></i></div>
      <div style="font:600 24px Inter;color:#1b1b1b;margin-bottom:22px">Entrar</div>
      <div class="msmail" style="border-bottom:2px solid #0067b8;padding:6px 0;font:400 17px Inter;color:#1b1b1b;height:34px"></div>
      <div style="font:400 13px Inter;color:#0067b8;margin:16px 0 26px">Conta corporativa ou de estudante</div>
      <div style="display:flex;justify-content:flex-end"><span class="msbtn" style="background:#0067b8;color:#fff;font:600 15px Inter;padding:9px 30px">Avançar</span></div>
    </div>
    <div style="position:absolute;left:0;right:0;bottom:60px;text-align:center;font:400 13px Inter;color:#666">Facens · Microsoft Entra ID</div>`, { inset: 0 })
  const mail = ms.querySelector('.msmail')
  // diagram
  const node = (x, y, inner, w = 300) => el('div', 'card', root, inner, { left: x + 'px', top: y + 'px', width: w + 'px', textAlign: 'center', padding: '22px 14px' })
  const n1 = node(820, 190, `<div style="display:flex;justify-content:center">${mascot('idle', 64)}</div><div class="pix" style="margin-top:14px;font-size:16px;color:#fde8b0">RANKTRASH</div>`, 250)
  const n2 = node(1155, 160, `<div style="display:grid;grid-template-columns:36px 36px;gap:5px;justify-content:center"><i style="height:36px;background:#f25022"></i><i style="height:36px;background:#7fba00"></i><i style="height:36px;background:#00a4ef"></i><i style="height:36px;background:#ffb900"></i></div><div style="margin-top:16px;font:700 26px Grotesk;color:#fff">Microsoft da Facens</div><div style="font:400 18px Inter;color:#8fb2d9;margin-top:4px">Entra ID · login oficial</div>`, 330)
  const n3 = node(1560, 190, `<div style="display:flex;justify-content:center">${icon('check', 64, '#8fe39a')}</div><div class="pix" style="margin-top:14px;font-size:15px;color:#8fe39a">@FACENS.BR</div>`, 250)
  const ar1 = el('div', 'abs', root, '', { left: '1078px', top: '268px', width: '70px', height: '6px', background: '#8fe39a', transformOrigin: '0 50%' })
  const ar2 = el('div', 'abs', root, '', { left: '1492px', top: '268px', width: '62px', height: '6px', background: '#8fe39a', transformOrigin: '0 50%' })
  const pk = el('div', 'abs', root, '', { width: '14px', height: '14px', background: '#fde8b0', left: 0, top: 0 })
  const CH = [['user', 'Conta que todo aluno já tem'], ['cross', 'Sem senha nova, sem cadastro'], ['check', 'Só entram contas @facens.br'], ['shield', 'A senha nunca passa pelo app'], ['star', 'Cada ponto = um aluno real']]
  const chips = CH.map(([ic, t], i) => el('div', 'chip', root, `<span class="ic">${icon(ic, 28, '#0a0f1f')}</span>${t}`, { left: '860px', top: 470 + i * 92 + 'px' }))
  const c = (i) => cap('microsoft', i)
  return (lt) => {
    const pin = ease(lt, 0, 0.8, E.out5)
    ph.place(270, 85, 0.88, { y: 85 + (1 - pin) * 600, rx: 0, ry: 8 * (1 - pin) + 4 * Math.sin(lt * 0.6), o: P(lt, 0, 0.3) })
    // screens: login -> tap -> microsoft card -> map
    const tapT = c(1) + 0.6, msT = c(2) - 0.2, backT = c(4) + 0.2
    if (lt < msT) ph.show(seq('login', lt), null)
    else if (lt < backT + 0.5) ph.show(still('login'))
    else ph.show(still('login'), seq('map', lt - backT - 0.5), ease(lt, backT + 0.5, backT + 1.0))
    ph.tapAt(lt, tapT, 195, 458)
    ms.style.opacity = env(lt, msT, backT + 0.6, 0.4, 0.4)
    tf(ms, { y: (1 - ease(lt, msT, msT + 0.5)) * 60 })
    const typed = 'aluno@facens.br'.slice(0, Math.floor(clamp((lt - msT - 0.6) * 12, 0, 15)))
    mail.textContent = typed + (lt % 0.8 < 0.4 && typed.length < 15 ? '|' : '')
    ms.querySelector('.msbtn').style.filter = lt > backT - 0.3 && lt < backT ? 'brightness(.8)' : 'none'
    // diagram
    ;[n1, n2, n3].forEach((n, i) => { const t0 = 0.4 + i * 0.35 + (i === 1 ? c(1) - 1.2 : 0); tf(n, { o: ease(lt, t0, t0 + 0.4), y: (1 - ease(lt, t0, t0 + 0.6, E.back)) * 50 }) })
    tf(ar1, { sx: ease(lt, c(1) - 0.2, c(1) + 0.3) })
    tf(ar2, { sx: ease(lt, c(3) - 0.2, c(3) + 0.3) })
    const loopT = ((lt - c(1)) % 2.2) / 2.2
    const kx = loopT < 0.5 ? lerp(1070, 1155, loopT * 2) : lerp(1490, 1560, (loopT - 0.5) * 2)
    tf(pk, { x: kx, y: 264, o: lt > c(1) + 0.3 ? 1 : 0 })
    const at = [c(0) + 0.6, c(2), c(3), c(4) + 1.6, c(5)]
    chips.forEach((ch, i) => tf(ch, { o: ease(lt, at[i], at[i] + 0.3), x: (1 - ease(lt, at[i], at[i] + 0.5, E.back)) * 120 }))
  }
})

// ---- 6. map ----
scene('map', 'O MAPA DO CAMPUS', (root) => {
  const ph = Phone(root)
  const leads = [Lead(root, '#e0413a'), Lead(root, '#5fb96a'), Lead(root, '#fde8b0')]
  const c1 = el('div', 'callout red', root, 'INEXPLORADA<small>+5 pontos na 1ª visita</small>')
  const c2 = el('div', 'callout green', root, 'JÁ VISITADA<small>lixeiras que você já usou</small>')
  const c3 = el('div', 'callout', root, 'AO VIVO<small>o que o campus está descartando</small>')
  const ttl = words(root, 'Todas as lixeiras\ndo campus,\n<span class="hl">num mapa.</span>', 'abs h1')
  Object.assign(ttl.style, { left: '1080px', top: '200px', fontSize: '76px' })
  const c = (i) => cap('map', i)
  return (lt) => {
    const zoom = 0.88 + ease(lt, 0.5, 14, E.io) * 0.06
    ph.place(330, 80, zoom, { o: 1 })
    const popT = c(2) + 1.4
    ph.show(seq('map', lt), still('map-popup'), ease(lt, popT, popT + 0.3))
    ph.tapAt(lt, popT - 0.4, 260, 421)
    wordsIn(ttl, lt, 0.3, 0.07, 0.55, c(1) - 0.6)
    const items = [[c1, leads[0], 344, 370, 1040, 300, c(1)], [c2, leads[1], 139, 350, 1040, 470, c(2)], [c3, leads[2], 300, 750, 1040, 680, c(3)]]
    items.forEach(([box, ld, ax, ay, bx, by, t0]) => {
      const a = ph.pt(ax, ay), p = ease(lt, t0, t0 + 0.6, E.io)
      ld.set(a.x, a.y, bx, by + 30, p)
      box.style.left = bx + 'px'; box.style.top = by + 'px'
      tf(box, { o: P(lt, t0 + 0.35, t0 + 0.55), x: (1 - ease(lt, t0 + 0.35, t0 + 0.8, E.back)) * 40 })
    })
  }
})

// ---- 7. camera ----
scene('camera', 'DESCARTAR', (root) => {
  const ph = Phone(root)
  const ttl = words(root, 'A câmera abre\n<span class="hl">direto no app.</span>', 'abs h1')
  Object.assign(ttl.style, { left: '1000px', top: '190px', fontSize: '74px' })
  const hud = el('div', 'abs', root, `<div style="display:inline-flex;align-items:center;gap:14px;background:#0b1e3acc;border:4px solid #5fb96a;padding:16px 22px;font:28px VT323;font-size:40px;color:#e8f1ff;box-shadow:8px 8px 0 #0a0f1f">${icon('target', 34, '#8fe39a')} Bloco A · Entrada · <b style="color:#8fe39a">0 m</b> (±6 m)</div>`, { left: '1000px', top: '470px' })
  const labels = [['LIXEIRA MAIS PRÓXIMA', 1050], ['DISTÂNCIA', 1395], ['PRECISÃO DO GPS', 1530]].map(([t, x]) => el('div', 'abs pix', root, t, { left: x + 'px', top: '575px', fontSize: '14px', color: '#fde8b0' }))
  const rings = [0, 1, 2].map(() => el('div', 'abs', root, '', { left: '1180px', top: '780px', width: '120px', height: '120px', marginLeft: '-60px', marginTop: '-60px', borderRadius: '50%', border: '4px solid #8fe39a' }))
  const pin = el('div', 'abs', root, icon('map', 70, '#f4a259'), { left: '1145px', top: '730px' })
  const gpsT = el('div', 'abs h3', root, 'GPS acompanhando\nem tempo real', { left: '1290px', top: '745px', whiteSpace: 'pre', fontWeight: 500, fontSize: '32px', color: '#8fb2d9' })
  const lead = Lead(root, '#8fe39a')
  const c = (i) => cap('camera', i)
  return (lt) => {
    const pin_ = ease(lt, 0, 0.7, E.out5)
    ph.place(300 - (1 - pin_) * 500, 80, 0.88, { r: (1 - pin_) * -8 })
    ph.show(seq('camera', lt))
    wordsIn(ttl, lt, 0.3, 0.08)
    const t1 = c(1)
    tf(hud, { o: ease(lt, t1, t1 + 0.3), s: 0.8 + 0.2 * ease(lt, t1, t1 + 0.6, E.back) })
    const a = ph.pt(100, 62); lead.set(a.x, a.y, 1000, 505, ease(lt, t1 - 0.2, t1 + 0.4))
    labels.forEach((l, i) => tf(l, { o: ease(lt, t1 + 0.8 + i * 0.6, t1 + 1.1 + i * 0.6) }))
    rings.forEach((r, i) => { const q = ((lt + i * 0.7) % 2.1) / 2.1; tf(r, { s: 0.3 + q * 1.6, o: lt > 0.8 ? (1 - q) * 0.8 : 0 }) })
    tf(pin, { o: ease(lt, 0.8, 1.1), y: Math.abs(Math.sin(lt * 3)) * -10 })
    tf(gpsT, { o: ease(lt, 1.0, 1.4) })
  }
})

// ---- 8. ai ----
scene('ai', 'INTELIGÊNCIA ARTIFICIAL', (root) => {
  const ph = Phone(root)
  const panel = el('div', 'card', root, '', { left: '1000px', top: '170px', width: '760px', padding: '30px 36px' })
  const head = el('div', '', panel, `<div style="display:flex;align-items:center;gap:16px"><svg width="44" height="44" viewBox="0 0 24 24"><path d="M12 1 C13 7 17 11 23 12 C17 13 13 17 12 23 C11 17 7 13 1 12 C7 11 11 7 12 1Z" fill="url(#gg)"/><defs><linearGradient id="gg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4f8df5"/><stop offset=".6" stop-color="#9b72e8"/><stop offset="1" stop-color="#e8738a"/></linearGradient></defs></svg>
    <div><div style="font:700 34px Grotesk;color:#fff">Análise por IA</div><div style="font:400 20px Inter;color:#8fb2d9">Google Gemini · leitura da foto</div></div></div>`)
  const rows = [['ITEM', 'Lata de refrigerante'], ['MATERIAL', 'Alumínio'], ['ESTADO', 'Amassada'], ['LIXEIRA NA FOTO', 'Sim'], ['FOTO DE TELA?', 'Não'], ['CONFIANÇA', '']]
  const rEls = rows.map(([k, v]) => el('div', '', panel, `<span class="pix" style="font-size:14px;color:#8fb2d9;display:inline-block;width:250px">${k}</span><span class="v vt" style="font-size:40px;color:#8fe39a"></span>`, { marginTop: '22px', display: 'flex', alignItems: 'center' }))
  const bar = el('div', '', rEls[5].querySelector('.v'), '', { display: 'inline-block', width: '360px', height: '24px', background: '#16335e', verticalAlign: 'middle', position: 'relative' })
  const fill = el('div', '', bar, '', { position: 'absolute', left: 0, top: 0, bottom: 0, width: '0', background: 'linear-gradient(90deg,#5fb96a,#8fe39a)' })
  const pc = el('span', 'vt', rEls[5].querySelector('.v'), '', { marginLeft: '16px', fontSize: '40px', color: '#8fe39a' })
  const secs = el('div', 'abs pix', root, 'EM POUCOS SEGUNDOS', { left: '1000px', top: '800px', fontSize: '18px', color: '#fde8b0' })
  const c = (i) => cap('ai', i)
  const scanStart = 1.0
  return (lt) => {
    ph.place(300, 80, 0.88)
    ph.tapAt(lt, 0.35, 195, 590)
    if (lt < scanStart) ph.show(seq('preview', lt))
    else ph.show(seq('scan', lt - scanStart, { loop: true }))
    tf(panel, { o: ease(lt, 0.4, 0.8), x: (1 - ease(lt, 0.4, 1.0, E.back)) * 80 })
    const t0 = c(1) - 0.5
    rows.forEach(([k, v], i) => {
      const ti = t0 + i * 0.75
      tf(rEls[i], { o: ease(lt, ti, ti + 0.25) })
      if (v) { const n = Math.floor(clamp((lt - ti - 0.15) * 30, 0, v.length)); rEls[i].querySelector('.v').textContent = v.slice(0, n) + (n < v.length && n > 0 ? '█' : '') }
    })
    const cp = ease(lt, t0 + 5 * 0.75, t0 + 5 * 0.75 + 1.0)
    fill.style.width = cp * 93 + '%'; pc.textContent = Math.round(cp * 93) + '%'
    tf(secs, { o: ease(lt, c(1) + 2.5, c(1) + 2.9) })
  }
})

// ---- 9. result ----
scene('result', 'RESULTADO', (root) => {
  const ph = Phone(root)
  const pts = el('div', 'abs pix', root, '+15', { left: '1050px', top: '170px', fontSize: '150px', color: '#8fe39a', textShadow: '10px 10px 0 #0a0f1f' })
  const ptsL = el('div', 'abs pix', root, 'PONTOS', { left: '1062px', top: '350px', fontSize: '30px', color: '#fff' })
  const R = rng(5)
  const coins = Array.from({ length: 18 }, () => ({ e: el('div', 'abs', root, `<div style="width:34px;height:34px;background:#f5c518;border:4px solid #0a0f1f;box-shadow:inset -6px -6px 0 #c9972b"></div>`, { left: '1200px', top: '260px' }), a: -Math.PI * (0.1 + R() * 0.8), v: 500 + R() * 600, sp: R() * 720 }))
  const cards = [
    [`<div style="display:flex;align-items:center;gap:20px"><div style="width:58px;height:58px;background:#f5c518;border:4px solid #0a0f1f;flex:none"></div><div><div class="pix" style="font-size:14px;color:#8fb2d9">VAI NA LIXEIRA</div><div style="font:700 40px Grotesk;color:#f5c518;margin-top:6px">AMARELA · metal</div></div></div>`, 470],
    [`<div style="display:flex;align-items:center;gap:20px"><div style="font-size:50px">💡</div><div><div class="pix" style="font-size:14px;color:#8fb2d9">DICA</div><div style="font:700 36px Grotesk;color:#fff;margin-top:6px">Amasse a lata para<br>ocupar menos espaço</div></div></div>`, 620],
    [`<div style="display:flex;align-items:center;gap:20px">${icon('star', 50, '#8fe39a')}<div style="font:700 34px Grotesk;color:#8fe39a">Cada descarte, uma aula<br>de educação ambiental</div></div>`, 790],
  ].map(([h, y]) => el('div', 'card', root, h, { left: '1050px', top: y + 'px', width: '700px' }))
  const c = (i) => cap('result', i)
  return (lt) => {
    ph.place(300, 80, 0.88)
    const scrollT = c(3)
    if (lt < scrollT) ph.show(seq('result', lt))
    else ph.show(seq('result-scroll', (lt - scrollT) * 0.6))
    const p = ease(lt, 0.25, 0.8, E.back)
    tf(pts, { s: 0.3 + 0.7 * p, o: P(lt, 0.25, 0.4), r: (1 - p) * -10 })
    tf(ptsL, { o: ease(lt, 0.6, 0.9) })
    coins.forEach((q) => { const t = clamp(lt - 0.35, 0, 3); tf(q.e, { x: Math.cos(q.a) * q.v * t, y: Math.sin(q.a) * q.v * t + 900 * t * t, r: q.sp * t, o: lt > 0.35 && t < 1.6 ? 1 : 0 }) })
    const at = [c(2), c(3), c(4)]
    cards.forEach((cd, i) => tf(cd, { o: ease(lt, at[i], at[i] + 0.3), x: (1 - ease(lt, at[i], at[i] + 0.55, E.back)) * 100 }))
  }
})

// ---- 10. antifraud ----
scene('antifraud', 'JOGO LIMPO', (root) => {
  const ph = Phone(root)
  const flash = el('div', 'abs', root, '', { inset: 0, background: '#e0413a', mixBlendMode: 'screen' })
  const ttl = words(root, 'Antifraude em\n<span class="hlo">várias camadas.</span>', 'abs h2')
  Object.assign(ttl.style, { left: '960px', top: '150px', fontSize: '64px' })
  const L = [['camera', 'Foto tirada na hora, pela câmera'], ['target', 'Impressão digital da imagem (foto repetida)'], ['phone', 'Foto de tela é recusada'], ['flame', 'Limites: 1 por minuto · 20 por dia'], ['shield', 'Pontos calculados só no servidor'], ['user', 'Auditoria humana do top 10']]
  const items = L.map(([ic, t], i) => el('div', 'chip', root, `<span class="ic" style="background:${i === 5 ? '#f4a259' : '#5fb96a'}">${icon(ic, 28, '#0a0f1f')}</span>${t}`, { left: '960px', top: 350 + i * 92 + 'px', fontSize: '26px' }))
  const c = (i) => cap('antifraud', i)
  return (lt) => {
    const shake = lt > 0.3 && lt < 0.8 ? Math.sin(lt * 80) * 10 * (1 - P(lt, 0.3, 0.8)) : 0
    ph.place(300 + shake, 80, 0.88)
    ph.show(still('result2'))
    flash.style.opacity = lt < 0.7 ? 0.18 * (1 - P(lt, 0.3, 0.7)) * (lt > 0.3 ? 1 : 0) : 0
    wordsIn(ttl, lt, 0.4, 0.08)
    const at = [c(1), c(2), c(3), c(3) + 1.2, c(3) + 2.5, c(3) + 3.8]
    items.forEach((it, i) => tf(it, { o: ease(lt, at[i], at[i] + 0.3), x: (1 - ease(lt, at[i], at[i] + 0.55, E.back)) * 100 }))
  }
})

// ---- 11. ranking ----
scene('ranking', 'RANKING', (root) => {
  const ph = Phone(root)
  const ph2 = Phone(root)
  const ttl = words(root, 'Ranking mensal,\ncom <span class="hly">prêmios.</span>', 'abs h2')
  Object.assign(ttl.style, { left: '1330px', top: '170px', fontSize: '60px' })
  const pod = [[2, 'PRATA', '#cfd6df', 170], [1, 'OURO', '#f5c518', 240], [3, 'BRONZE', '#f4a259', 120]].map(([n, l, col, h], i) => el('div', 'abs', root,
    `<div style="display:flex;justify-content:center;margin-bottom:12px">${icon('trophy', 54, col)}</div><div style="height:${h}px;background:${col};border:5px solid #0a0f1f;box-shadow:8px 8px 0 #0a0f1f;display:grid;place-items:center" class="pix"><span style="font-size:34px;color:#0a0f1f">${n}º</span></div>`, { left: 1340 + i * 160 + 'px', top: 680 - h + 'px', width: '140px', transformOrigin: '50% 100%' }))
  const tag1 = el('div', 'sticker', root, 'GUERRA DE CURSOS', { left: '1000px', top: '110px' })
  const tag2 = el('div', 'sticker', root, 'ÚLTIMOS 7 DIAS', { left: '1000px', top: '110px', background: '#8fe39a' })
  const c = (i) => cap('ranking', i)
  const tC = c(1) + 0.3, tW = c(1) + N.ranking.caps[1].d * 0.7
  return (lt) => {
    ph.place(250, 80, 0.88)
    if (lt < 3) ph.show(seq('ranking', lt))
    else ph.show(seq('ranking-scroll', (lt - 3) * 0.9))
    const p2 = ease(lt, tC - 0.3, tC + 0.4, E.out5)
    ph2.place(760 + (1 - p2) * 900, 80, 0.88, { o: P(lt, tC - 0.3, tC) })
    ph2.show(still('ranking-cursos'), still('ranking-semana'), ease(lt, tW, tW + 0.35))
    ph2.tapAt(lt, tW - 0.25, 340, 120)
    wordsIn(ttl, lt, 0.3, 0.08)
    pod.forEach((d, i) => { const t0 = 0.9 + [0.25, 0, 0.5][i]; tf(d, { sy: ease(lt, t0, t0 + 0.6, E.back), o: P(lt, t0, t0 + 0.1) }) })
    tf(tag1, { x: 760 - 1000 + 60, y: 0, o: ease(lt, tC + 0.2, tC + 0.5) * (1 - ease(lt, tW - 0.1, tW + 0.1)) })
    tf(tag2, { x: 760 - 1000 + 60, o: ease(lt, tW + 0.1, tW + 0.4) })
  }
})

// ---- 12. profile ----
scene('profile', 'PERFIL E IMPACTO', (root) => {
  const ph = Phone(root)
  const C = [['star', 'NÍVEL E XP', 'nunca zera', '#f5c518'], ['flame', 'SEQUÊNCIA', 'dias seguidos', '#f4a259'], ['trophy', 'CONQUISTAS', 'medalhas pixel', '#7cc3f5'], ['check', 'IMPACTO', 'itens e kg fora do aterro', '#8fe39a']]
  const cards = C.map(([ic, t, s, col], i) => el('div', 'card', root, `<div style="display:flex;align-items:center;gap:22px">${icon(ic, 56, col)}<div><div class="pix" style="font-size:20px;color:${col}">${t}</div><div style="font:500 26px Inter;color:#8fb2d9;margin-top:8px">${s}</div></div></div>`, { left: 1000 + (i % 2) * 400 + 'px', top: 300 + Math.floor(i / 2) * 200 + 'px', width: '370px' }))
  const kg = el('div', 'abs', root, '<span class="pix" style="font-size:22px;color:#fde8b0">KG DESVIADOS DO ATERRO</span>', { left: '1000px', top: '720px' })
  const kgN = el('div', 'abs pix', root, '', { left: '1000px', top: '770px', fontSize: '70px', color: '#8fe39a', textShadow: '6px 6px 0 #0a0f1f' })
  const ttl = words(root, 'Progresso que\n<span class="hl">dá para ver.</span>', 'abs h2')
  Object.assign(ttl.style, { left: '1000px', top: '130px', fontSize: '62px' })
  const c = (i) => cap('profile', i)
  return (lt) => {
    ph.place(300, 80, 0.88)
    ph.show(seq('perfil-scroll', clamp(lt - 1.2, 0, 99) * 0.75))
    wordsIn(ttl, lt, 0.2, 0.08)
    const d = N.profile.caps[0].d
    const at = [c(0) + d * 0.35, c(0) + d * 0.55, c(0) + d * 0.75, c(1)]
    cards.forEach((cd, i) => tf(cd, { o: ease(lt, at[i], at[i] + 0.3), y: (1 - ease(lt, at[i], at[i] + 0.55, E.back)) * 60 }))
    tf(kg, { o: ease(lt, c(1) + 0.6, c(1) + 0.9) })
    tf(kgN, { o: ease(lt, c(1) + 0.6, c(1) + 0.9) })
    kgN.textContent = (ease(lt, c(1) + 0.6, c(1) + 3, E.out) * 0.05).toFixed(2).replace('.', ',') + ' kg'
  }
})

// ---- 13. admin ----
scene('admin', 'PAINEL ADMIN', (root) => {
  const S = [['admin', 'LIXEIRAS NO MAPA'], ['admin-revis', 'FILA DE REVISÃO'], ['admin-temporada', 'AUDITORIA DO TOP 10'], ['admin-usu', 'GESTÃO DE USUÁRIOS']]
  const phones = S.map(() => Phone(root))
  const labels = S.map(([, t]) => el('div', 'sticker', root, t, { fontSize: '15px' }))
  const ttl = words(root, 'Painel para a equipe <span class="hl">Lixo Zero</span>', 'abs h2')
  Object.assign(ttl.style, { left: 0, right: 0, top: '105px', textAlign: 'center', fontSize: '52px' })
  const c = (i) => cap('admin', i)
  return (lt) => {
    wordsIn(ttl, lt, 0.2, 0.07)
    const d = N.admin.caps[1].d
    const hiT = [c(1), c(1) + d * 0.3, c(1) + d * 0.55, c(1) + d * 0.8].map((x) => x - 0.2)
    let active = -1; hiT.forEach((t, i) => { if (lt > t) active = i })
    phones.forEach((ph, i) => {
      const t0 = 0.3 + i * 0.18
      const p = ease(lt, t0, t0 + 0.8, E.out5)
      const act = i === active
      const a = ease(lt, hiT[i], hiT[i] + 0.35)
      const x = 180 + i * 400, y = 30 + (1 - p) * 700 - (act ? 24 : 0) * a
      ph.place(x, y, 0.62 + (act ? 0.05 * a : 0), { o: P(lt, t0, t0 + 0.2), ry: (i - 1.5) * -6 })
      ph.e.style.filter = active >= 0 && !act ? 'brightness(.55)' : 'none'
      ph.e.style.zIndex = act ? 2 : 1
      ph.show(still(S[i][0]))
      const lb = labels[i]; lb.style.left = x + 215 + 'px'; lb.style.top = '815px'
      tf(lb, { x: -lb.offsetWidth / 2, o: ease(lt, hiT[i], hiT[i] + 0.3) * (active === i ? 1 : 0.55) })
    })
  }
})

// ---- 14. data ----
scene('data', 'DADOS PARA A FACENS', (root) => {
  const ttl = words(root, 'Dados: <span class="hl">o quê, onde e quando.</span>', 'abs h2')
  Object.assign(ttl.style, { left: '140px', top: '130px', fontSize: '60px' })
  const note = el('div', 'abs pix', root, 'ILUSTRAÇÃO · OS NÚMEROS REAIS VÊM DO PILOTO', { left: '140px', top: '850px', fontSize: '13px', color: '#8fb2d9' })
  const box = (x, y, w, h, t) => { const b = el('div', 'card', root, `<div class="pix" style="font-size:15px;color:#fde8b0">${t}</div>`, { left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px' }); return b }
  const b1 = box(140, 250, 560, 570, 'O QUÊ · POR MATERIAL')
  const MAT = [['Plástico', '#e0413a', 0.86], ['Papel', '#2d6fd6', 0.72], ['Alumínio', '#f5c518', 0.55], ['Orgânico', '#8a5a2b', 0.4], ['Vidro', '#2f9a4a', 0.22], ['Eletrônico', '#f4a259', 0.1]]
  const bars = MAT.map(([n, c, v], i) => {
    const r = el('div', '', b1, `<div style="font:500 22px Inter;color:#e8f1ff;width:140px">${n}</div><div style="flex:1;height:36px;background:#16335e;position:relative"><i style="position:absolute;left:0;top:0;bottom:0;background:${c};width:0"></i></div>`, { display: 'flex', alignItems: 'center', gap: '14px', marginTop: i ? '26px' : '40px' })
    return { i: r.querySelector('i'), v }
  })
  const b2 = box(740, 250, 520, 570, 'ONDE · POR LIXEIRA')
  const map = el('div', '', b2, '', { position: 'relative', marginTop: '20px', height: '470px', background: '#0b1e3a', border: '3px solid #16335e', overflow: 'hidden' })
  el('div', '', map, '', { position: 'absolute', left: '40px', top: '60px', width: '160px', height: '90px', background: '#1a3a66' })
  el('div', '', map, '', { position: 'absolute', left: '260px', top: '40px', width: '150px', height: '120px', background: '#1a3a66' })
  el('div', '', map, '', { position: 'absolute', left: '90px', top: '260px', width: '220px', height: '110px', background: '#1a3a66' })
  el('div', '', map, '', { position: 'absolute', left: '0', top: '210px', width: '100%', height: '10px', background: '#2b4f80' })
  const DOTS = [[120, 170, 70], [330, 190, 50], [210, 230, 95], [380, 330, 35], [140, 400, 45], [60, 300, 25]]
  const dots = DOTS.map(([x, y, s]) => el('div', '', map, '', { position: 'absolute', left: x + 'px', top: y + 'px', width: s + 'px', height: s + 'px', marginLeft: -s / 2 + 'px', marginTop: -s / 2 + 'px', borderRadius: '50%', background: 'rgba(143,227,154,.55)', border: '3px solid #8fe39a' }))
  const b3 = box(1300, 250, 480, 570, 'QUANDO · POR HORÁRIO')
  const hm = el('div', '', b3, '', { display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: '6px', marginTop: '30px' })
  const R = rng(9)
  const cells = Array.from({ length: 8 * 9 }, (_, i) => { const col = i % 8, row = Math.floor(i / 8); const peak = Math.exp(-Math.pow(col - 3.2, 2) / 3) * 0.8 + Math.exp(-Math.pow(col - 6.5, 2) / 2) * 0.5; const v = clamp(peak * (row < 5 ? 1 : 0.4) + R() * 0.2); return { e: el('div', '', hm, '', { height: '44px', background: `rgba(244,162,89,${0.12 + v * 0.88})` }), v } })
  el('div', '', b3, '<span>7h</span><span>12h</span><span>18h</span><span>22h</span>', { display: 'flex', justifyContent: 'space-between', marginTop: '14px', font: '400 20px Inter', color: '#8fb2d9' })
  const c = (i) => cap('data', i)
  const hiQ = c(2) + 1.6, hiW = c(2) + 2.4, hiN = c(2) + 3.0
  return (lt) => {
    wordsIn(ttl, lt, 0.3, 0.07)
    tf(note, { o: ease(lt, 1.0, 1.4) * 0.9 })
    ;[b1, b2, b3].forEach((b, i) => {
      const t0 = c(1) + i * 0.25
      const hi = [hiQ, hiW, hiN][i]
      const glow = env(lt, hi, hi + 1.4, 0.2, 0.4)
      b.style.borderColor = glow > 0.05 ? '#8fe39a' : '#3d8fd1'
      tf(b, { o: ease(lt, t0, t0 + 0.3), y: (1 - ease(lt, t0, t0 + 0.6, E.back)) * 80 - glow * 12 })
    })
    bars.forEach((b, i) => { b.i.style.width = ease(lt, c(1) + 0.6 + i * 0.12, c(1) + 1.6 + i * 0.12, E.out) * b.v * 100 + '%' })
    dots.forEach((d, i) => { const p = ease(lt, c(1) + 0.9 + i * 0.12, c(1) + 1.4 + i * 0.12, E.back); tf(d, { s: p * (1 + 0.08 * Math.sin(lt * 3 + i)), o: P(lt, c(1) + 0.9 + i * 0.12, c(1) + 1.0 + i * 0.12) }) })
    cells.forEach((q, i) => tf(q.e, { o: ease(lt, c(1) + 1.0 + i * 0.012, c(1) + 1.3 + i * 0.012) }))
  }
})

// ---- 15. impact ----
scene('impact', 'POR QUE IMPORTA', (root) => {
  const COLS = [
    ['FACENS', 'Inovação a serviço da sustentabilidade, feita por alunos para o próprio campus.', 'shield', '#7cc3f5'],
    ['COMUNIDADE', 'Um hábito que começa na faculdade e vai para casa.', 'user', '#f4a259'],
    ['MUNDO', 'Contribuição concreta aos Objetivos de Desenvolvimento Sustentável da ONU.', 'map', '#8fe39a'],
  ]
  const cols = COLS.map(([t, d, ic, col], i) => el('div', 'card', root, `<div style="display:flex;align-items:center;gap:20px">${icon(ic, 60, col)}<div class="pix" style="font-size:26px;color:${col}">${t}</div></div><div style="font:500 32px Grotesk;line-height:1.25;color:#fff;margin-top:28px">${d}</div>`, { left: 140 + i * 560 + 'px', top: '200px', width: '520px', height: '360px', padding: '36px' }))
  const ODS = [[12, 'CONSUMO E PRODUÇÃO\nRESPONSÁVEIS', '#BF8B2E'], [4, 'EDUCAÇÃO DE\nQUALIDADE', '#C5192D'], [11, 'CIDADES E COMUNIDADES\nSUSTENTÁVEIS', '#FD9D24'], [13, 'AÇÃO CONTRA A MUDANÇA\nGLOBAL DO CLIMA', '#3F7E44']]
  const tiles = ODS.map(([n, t, col], i) => el('div', 'abs', root, `<div style="background:${col};color:#fff;padding:18px 20px;height:100%;box-shadow:8px 8px 0 #0a0f1f"><div style="font:700 ${i ? 54 : 78}px Grotesk;line-height:1">${n}</div><div style="font:700 ${i ? 16 : 21}px Inter;line-height:1.25;margin-top:8px;white-space:pre">${t}</div></div>`, { left: (i ? 760 + (i - 1) * 345 : 140) + 'px', top: i ? '640px' : '610px', width: (i ? 320 : 560) + 'px', height: (i ? 200 : 250) + 'px' }))
  const odsL = el('div', 'abs pix', root, 'ODS · ONU', { left: '760px', top: '600px', fontSize: '15px', color: '#8fb2d9' })
  const c = (i) => cap('impact', i)
  return (lt) => {
    const at = [c(0), c(1), c(2)]
    cols.forEach((cl, i) => {
      const fo = 1 - ease(lt, c(3) - 0.3, c(3) + 0.2) * 0
      tf(cl, { o: ease(lt, at[i], at[i] + 0.35) * fo, y: (1 - ease(lt, at[i], at[i] + 0.6, E.back)) * 90 })
    })
    const t12 = c(3) + 1.2
    tiles.forEach((tl, i) => { const t0 = i ? t12 + 0.6 + i * 0.2 : t12; tf(tl, { o: ease(lt, t0, t0 + 0.3), s: 0.7 + 0.3 * ease(lt, t0, t0 + 0.5, E.back), y: (1 - ease(lt, t0, t0 + 0.5)) * 40 }) })
    tf(odsL, { o: ease(lt, t12 + 0.8, t12 + 1.1) })
  }
})

// ---- 16. cost ----
scene('cost', 'CUSTO E ESCALA', (root) => {
  const big = el('div', 'abs pix', root, '', { left: '140px', top: '220px', fontSize: '150px', color: '#8fe39a', textShadow: '10px 10px 0 #0a0f1f', whiteSpace: 'nowrap' })
  const sub = el('div', 'abs h3', root, 'custo de operação quase zero', { left: '150px', top: '420px', fontWeight: 500, fontSize: '40px', color: '#8fb2d9' })
  const CH = [['check', 'Roda em serviços gratuitos'], ['phone', 'Funciona em qualquer celular'], ['addBox', 'Sem loja de aplicativos (PWA)'], ['share', 'Replicável em qualquer universidade']]
  const chips = CH.map(([ic, t], i) => el('div', 'chip', root, `<span class="ic">${icon(ic, 28, '#0a0f1f')}</span>${t}`, { left: '150px', top: 520 + i * 92 + 'px' }))
  // campus multiplication
  const grid = el('div', 'abs', root, '', { left: '1150px', top: '230px', width: '620px', height: '620px' })
  const R = rng(21)
  const camp = Array.from({ length: 36 }, (_, i) => { const x = (i % 6) * 104, y = Math.floor(i / 6) * 104; return { e: el('div', 'abs', grid, mascot('idle', 64), { left: x + 'px', top: y + 'px' }), d: i === 14 ? 0 : 0.2 + Math.hypot((i % 6) - 2, Math.floor(i / 6) - 2) * 0.22 + R() * 0.15 } })
  const fac = el('div', 'sticker', root, 'FACENS', { left: '1340px', top: '470px' })
  const c = (i) => cap('cost', i)
  return (lt) => {
    const v = ease(lt, 0.2, 1.4)
    big.textContent = 'R$ ' + Math.round((1 - v) * 999)
    tf(big, { o: ease(lt, 0.1, 0.4) })
    tf(sub, { o: ease(lt, 1.0, 1.4) })
    const d = N.cost.caps[1].d
    const at = [c(1), c(1) + d * 0.3, c(1) + d * 0.55, c(1) + d * 0.78]
    chips.forEach((ch, i) => tf(ch, { o: ease(lt, at[i], at[i] + 0.3), x: (1 - ease(lt, at[i], at[i] + 0.55, E.back)) * 100 }))
    const t0 = c(1) + d * 0.45
    camp.forEach((q, i) => { const p = i === 14 ? ease(lt, 0.6, 1.2, E.back) : ease(lt, t0 + q.d * 1.1, t0 + q.d * 1.1 + 0.4, E.back); tf(q.e, { s: p, o: i === 14 ? 1 : 0.85 }) })
    tf(fac, { o: ease(lt, 0.9, 1.2) })
  }
})

// ---- 17. close ----
scene('close', '', (root) => {
  const m = el('div', 'abs', root, '', { left: '860px', top: '150px' })
  const plate = el('div', 'abs', root, `<div class="plate" style="font-size:60px">RANK ${EYES_LOGO(100)} TRASH</div>`, { left: 0, right: 0, top: '420px', textAlign: 'center' })
  const tag = el('div', 'abs pix', root, 'DESCARTE CERTO · GANHE PONTOS · SUBA NO RANKING', { left: 0, right: 0, top: '600px', textAlign: 'center', fontSize: '22px', color: '#fde8b0' })
  const url = el('div', 'abs', root, 'ranktrash.eco.br', { left: 0, right: 0, top: '670px', textAlign: 'center', font: '700 54px Grotesk', color: '#8fe39a' })
  const foot = el('div', 'abs pix', root, 'PROJETO UPX · FACENS · CAMPANHA LIXO ZERO', { left: 0, right: 0, top: '800px', textAlign: 'center', fontSize: '16px', color: '#8fb2d9' })
  const c = (i) => cap('close', i)
  return (lt) => {
    m.innerHTML = mascot(lt > c(2) ? 'happy' : 'idle', 200)
    tf(m, { y: (1 - ease(lt, 0, 0.7, E.back)) * -260 + Math.sin(lt * 2.4) * 6, o: P(lt, 0, 0.2) })
    tf(plate, { s: 0.6 + 0.4 * ease(lt, 0.3, 0.9, E.back), o: P(lt, 0.3, 0.5) })
    tf(tag, { o: ease(lt, c(1), c(1) + 0.4), y: (1 - ease(lt, c(1), c(1) + 0.4)) * 20 })
    tf(url, { o: ease(lt, c(2) + 0.6, c(2) + 1.0), s: 0.9 + 0.1 * ease(lt, c(2) + 0.6, c(2) + 1.1, E.back) })
    tf(foot, { o: ease(lt, c(2) + 1.2, c(2) + 1.6) })
  }
}, { pad: 4.5 })

// =====================================================================================
// ENGINE
// =====================================================================================
let acc = 0
SCENES.forEach((s) => { s.start = acc; acc += s.dur; s.end = acc })
const TOTAL = acc
const WIPES = new Set(['hook', 'reveal', 'microsoft', 'antifraud', 'admin', 'data', 'impact', 'close'])
const root0 = $('#scenes')
SCENES.forEach((s) => { s.root = el('div', 'scene', root0); s.update = s.build(s.root) })
const chapters = SCENES.filter((s) => s.chapter)
function sceneAt(t) { return SCENES.find((s) => t >= s.start && t < s.end) || SCENES[SCENES.length - 1] }

window.TIMELINE = { total: TOTAL, scenes: SCENES.map((s) => ({ key: s.key, start: s.start, end: s.end, narr: N[s.key] ? s.start + NARR_OFFSET : null })), wipes: SCENES.filter((s) => WIPES.has(s.key)).map((s) => s.start) }

window.seek = async function (t) {
  pending.length = 0
  drawBg(t)
  const cur = sceneAt(t)
  // transitions: plain scenes crossfade/slide over 0.35s; wiped scenes swap under the wipe
  SCENES.forEach((s) => {
    const vis = s === cur
    s.root.style.display = vis ? 'block' : 'none'
    if (vis) {
      const lt = t - s.start
      s.update(lt)
      const inT = WIPES.has(s.key) ? 1 : ease(lt, 0, 0.35)
      const nxt = SCENES[SCENES.indexOf(s) + 1]
      const outT = nxt && !WIPES.has(nxt.key) ? 1 - ease(t, s.end - 0.3, s.end, E.in) : 1
      s.root.style.opacity = Math.min(inT, outT)
      s.root.style.transform = `translateY(${(1 - inT) * 30}px) scale(${1 - (1 - outT) * 0.03})`
    }
  })
  // wipe
  let T = null
  for (const w of window.TIMELINE.wipes) if (Math.abs(t - w) < 0.45) T = w
  drawWipe(t, T)
  // hud
  const chapIdx = chapters.indexOf(cur)
  $('#hud').style.opacity = cur.key === 'intro' ? 0 : 1
  $('#chapNum').parentElement.style.opacity = cur.chapter ? 1 : 0
  $('#chapNum').textContent = String(chapIdx + 1).padStart(2, '0')
  $('#chapName').textContent = cur.chapter
  $('#chapName').style.maxWidth = ease(t - cur.start, 0.1, 0.7, E.io) * 600 + 'px'
  $('#prog').style.width = (t / TOTAL) * 100 + '%'
  // captions
  let capTxt = '', capO = 0
  if (N[cur.key]) {
    const lt = t - cur.start - NARR_OFFSET
    for (const c of N[cur.key].caps) {
      if (lt >= c.t - 0.05 && lt < c.t + c.d + 0.25) { capTxt = c.text; capO = Math.min(P(lt, c.t - 0.05, c.t + 0.12), 1 - P(lt, c.t + c.d + 0.1, c.t + c.d + 0.25)) }
    }
  }
  const ct = $('#capText'); ct.textContent = capTxt; ct.parentElement.style.opacity = capTxt ? capO : 0
  // global fade in/out
  $('#fade').style.opacity = Math.max(1 - P(t, 0, 0.6), P(t, TOTAL - 1.5, TOTAL))
  await Promise.all(pending)
  await document.fonts.ready
}
window.ready = (async () => { await document.fonts.ready; await window.seek(0) })()

// ---------- sound-effect cues (absolute seconds), consumed by audio/mix.py ----------
window.CUES = (() => {
  const S = Object.fromEntries(SCENES.map((s) => [s.key, s]))
  const out = []
  const q = (key, lt, name, gain = 1) => out.push({ t: +(S[key].start + lt).toFixed(3), name, gain })
  window.TIMELINE.wipes.forEach((w) => out.push({ t: w - 0.42, name: 'whoosh', gain: 0.9 }))
  SCENES.forEach((s) => { if (!WIPES.has(s.key) && s.key !== 'intro') out.push({ t: s.start - 0.15, name: 'swish', gain: 0.6 }) })
  q('intro', 0.25, 'pop', 0.8); q('intro', 1.0, 'blip', 0.5)
  const hs2 = cap('hook', 1) + 2.0
  for (let i = 0; i < 6; i++) q('hook', hs2 + 0.15 + i * 0.08, 'blip', 0.45)
  q('hook', cap('hook', 2) - 0.1, 'question', 0.8)
  q('problem', 1.6, 'thud', 0.9); q('problem', 2.6, 'error', 0.6)
  for (let i = 96; i < 100; i++) q('problem', cap('problem', 1) + 1.2 + (i - 96) * 0.15, 'blip', 0.5)
  q('problem', cap('problem', 2) + 1.2, 'scratch', 0.7)
  for (let i = 0; i < 3; i++) q('problem', cap('problem', 3) + 0.5 + i * 0.75, 'pop', 0.7)
  q('reveal', 0.45, 'thud', 1); q('reveal', 0.75, 'powerup', 0.9); q('reveal', cap('reveal', 1) + 0.25, 'sparkle', 0.8)
  const s1 = cap('steps', 1), d1 = N.steps.caps[1].d
  ;[0.0, 0.2, 0.42, 0.68, 0.88].forEach((f, i) => q('steps', s1 + f * d1 - 0.1, 'pop', 0.75))
  const mc = (i) => cap('microsoft', i)
  q('microsoft', mc(1) + 0.6, 'tap', 0.9); q('microsoft', mc(2) - 0.2, 'swish', 0.5)
  for (let i = 0; i < 15; i++) q('microsoft', mc(2) - 0.2 + 0.6 + i / 12, 'key', 0.25)
  q('microsoft', mc(4) + 0.0, 'tap', 0.8); q('microsoft', mc(4) + 0.6, 'success', 0.7)
  ;[mc(0) + 0.6, mc(2), mc(3), mc(4) + 1.6, mc(5)].forEach((t) => q('microsoft', t, 'blip', 0.5))
  ;[1, 2, 3].forEach((i) => q('map', cap('map', i) + 0.35, 'blip', 0.55)); q('map', cap('map', 2) + 1.0, 'tap', 0.8)
  q('camera', cap('camera', 1), 'blip', 0.5); q('camera', 0.9, 'radar', 0.5)
  q('ai', 0.35, 'shutter', 1); q('ai', 1.0, 'scan', 0.6)
  for (let i = 0; i < 6; i++) q('ai', cap('ai', 1) - 0.5 + i * 0.75 + 0.15, 'key', 0.3)
  q('result', 0.25, 'coin', 1); q('result', 0.45, 'success', 0.6)
  ;[2, 3, 4].forEach((i) => q('result', cap('result', i), 'blip', 0.5))
  q('antifraud', 0.3, 'error', 0.9)
  const ac = (i) => cap('antifraud', i)
  ;[ac(1), ac(2), ac(3), ac(3) + 1.2, ac(3) + 2.5, ac(3) + 3.8].forEach((t) => q('antifraud', t, 'pop', 0.55))
  q('ranking', 0.9, 'powerup', 0.5); q('ranking', cap('ranking', 1) + 0.0, 'swish', 0.6)
  q('ranking', cap('ranking', 1) + N.ranking.caps[1].d * 0.7 - 0.25, 'tap', 0.7)
  const pd = N.profile.caps[0].d, pc = cap('profile', 0)
  ;[pc + pd * 0.35, pc + pd * 0.55, pc + pd * 0.75, cap('profile', 1)].forEach((t) => q('profile', t, 'pop', 0.55))
  const ad = N.admin.caps[1].d
  ;[0, 0.3, 0.55, 0.8].forEach((f) => q('admin', cap('admin', 1) + ad * f - 0.2, 'blip', 0.55))
  q('data', cap('data', 1), 'powerup', 0.5)
  ;[0, 1, 2].forEach((i) => q('impact', cap('impact', i), 'pop', 0.6)); q('impact', cap('impact', 3) + 1.2, 'sparkle', 0.7)
  q('cost', 0.2, 'countdown', 0.6)
  const cd = N.cost.caps[1].d
  ;[0, 0.3, 0.55, 0.78].forEach((f) => q('cost', cap('cost', 1) + cd * f, 'pop', 0.55))
  q('close', 0.3, 'thud', 0.9); q('close', 0.6, 'powerup', 0.8); q('close', cap('close', 2) + 0.6, 'sparkle', 0.8)
  return out.sort((a, b) => a.t - b.t)
})()

/* RankTrash · video pitch v2 — engine: helpers, phone, mascot, timeline, background, wipe.
   window.seek(t) (in scenes.js) renders the frame at time t and resolves when every image is decoded. */
'use strict'
const W = 1920, H = 1080, FPS = 30
const FR = 'frames/'
const BPM = 124, BEAT = 60 / BPM
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
  back: (t) => { const c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2) },
}
const ease = (t, a, b, fn = E.out) => fn(P(t, a, b))
const env = (t, a, b, ri = 0.3, ro = 0.3) => Math.min(ease(t, a, a + ri), 1 - ease(t, b - ro, b, E.in))
const pop = (t, a, d = 0.45) => ({ s: ease(t, a, a + d, E.back), o: P(t, a, a + 0.08) })
const bump = (t, a, d = 0.35) => (t < a || t > a + d ? 0 : Math.sin(P(t, a, a + d) * Math.PI))
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296) }
const shake = (t, a, d = 0.4, amp = 14) => { if (t < a || t > a + d) return { x: 0, y: 0 }; const k = (1 - P(t, a, a + d)) * amp; return { x: Math.sin(t * 97) * k, y: Math.cos(t * 83) * k } }

// ---------- DOM helpers ----------
function el(tag, cls, parent, html, style) {
  const e = document.createElement(tag)
  if (cls) e.className = cls
  if (html != null) e.innerHTML = html
  if (style) Object.assign(e.style, style)
  if (parent) parent.appendChild(e)
  return e
}
function tf(e, { x = 0, y = 0, s = 1, sx, sy, r = 0, o, rx = 0, ry = 0, blur } = {}) {
  const scale = sx != null || sy != null ? `scale(${sx ?? s},${sy ?? s})` : `scale(${s})`
  const persp = rx || ry ? 'perspective(1800px) ' : ''
  e.style.transform = `${persp}translate(${x}px,${y}px) ${scale} rotate(${r}deg)${rx ? ` rotateX(${rx}deg)` : ''}${ry ? ` rotateY(${ry}deg)` : ''}`
  if (o != null) { e.style.opacity = o; e.style.visibility = o <= 0.001 ? 'hidden' : 'visible' }
  if (blur != null) e.style.filter = blur > 0.05 ? `blur(${blur}px)` : 'none'
}
function pixelSvg(rows, palette, size) {
  const w = Math.max(...rows.map((r) => r.length)), h = rows.length
  const paths = {}
  rows.forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== '.' && ch !== ' ') paths[ch] = (paths[ch] || '') + `M${x} ${y}h1v1h-1z` }))
  return `<svg viewBox="0 0 ${w} ${h}" width="${size}" height="${(size * h) / w}" shape-rendering="crispEdges" style="display:block">${Object.entries(paths)
    .map(([c, d]) => `<path d="${d}" fill="${palette[c] || 'currentColor'}"/>`).join('')}</svg>`
}
const icon = (name, size = 28, color = 'currentColor') => pixelSvg(ICONS[name], { K: color }, size)
const MASCOT_ROWS = (mood) => {
  const HEAD = ['......KKKK......', '.....KGGGGK.....', '..KKKKKKKKKKKK..', '.KGGGGGGGGGGGGK.', '.KggggggggggggK.', '..KKKKKKKKKKKK..', '..KBBBBBBBBBBK..']
  const EYES = {
    idle: ['..KBWWWBBWWWBK..', '..KWWWWBBWWWWK..', '..KWWWWBBWWWWK..', '..KBWWBBBBWWBK..'],
    look: ['..KBWWWBBWWWBK..', '..KWWKWBBWWKWK..', '..KWWKWBBWWKWK..', '..KBWWBBBBWWBK..'],
    happy: ['..KBBBBBBBBBBK..', '..KBWWBBBBWWBK..', '..KWBBWBBWBBWK..', '..KBBBBBBBBBBK..'],
    blink: ['..KBBBBBBBBBBK..', '..KBBBBBBBBBBK..', '..KWWWWBBWWWWK..', '..KBBBBBBBBBBK..'],
    sad: ['..KBBBBBBBBBBK..', '..KBBBBBBBBBBK..', '..KWWWWBBWWWWK..', '..KBWWBBBBWWBK..'],
    angry: ['..KWBBBBBBBBWK..', '..KBWWBBBBWWBK..', '..KWWKWBBWKWWK..', '..KBWWBBBBWWBK..'],
  }
  const BODY = ['..KBBBBBBBBBBK..', '..KBBbBBBBbBBK..', '..KBBbBBBBbBBK..', '...KBbBBBBbBK...', '...KKKKKKKKKK...']
  return [...HEAD, ...EYES[mood], ...BODY]
}
const MASCOT_PAL = { K: '#0a0f1f', G: '#6fd07c', g: '#2f7a3c', B: '#3d8fd1', b: '#1d5a92', W: '#ffffff' }
const mascotSvg = (mood, size) => pixelSvg(MASCOT_ROWS(mood), MASCOT_PAL, size)
const EYES_LOGO = (size) => pixelSvg(['.KKKKKKKKKKKK.', 'KRRRRRRRRRRRRK', 'KRWWWRRRRWWWRK', 'KWWWWRRRRWWWWK', 'KWWWWRRRRWWWWK', 'KRWWRRRRRRWWRK', '.KKKKKKKKKKKK.'], { K: '#0a0f1f', R: '#6fd07c', W: '#fff' }, size)
const CAN = (w) => `<svg width="${w}" height="${(w * 22) / 14}" viewBox="0 0 14 22" shape-rendering="crispEdges" style="display:block"><rect x="1" y="0" width="12" height="2" fill="#cfd6df"/><rect x="0" y="2" width="14" height="18" fill="#d81e2a"/><rect x="2" y="2" width="3" height="18" fill="#ff6b6b"/><rect x="0" y="8" width="14" height="3" fill="#fff"/><rect x="1" y="20" width="12" height="2" fill="#cfd6df"/></svg>`
const BIN = (c, w = 150) => `<svg width="${w}" height="${(w * 42) / 34}" viewBox="0 0 34 42" shape-rendering="crispEdges" style="display:block">
  <rect x="1" y="4" width="32" height="5" fill="#0a0f1f"/><rect x="2" y="5" width="30" height="3" fill="${c}"/><rect x="13" y="1" width="8" height="4" fill="#0a0f1f"/><rect x="14" y="2" width="6" height="2" fill="${c}"/>
  <rect x="3" y="9" width="28" height="32" fill="#0a0f1f"/><rect x="4" y="9" width="26" height="31" fill="${c}"/><rect x="4" y="9" width="4" height="31" fill="rgba(255,255,255,.18)"/><rect x="26" y="9" width="4" height="31" fill="rgba(0,0,0,.18)"/>
  <rect x="12" y="20" width="10" height="10" fill="rgba(0,0,0,.25)"/></svg>`
const QR_SVG = (size) => `<svg width="${size}" height="${size}" viewBox="0 0 ${QR.n} ${QR.n}" shape-rendering="crispEdges" style="display:block"><rect width="${QR.n}" height="${QR.n}" fill="#fff"/><path d="${QR.d}" fill="#0a0f1f"/></svg>`
const MSLOGO = (s) => `<div style="display:grid;grid-template-columns:${s}px ${s}px;gap:${Math.max(2, s / 7)}px"><i style="height:${s}px;background:#f25022"></i><i style="height:${s}px;background:#7fba00"></i><i style="height:${s}px;background:#00a4ef"></i><i style="height:${s}px;background:#ffb900"></i></div>`

// Mascot widget with mood + optional speech bubble
function Mascot(parent, size, x, y, bubbleSide = 'right') {
  const box = el('div', 'abs mascot', parent, '', { left: x + 'px', top: y + 'px', width: size + 'px' })
  const body = el('div', '', box)
  const bub = el('div', 'bubble ' + bubbleSide, box, '')
  let mood = null
  return {
    box, bub,
    set(m, t) { const mm = m === 'idle' && t % 2.6 > 2.45 ? 'blink' : m; if (mm !== mood) { body.innerHTML = mascotSvg(mm, size); mood = mm } },
    say(text, o) { if (bub.dataset.t !== text) { bub.innerHTML = text; bub.dataset.t = text } tf(bub, { o, s: 0.5 + 0.5 * ease(o, 0, 1, E.back) }) },
  }
}

// words that rise in, one by one (keeps inline markup)
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
function wordsIn(box, lt, t0, stagger = 0.05, dur = 0.45, outAt = null) {
  box.words.forEach((w, i) => {
    const p = ease(lt, t0 + i * stagger, t0 + i * stagger + dur, E.out5)
    let o = P(lt, t0 + i * stagger, t0 + i * stagger + dur * 0.4), y = (1 - p) * 80, r = (1 - p) * 8
    if (outAt != null) { const q = ease(lt, outAt + i * 0.015, outAt + i * 0.015 + 0.25, E.in); o *= 1 - q; y -= q * 50 }
    tf(w, { y, o, r })
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
const SEQ = { camera: 90, login: 90, map: 180, 'perfil-scroll': 120, preview: 30, 'ranking-scroll': 90, ranking: 90, 'regras-scroll': 90, 'result-scroll': 90, result: 120, scan: 49 }
const seq = (name, lt, speed = 1) => `${FR}${name}/${String(clamp(Math.floor(lt * FPS * speed), 0, SEQ[name] - 1)).padStart(4, '0')}.jpg`
const still = (name) => `${FR}stills/${name}.png`

// ---------- phone ----------
const APP = 0.9893 // app px (390 wide) -> screen px
function Phone(parent) {
  const e = el('div', 'phone', parent)
  const scr = el('div', 'scr', e)
  const a = el('img', 'a', scr), b = el('img', 'b', scr)
  el('div', 'status', scr, `<span>9:41</span><span class="r"><span class="bars"><i style="height:4px"></i><i style="height:6px"></i><i style="height:9px"></i><i style="height:12px"></i></span><span class="batt"><i></i></span></span>`)
  const ov = el('div', 'overlay', scr)
  el('div', 'island', e); el('div', 'glare', e)
  const tap = el('div', 'tap', scr)
  const flash = el('div', 'overlay', scr, '', { background: '#fff', opacity: 0, zIndex: 6 })
  const ph = { e, a, b, ov, tap, flash, x: 0, y: 0, s: 1 }
  ph.place = (x, y, s = 1, extra = {}) => { Object.assign(ph, { x, y, s }); tf(e, { x, y, s, ...extra }) }
  // put app point (ax, ay) at stage point (tx, ty) with scale s
  ph.focus = (ax, ay, s, tx, ty, extra) => {
    const lx = 15 + 7 + ax * APP, ly = 15 + 40 + ay * APP
    ph.place(tx - 215 - (lx - 215) * s, ty - 452.5 - (ly - 452.5) * s, s, extra)
  }
  ph.show = (url, urlB = null, mix = 0) => {
    setImg(a, url)
    if (urlB && mix > 0) { setImg(b, urlB); b.style.opacity = mix } else b.style.opacity = 0
  }
  ph.pt = (ax, ay) => {
    const lx = 15 + 7 + ax * APP, ly = 15 + 40 + ay * APP
    return { x: ph.x + 215 + (lx - 215) * ph.s, y: ph.y + 452.5 + (ly - 452.5) * ph.s }
  }
  ph.tapAt = (lt, t0, ax, ay) => {
    const p = P(lt, t0, t0 + 0.5)
    tap.style.left = 7 + ax * APP + 'px'; tap.style.top = 40 + ay * APP + 'px'
    tf(tap, { s: 0.4 + p * 0.9, o: p > 0 && p < 1 ? (1 - p) * 0.95 : 0 })
  }
  ph.flashAt = (lt, t0) => { flash.style.opacity = lt >= t0 ? 0.9 * (1 - P(lt, t0, t0 + 0.35)) : 0 }
  return ph
}
// interpolate between two focus states [ax, ay, s, tx, ty]
function focusMix(ph, A, B, k, extra) { const m = (i) => lerp(A[i], B[i], k); ph.focus(m(0), m(1), m(2), m(3), m(4), extra) }

// ---------- timeline ----------
const NARR_OFFSET = 0.3
const N = Object.fromEntries(NARR.map((n) => [n.key, n]))
const cap = (key, i) => NARR_OFFSET + N[key].caps[Math.min(i, N[key].caps.length - 1)].t
// local time when a phrase is (approximately) spoken: caption start + proportional char offset
function WT(key, phrase) {
  for (const c of N[key].caps) {
    const i = c.text.toLowerCase().indexOf(phrase.toLowerCase())
    if (i >= 0) return NARR_OFFSET + c.t + (c.d * i) / c.text.length
  }
  throw new Error(`phrase not found: ${key} / ${phrase}`)
}
const SCENES = []
function scene(key, chapter, build, { pad = 0.5, dur } = {}) { SCENES.push({ key, chapter, build, dur: dur ?? N[key].dur + NARR_OFFSET + pad }) }

// background: blueprint grid + drifting pixels + beat pulse
const bg = $('#bg').getContext('2d')
const R0 = rng(7); const DUST = Array.from({ length: 80 }, () => ({ x: R0() * W, y: R0() * H, s: 2 + Math.floor(R0() * 4), v: 10 + R0() * 30, a: 0.08 + R0() * 0.25 }))
let PULSE = 0
function drawBg(t) {
  bg.fillStyle = '#07142a'; bg.fillRect(0, 0, W, H)
  const g = bg.createRadialGradient(W / 2, H / 2, 200, W / 2, H / 2, 1200)
  g.addColorStop(0, `rgba(31,58,158,${0.26 + PULSE * 0.14})`); g.addColorStop(1, 'rgba(0,0,0,0.38)')
  bg.fillStyle = g; bg.fillRect(0, 0, W, H)
  const off = (t * 18) % 60
  bg.strokeStyle = `rgba(61,143,209,${0.07 + PULSE * 0.07})`; bg.lineWidth = 1
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
const WCOL = ['#3d8fd1', '#1f3a9e', '#0b1e3a', '#5fb96a']
const WD = 0.3
function drawWipe(t, T) {
  wipe.clearRect(0, 0, W, H)
  if (T == null || t < T - WD || t > T + WD) return
  const into = t < T, p = into ? P(t, T - WD, T) : P(t, T, T + WD)
  for (let i = 0; i < WTH.length; i++) {
    const on = into ? WTH[i] < p * 1.05 : WTH[i] > p * 1.05 - 0.05
    if (!on) continue
    wipe.fillStyle = WCOL[(i * 7 + (i >> 3)) % 9 === 3 ? 3 : (i * 3) % 3]
    wipe.fillRect((i % BC) * BS, Math.floor(i / BC) * BS, BS, BS)
  }
}

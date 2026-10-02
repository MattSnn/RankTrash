import { open } from './common.mjs'
import fs from 'fs'
const OUT = process.cwd() + '/frames'; fs.mkdirSync(OUT, { recursive: true })
const { b, ctx, p } = await open({ scale: 3 })
// slow mode: scale long timeouts so the async flow stretches along with slowed animations
await ctx.addInitScript(() => {
  const st = window.setTimeout.bind(window); window.__slow = 1
  window.setTimeout = (fn, ms, ...a) => st(fn, (ms || 0) >= 200 ? ms * window.__slow : ms, ...a)
  document.addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = '.gallery-btn{display:none!important} .leaflet-control-attribution{opacity:.5}'; document.head.appendChild(s) })
})
const cdp = await ctx.newCDPSession(p); await cdp.send('Animation.enable')
const RATE = 0.1
const slow = async (on) => { await cdp.send('Animation.setPlaybackRate', { playbackRate: on ? RATE : 1 }); await p.evaluate(v => (window.__slow = v), on ? 1 / RATE : 1) }
const shot = (dir, i) => p.screenshot({ path: `${OUT}/${dir}/${String(i).padStart(4, '0')}.jpg`, type: 'jpeg', quality: 92 })
// capture `sec` seconds of (slowed) real time at 30 fps-equivalent
async function burst(dir, sec, { until } = {}) {
  fs.mkdirSync(`${OUT}/${dir}`, { recursive: true }); await slow(true)
  const step = 1000 / 30 / RATE, t0 = Date.now(); let i = 0
  while (i < sec * 30) {
    const target = t0 + i * step; const w = target - Date.now(); if (w > 0) await p.waitForTimeout(w)
    await shot(dir, i++); if (until && (await until())) break
  }
  await slow(false); console.log(dir, i, 'frames'); return i
}
async function still(name) { fs.mkdirSync(`${OUT}/stills`, { recursive: true }); await p.screenshot({ path: `${OUT}/stills/${name}.png` }); console.log('still', name) }
async function scrollSeq(dir, sel, frames) {
  fs.mkdirSync(`${OUT}/${dir}`, { recursive: true })
  const max = await p.$eval(sel, el => el.scrollHeight - el.clientHeight)
  for (let i = 0; i < frames; i++) {
    const t = i / (frames - 1), e = t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
    await p.$eval(sel, (el, y) => (el.scrollTop = y), Math.round(e * max)); await p.waitForTimeout(30); await shot(dir, i)
  }
  await p.$eval(sel, el => (el.scrollTop = 0)); console.log(dir, 'scroll', max)
}
const nav = async (path) => { await p.evaluate(pth => { history.pushState({}, '', pth); dispatchEvent(new PopStateEvent('popstate')) }, path); await p.waitForTimeout(1200) }

await p.goto('http://localhost:5173/perfil'); await p.waitForTimeout(2000)
await p.getByRole('button', { name: 'SAIR' }).click(); await p.waitForTimeout(1500)
await still('login'); await burst('login', 3)
await p.getByRole('button', { name: /ENTRAR COM CONTA FACENS/ }).click(); await p.waitForTimeout(500)
await nav('/'); await p.waitForTimeout(2500)
await still('map'); await burst('map', 6)
// tap a bin pin
const pins = p.locator('.leaflet-marker-icon'); console.log('pins', await pins.count())
await pins.nth(2).click(); await p.waitForTimeout(900); await still('map-popup')
await p.keyboard.press('Escape')
// register flow
await nav('/registrar'); await p.waitForTimeout(3000)
await still('camera'); await burst('camera', 3)
await p.locator('.shutter').click(); await p.waitForTimeout(800); await still('preview')
await burst('preview', 1)
fs.mkdirSync(`${OUT}/scan`, { recursive: true })
await slow(true); await p.getByRole('button', { name: /ENVIAR/ }).click(); await slow(false)
await burst('scan', 12, { until: async () => (await p.locator('text=PONTOS').count()) > 0 })
await burst('result', 4)
await still('result'); await scrollSeq('result-scroll', '.screen-scroll', 90)
// second disposal (plastic) for variety
await p.getByRole('button', { name: /DESCARTAR DE NOVO|NOVO|OUTRO/ }).first().click().catch(() => {}); await p.waitForTimeout(2500)
await p.locator('.shutter').click().catch(() => {}); await p.waitForTimeout(800)
await p.getByRole('button', { name: /ENVIAR/ }).click().catch(() => {}); await p.waitForTimeout(4000); await still('result2')
// ranking
await nav('/ranking'); await p.waitForTimeout(800); await still('ranking'); await burst('ranking', 3)
await scrollSeq('ranking-scroll', '.screen-scroll', 90)
await p.getByRole('tab', { name: /CURSOS/ }).click(); await p.waitForTimeout(900); await still('ranking-cursos')
await p.getByRole('tab', { name: /7 DIAS/ }).click(); await p.waitForTimeout(900); await still('ranking-semana')
// perfil
await nav('/perfil'); await still('perfil'); await scrollSeq('perfil-scroll', '.screen-scroll', 120)
// admin
await nav('/admin'); await still('admin')
for (const t of ['REVIS', 'TEMPORADA', 'USU']) { await p.getByRole('button', { name: new RegExp(t) }).first().click().catch(e => console.log('no tab', t)); await p.waitForTimeout(900); await still('admin-' + t.toLowerCase()) }
// regras
await nav('/sobre'); await still('regras'); await scrollSeq('regras-scroll', '.screen-scroll', 90)
await b.close()

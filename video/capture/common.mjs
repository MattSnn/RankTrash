import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { createRequire } from 'module'; const require = createRequire(import.meta.url)
const T = require('./tiles.cjs')
export async function open({ scale = 3, lat = -23.4697 + 0.0004, lng = -47.4297 - 0.0006 } = {}) {
  const b = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--use-file-for-fake-video-capture=' + process.cwd() + '/cam.y4m'] })
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: scale, geolocation: { latitude: lat, longitude: lng, accuracy: 6 }, permissions: ['geolocation', 'camera'], isMobile: true, hasTouch: true, locale: 'pt-BR' })
  await ctx.route('https://tiles.openfreemap.org/**', async (r) => {
    const u = r.request().url()
    if (u.endsWith('/planet')) return r.fulfill({ json: T.tilejson })
    const m = u.match(/fake\/(\d+)\/(\d+)\/(\d+)\.pbf/)
    if (m) return r.fulfill({ body: T.tile(+m[1], +m[2], +m[3]), contentType: 'application/x-protobuf' })
    return r.fulfill({ status: 404, body: '' })
  })
  await ctx.addInitScript(() => { const s = document.createElement('style'); s.textContent = '.demo-flag{display:none!important}'; document.addEventListener('DOMContentLoaded', () => document.head.appendChild(s)) })
  const p = await ctx.newPage()
  return { b, ctx, p }
}

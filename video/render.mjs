// Usage: node render.mjs preview t1 t2 ...   |   node render.mjs frames <from> <to> <outdir>   |   node render.mjs timeline
import { chromium } from 'playwright'
import fs from 'fs'
import path from 'path'
const [mode, ...args] = process.argv.slice(2)
const b = await chromium.launch({ args: ['--allow-file-access-from-files', '--disable-web-security'] })
const p = await b.newPage({ viewport: { width: 1920, height: 1080 } })
p.on('pageerror', (e) => console.error('PAGEERR', e.message))
p.on('console', (m) => m.type() === 'error' && console.error('CONSOLE', m.text()))
await p.goto('file://' + path.resolve('index.html'))
await p.evaluate(() => window.ready)
if (mode === 'timeline') {
  console.log(JSON.stringify(await p.evaluate(() => window.TIMELINE), null, 1))
} else if (mode === 'preview') {
  fs.mkdirSync('out/preview', { recursive: true })
  for (const t of args) { await p.evaluate((t) => window.seek(t), +t); await p.screenshot({ path: `out/preview/t${(+t).toFixed(2)}.jpg`, type: 'jpeg', quality: 85 }) }
} else if (mode === 'frames') {
  const [from, to, out] = [+args[0], +args[1], args[2]]; fs.mkdirSync(out, { recursive: true })
  for (let f = from; f < to; f++) {
    await p.evaluate((t) => window.seek(t), f / 30)
    await p.screenshot({ path: `${out}/${String(f).padStart(5, '0')}.jpg`, type: 'jpeg', quality: 93 })
    if (f % 300 === 0) console.log('frame', f)
  }
}
await b.close()

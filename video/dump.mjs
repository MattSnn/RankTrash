import { chromium } from 'playwright'
import fs from 'fs'
import path from 'path'
const b = await chromium.launch({ args: ['--allow-file-access-from-files'] }); const p = await b.newPage()
p.on('pageerror', (e) => console.error('PAGEERR', e.message))
await p.goto('file://' + path.resolve('index.html')); await p.evaluate(() => window.ready)
fs.mkdirSync('out', { recursive: true })
fs.writeFileSync('out/timeline.json', JSON.stringify(await p.evaluate(() => ({ ...window.TIMELINE, cues: window.CUES })), null, 1))
await b.close()

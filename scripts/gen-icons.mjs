// Gera os ícones do PWA (SVG + PNGs) a partir do sprite do mascote.
// Uso: node scripts/gen-icons.mjs   (requer playwright instalado: npm i -g playwright)
import { writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { execSync } from 'node:child_process'

const rows = [
  '......KKKK......', '.....KGGGGK.....', '..KKKKKKKKKKKK..', '.KGGGGGGGGGGGGK.', '.KggggggggggggK.',
  '..KKKKKKKKKKKK..', '..KBBBBBBBBBBK..', '..KBWWWBBWWWBK..', '..KWWWWBBWWWWK..', '..KWWWWBBWWWWK..',
  '..KBWWBBBBWWBK..', '..KBBBBBBBBBBK..', '..KBBbBBBBbBBK..', '..KBBbBBBBbBBK..', '...KBbBBBBbBK...', '...KKKKKKKKKK...',
]
const palette = { K: '#0a0f1f', G: '#6fd07c', g: '#2f7a3c', B: '#3d8fd1', b: '#1d5a92', W: '#ffffff' }
const paths = {}
rows.forEach((r, y) => [...r].forEach((c, x) => { if (c !== '.') paths[c] = (paths[c] ?? '') + `M${x + 4} ${y + 4}h1v1h-1z` }))
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" shape-rendering="crispEdges">
<rect width="24" height="24" fill="#0b1e3a"/>
${Object.entries(paths).map(([c, d]) => `<path d="${d}" fill="${palette[c]}"/>`).join('\n')}
</svg>`
writeFileSync('public/icons/icon.svg', svg)

const require = createRequire(execSync('npm root -g').toString().trim() + '/')
const { chromium } = require('playwright')
const browser = await chromium.launch()
const page = await browser.newPage()
for (const [file, size] of [['icon-192.png', 192], ['icon-512.png', 512], ['apple-touch-icon.png', 180]]) {
  await page.setViewportSize({ width: size, height: size })
  await page.setContent(`<body style="margin:0">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body>`)
  await page.screenshot({ path: `public/icons/${file}` })
}
await browser.close()
console.log('ícones gerados em public/icons')

import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
const b = await chromium.launch(); const p = await b.newPage({viewport:{width:720,height:1280}})
await p.goto('file://'+process.cwd()+'/camscene.html'); await p.screenshot({path:'camscene.png'}); await b.close()

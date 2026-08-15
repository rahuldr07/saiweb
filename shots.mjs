import { chromium } from 'playwright'
const OUT='/tmp/claude-0/-home-user-saiweb/0a47a1ed-90bf-5f76-9299-9f57ab092bcc/scratchpad/shots'
const opts={args:['--no-sandbox','--disable-gpu','--single-process'],executablePath:process.env.CHROMIUM_PATH}
const shots=[
  ['dash','/dash',1440,900,false],
  ['dash-dark','/dash',1440,900,true],
  ['orders','/orders',1440,900,false],
  ['person','/staff/pd',1440,900,false],
  ['lead','/leads/l1',1440,900,false],
  ['company-dark','/company',1440,900,true],
  ['dash-mobile','/dash',390,844,false],
  ['orders-mobile','/orders',390,844,false],
]
for(const [name,path,w,h,dark] of shots){
  const b=await chromium.launch(opts)
  const p=await b.newPage({viewport:{width:w,height:h},deviceScaleFactor:1})
  await p.goto('http://127.0.0.1:4173'+path,{waitUntil:'domcontentloaded'})
  await p.waitForSelector('main'); await p.waitForTimeout(900)
  if(dark) { await p.evaluate(()=>document.body.classList.add('dark')); await p.waitForTimeout(300) }
  await p.screenshot({path:`${OUT}/${name}.png`,fullPage:false})
  console.log('shot',name)
  await b.close()
}

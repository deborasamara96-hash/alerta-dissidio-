import { chromium } from 'playwright'
import fs from 'node:fs/promises'

const URL = 'https://mediador.trabalho.gov.br/sistemas/mediador/ConsultarInstColetivo'
const OUT = 'data/results.json'

const pairs = [
['01','93.246.940/0001-46','89.069.835/0001-01'],['02','18.006.733/0001-07','15.635.336/0001-06'],['03','91.100.339/0001-15','96.757.612/0001-00'],['04','89.138.168/0001-71','91.345.231/0001-92'],['05','88.368.592/0001-40','97.202.535/0001-87'],['06','88.368.592/0001-40','96.757.737/0001-22'],['07','89.138.168/0001-71','91.343.194/0001-83'],['08','92.962.919/0001-84','92.931.492/0001-57'],['09','89.137.574/0001-10','93.074.185/0001-60'],['10','96.755.145/0001-71','96.758.008/0001-90'],['11','93.712.909/0001-53','93.074.383/0001-23'],['12','93.712.909/0001-53','96.758.040/0001-76']]
const clean = s => (s || '').replace(/\D/g,'')
const sleep = ms => new Promise(r => setTimeout(r, ms))

async function discover(page) {
  const inputs = await page.locator('input,select,button').evaluateAll(els => els.map(e => ({tag:e.tagName,id:e.id,name:e.getAttribute('name'),type:e.getAttribute('type'),placeholder:e.getAttribute('placeholder'),aria:e.getAttribute('aria-label'),value:e.getAttribute('value'),text:(e.textContent||'').trim()})))
  return inputs
}

async function searchCnpj(page, cnpj) {
  await page.goto(URL, {waitUntil:'domcontentloaded', timeout:30000})
  await page.waitForLoadState('networkidle', {timeout:15000}).catch(()=>{})
  const body = (await page.locator('body').innerText()).slice(0,12000)
  if (/403|forbidden|access denied|captcha|cloudflare/i.test(body)) throw new Error('A fonte oficial bloqueou a consulta automática.')

  const cnpj = clean(cnpj)
  const input = page.locator('input').filter({has: undefined})
  const candidates = page.locator('input').evaluateAll((els) => els.map((e,i)=>({i,id:e.id,name:e.getAttribute('name')||'',placeholder:e.getAttribute('placeholder')||'',aria:e.getAttribute('aria-label')||'',title:e.getAttribute('title')||'',type:e.getAttribute('type')||'',value:e.getAttribute('value')||''})))
  const all = await candidates
  const idx = all.findIndex(x => /cnpj/i.test(`${x.id} ${x.name} ${x.placeholder} ${x.aria} ${x.title}`) && !/processo|registro|solicita/i.test(`${x.id} ${x.name}`))
  if (idx < 0) throw new Error('Campo de CNPJ não localizado na página oficial.')
  await page.locator('input').nth(idx).fill(cnpj)

  const cnpjLabel = page.getByText(/CNPJ/i).first()
  await cnpjLabel.click().catch(()=>{})
  const buttons = page.locator('button,input[type="submit"],input[type="button"]')
  const n = await buttons.count()
  let clicked = false
  for (let i=0;i<n;i++) {
    const b=buttons.nth(i); const txt=((await b.innerText().catch(()=>''))+' '+(await b.getAttribute('value').catch(()=>''))).trim()
    if (/consultar|pesquisar|buscar|filtrar/i.test(txt)) { await b.click(); clicked=true; break }
  }
  if (!clicked) throw new Error('Botão de consulta não localizado na página oficial.')
  await page.waitForLoadState('networkidle',{timeout:15000}).catch(()=>{})
  await sleep(1000)

  const text = await page.locator('body').innerText()
  if (/nenhum (instrumento|registro)|não foram encontrados|nenhum resultado/i.test(text)) return []

  const links = await page.locator('a').evaluateAll(as => as.map(a => ({text:(a.textContent||'').trim(),href:a.href})).filter(x=>/ResumoVisualizar|instrumento|extrato/i.test(`${x.text} ${x.href}`)))
  const rows = await page.locator('tr').evaluateAll(trs => trs.map(tr => (tr.innerText||'').trim()).filter(Boolean))
  if (!links.length && !rows.length) throw new Error('A página respondeu, mas o formato dos resultados não pôde ser validado.')

  const resultMap = new Map()
  for (const l of links) resultMap.set(l.href,{key:l.href,type:'',summary:l.text})
  for (const row of rows) {
    const m = row.match(/([A-Z]{2}\d{6,}\/\d{4})/i)
    if (m) {
      const key=m[1].toUpperCase()
      if (!resultMap.has(key)) resultMap.set(key,{key,type:'',summary:row.slice(0,500)})
      else resultMap.get(key).summary=row.slice(0,500)
    }
  }
  return [...resultMap.values()]
}

function intersect(a,b){
  const B=new Map(b.map(x=>[x.key,x]))
  return a.filter(x=>B.has(x.key)).map(x=>({...x,...B.get(x)}))
}

async function main(){
  let store={generatedAt:null,source:'Mediador/MTE',overallStatus:'NOT_RUN',pairs:[],history:[]}
  try { store=JSON.parse(await fs.readFile(OUT,'utf8')) } catch {}
  const browser=await chromium.launch({headless:true})
  const results=[]
  try {
    for(const [id,patronal,laboral] of pairs){
      const page=await browser.newPage()
      try {
        const a=await searchCnpj(page,patronal)
        const b=await searchCnpj(page,laboral)
        const common=intersect(a,b)
        results.push({id,patronal,laboral,status:'CONSULTADO',instrumentos:common,consultedAt:new Date().toISOString()})
      } catch(error) {
        results.push({id,patronal,laboral,status:'FONTE INDISPONÍVEL',error:error instanceof Error?error.message:'erro desconhecido',consultedAt:new Date().toISOString()})
      } finally { await page.close() }
    }
  } finally { await browser.close() }

  const run={at:new Date().toISOString(),pairs:results}
  store.generatedAt=run.at
  store.source='Mediador/MTE'
  store.overallStatus=results.some(x=>x.status==='FONTE INDISPONÍVEL')?'FONTE INDISPONÍVEL':'CONSULTADO'
  store.pairs=results
  store.history=[run,...(store.history||[])].slice(0,90)
  await fs.writeFile(OUT,JSON.stringify(store,null,2)+'\n')
}
main().catch(async e=>{console.error(e);process.exit(1)})

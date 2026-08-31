import { chromium } from 'playwright'
import fs from 'node:fs/promises'

const MEDIADOR = 'https://mediador.trabalho.gov.br/sistemas/mediador'
const OUT = 'data/results.json'
const pairs = [['01','93.246.940/0001-46','89.069.835/0001-01'],['02','18.006.733/0001-07','15.635.336/0001-06'],['03','91.100.339/0001-15','96.757.612/0001-00'],['04','89.138.168/0001-71','91.345.231/0001-92'],['05','88.368.592/0001-40','97.202.535/0001-87'],['06','88.368.592/0001-40','96.757.737/0001-22'],['07','89.138.168/0001-71','91.343.194/0001-83'],['08','92.962.919/0001-84','92.931.492/0001-57'],['09','89.137.574/0001-10','93.074.185/0001-60'],['10','96.755.145/0001-71','96.758.008/0001-90'],['11','93.712.909/0001-53','93.074.383/0001-23'],['12','93.712.909/0001-53','96.758.040/0001-76']]
const clean = s => (s || '').replace(/\D/g,'')
const sleep = ms => new Promise(r => setTimeout(r, ms))
const official = href => /^https?:\/\/mediador\.trabalho\.gov\.br\/sistemas\/mediador\//i.test(href || '')

function extractOfficialLinks(html) {
  const out = new Set()
  const decoded = html.replace(/&amp;/g,'&').replace(/\\u0026/g,'&')
  const patterns = [
    /https?:\/\/mediador\.trabalho\.gov\.br\/sistemas\/mediador\/Resumo\/ResumoVisualizar\?[^\"'<>\s]+/gi,
    /https?:\/\/mediador\.trabalho\.gov\.br\/sistemas\/mediador\/[^\"'<>\s]+/gi,
  ]
  for (const re of patterns) for (const m of decoded.matchAll(re)) {
    const href = m[0].replace(/[),.;]+$/,'')
    if (official(href)) out.add(href)
  }
  for (const m of decoded.matchAll(/href=["']([^"']+)["']/gi)) {
    let href = m[1]
    try { href = decodeURIComponent(href) } catch {}
    const hit = href.match(/https?:\/\/mediador\.trabalho\.gov\.br\/sistemas\/mediador\/[^&\s<>"']+/i)
    if (hit && official(hit[0])) out.add(hit[0])
  }
  return [...out].slice(0, 20)
}

async function searchEngine(page, cnpj, engine) {
  const q = `site:mediador.trabalho.gov.br/sistemas/mediador/Resumo/ResumoVisualizar "${cnpj}"`
  const url = engine === 'bing' ? `https://www.bing.com/search?q=${encodeURIComponent(q)}&count=10` : `https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`
  const response = await page.goto(url, {waitUntil:'domcontentloaded', timeout:30000})
  if (!response || !response.ok()) throw new Error(`${engine} HTTP ${response?.status() || 'sem resposta'}`)
  await sleep(700)
  return extractOfficialLinks(await page.content())
}

async function discoverByCnpj(page, cnpj) {
  let last = null
  for (const engine of ['bing','duck']) {
    try {
      const links = await searchEngine(page, cnpj, engine)
      if (links.length) return {links, engine}
      last = new Error(`${engine}: nenhum resultado oficial indexado`)
    } catch (e) { last = e }
  }
  return {links:[], error:last?.message || 'nenhum resultado'}
}

async function validateOfficialDocument(page, url, cnpjs) {
  if (!official(url)) return null
  const response = await page.goto(url, {waitUntil:'domcontentloaded', timeout:30000})
  if (!response || !response.ok()) return null
  await sleep(300)
  const text = await page.locator('body').innerText()
  const normalized = clean(text)
  if (!cnpjs.every(c => normalized.includes(clean(c)))) return null
  const reg = text.match(/N[ÚU]MERO DE REGISTRO NO MTE:\s*([^\n]+)/i)?.[1]?.trim() || ''
  const req = text.match(/N[ÚU]MERO DA SOLICITA[CÇ][AÃ]O:\s*([^\n]+)/i)?.[1]?.trim() || ''
  const date = text.match(/DATA DE REGISTRO NO MTE:\s*([^\n]+)/i)?.[1]?.trim() || ''
  const title = text.match(/^(Acordo Coletivo[^\n]*|Conven[cç][aã]o Coletiva[^\n]*|Termo Aditivo[^\n]*)/im)?.[1]?.trim() || 'Instrumento coletivo'
  return {url, registro:reg, solicitacao:req, dataRegistro:date, titulo:title, validatedAt:new Date().toISOString()}
}

async function searchPair(context, id, patronal, laboral) {
  const discovery = await context.newPage(); const validation = await context.newPage()
  try {
    const a = await discoverByCnpj(discovery, patronal); const b = await discoverByCnpj(discovery, laboral)
    if (a.error && b.error) return {id, patronal, laboral, status:'FONTE INDISPONÍVEL', error:`Não foi possível obter resultados públicos para os dois CNPJs. ${a.error}; ${b.error}`}
    const candidates = [...new Set(a.links.filter(x => b.links.includes(x)))]
    const instrumentos = []
    for (const url of candidates.slice(0,20)) { const doc = await validateOfficialDocument(validation,url,[patronal,laboral]); if (doc) instrumentos.push(doc) }
    const unique = [...new Map(instrumentos.map(x => [x.registro || x.url, x])).values()]
    return {id, patronal, laboral, status:'CONSULTADO', metodo:'descoberta pública + validação no documento oficial do Mediador', instrumentos:unique, consultedAt:new Date().toISOString(), candidatosVerificados:candidates.length}
  } finally { await discovery.close(); await validation.close() }
}

async function main(){
  let store={generatedAt:null,source:'Mediador/MTE',overallStatus:'NOT_RUN',pairs:[],history:[]}
  try{store=JSON.parse(await fs.readFile(OUT,'utf8'))}catch{}
  const browser=await chromium.launch({headless:true}); const context=await browser.newContext({userAgent:'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/126 Safari/537.36',locale:'pt-BR'}); const results=[]
  try { for (const [id,patronal,laboral] of pairs) { try { results.push(await searchPair(context,id,patronal,laboral)) } catch (error) { results.push({id,patronal,laboral,status:'FONTE INDISPONÍVEL',error:error instanceof Error?error.message:'erro desconhecido',consultedAt:new Date().toISOString()}) } } } finally { await context.close(); await browser.close() }
  const run={at:new Date().toISOString(),pairs:results}; store.generatedAt=run.at; store.source='Mediador/MTE'; store.overallStatus=results.every(x=>x.status==='FONTE INDISPONÍVEL')?'FONTE INDISPONÍVEL':'CONSULTADO'; store.pairs=results; store.history=[run,...(store.history||[])].slice(0,90); await fs.writeFile(OUT,JSON.stringify(store,null,2)+'\n')
}
main().catch(e=>{console.error(e);process.exit(1)})

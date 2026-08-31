import { chromium } from 'playwright'
import fs from 'node:fs/promises'

const OUT = 'data/results.json'
const pairs = [['01','93.246.940/0001-46','89.069.835/0001-01'],['02','18.006.733/0001-07','15.635.336/0001-06'],['03','91.100.339/0001-15','96.757.612/0001-00'],['04','89.138.168/0001-71','91.345.231/0001-92'],['05','88.368.592/0001-40','97.202.535/0001-87'],['06','88.368.592/0001-40','96.757.737/0001-22'],['07','89.138.168/0001-71','91.343.194/0001-83'],['08','92.962.919/0001-84','92.931.492/0001-57'],['09','89.137.574/0001-10','93.074.185/0001-60'],['10','96.755.145/0001-71','96.758.008/0001-90'],['11','93.712.909/0001-53','93.074.383/0001-23'],['12','93.712.909/0001-53','96.758.040/0001-76']]
const clean=s=>(s||'').replace(/\D/g,'')
const official=u=>/^https?:\/\/mediador\.trabalho\.gov\.br\/sistemas\/mediador\/Resumo\/ResumoVisualizar\?/i.test(u||'')
const sleep=ms=>new Promise(r=>setTimeout(r,ms))

function linksFromHtml(html){
 const out=new Set(); const h=html.replace(/&amp;/g,'&')
 for(const m of h.matchAll(/https?:\/\/mediador\.trabalho\.gov\.br\/sistemas\/mediador\/Resumo\/ResumoVisualizar\?[^\"'<>\s]+/gi)) out.add(m[0].replace(/[),.;]+$/,''))
 for(const m of h.matchAll(/href=["']([^"']+)["']/gi)){
  let u=m[1]; try{u=decodeURIComponent(u)}catch{}
  const hit=u.match(/https?:\/\/mediador\.trabalho\.gov\.br\/sistemas\/mediador\/Resumo\/ResumoVisualizar\?[^&\s<>"']+/i)
  if(hit) out.add(hit[0])
 }
 return [...out]
}

async function discoverPair(page,patronal,laboral){
 const q=`site:mediador.trabalho.gov.br/sistemas/mediador/Resumo/ResumoVisualizar "${patronal}" "${laboral}"`
 const urls=[`https://www.bing.com/search?q=${encodeURIComponent(q)}&count=20`,`https://www.google.com/search?q=${encodeURIComponent(q)}&num=20`]
 let ok=0, candidates=new Set(), errors=[]
 for(const url of urls){
  try{
   const r=await page.goto(url,{waitUntil:'domcontentloaded',timeout:30000}); if(!r||!r.ok()) throw new Error(`HTTP ${r?.status()||0}`)
   ok++; await sleep(700); for(const u of linksFromHtml(await page.content())) candidates.add(u)
  }catch(e){errors.push(e instanceof Error?e.message:String(e))}
 }
 if(!ok) return {available:false,candidates:[],error:errors.join('; ')}
 return {available:true,candidates:[...candidates],error:null}
}

async function validate(page,url,patronal,laboral){
 if(!official(url)) return null
 const r=await page.goto(url,{waitUntil:'domcontentloaded',timeout:30000}); if(!r||!r.ok()) return null
 await sleep(250); const text=await page.locator('body').innerText(); const n=clean(text)
 if(!n.includes(clean(patronal))||!n.includes(clean(laboral))) return null
 const registro=text.match(/N[ÚU]MERO DE REGISTRO NO MTE:\s*([^\n]+)/i)?.[1]?.trim()||''
 const solicitacao=text.match(/N[ÚU]MERO DA SOLICITA[CÇ][AÃ]O:\s*([^\n]+)/i)?.[1]?.trim()||''
 const dataRegistro=text.match(/DATA DE REGISTRO NO MTE:\s*([^\n]+)/i)?.[1]?.trim()||''
 const titulo=text.match(/^(Acordo Coletivo[^\n]*|Conven[cç][aã]o Coletiva[^\n]*|Termo Aditivo[^\n]*)/im)?.[1]?.trim()||'Instrumento coletivo'
 return {url,registro,solicitacao,dataRegistro,titulo,validatedAt:new Date().toISOString()}
}

async function main(){
 let store={generatedAt:null,source:'Mediador/MTE',overallStatus:'NOT_RUN',pairs:[],history:[]}; try{store=JSON.parse(await fs.readFile(OUT,'utf8'))}catch{}
 const browser=await chromium.launch({headless:true}); const context=await browser.newContext({userAgent:'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/126 Safari/537.36',locale:'pt-BR'}); const results=[]
 try{for(const [id,patronal,laboral] of pairs){const discovery=await context.newPage();const validation=await context.newPage();try{const d=await discoverPair(discovery,patronal,laboral);if(!d.available){results.push({id,patronal,laboral,status:'FONTE INDISPONÍVEL',error:d.error,consultedAt:new Date().toISOString()});continue}const instrumentos=[];for(const u of d.candidates.slice(0,30)){const doc=await validate(validation,u,patronal,laboral);if(doc)instrumentos.push(doc)}const unique=[...new Map(instrumentos.map(x=>[x.registro||x.url,x])).values()];results.push({id,patronal,laboral,status:'CONSULTADO',metodo:'busca por ambos os CNPJs + validação no documento oficial do Mediador',instrumentos:unique,candidatosVerificados:d.candidates.length,consultedAt:new Date().toISOString()})}catch(e){results.push({id,patronal,laboral,status:'FONTE INDISPONÍVEL',error:e instanceof Error?e.message:String(e),consultedAt:new Date().toISOString()})}finally{await discovery.close();await validation.close()}}}finally{await context.close();await browser.close()}
 const run={at:new Date().toISOString(),pairs:results};store.generatedAt=run.at;store.source='Mediador/MTE';store.overallStatus=results.some(x=>x.status==='FONTE INDISPONÍVEL')?'FONTE INDISPONÍVEL':'CONSULTADO';store.pairs=results;store.history=[run,...(store.history||[])].slice(0,90);await fs.writeFile(OUT,JSON.stringify(store,null,2)+'\n')
}
main().catch(e=>{console.error(e);process.exit(1)})

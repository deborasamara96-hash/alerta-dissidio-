import { chromium } from 'playwright'
import fs from 'node:fs/promises'

const OUT = 'data/results.json'
const CONSULTA = 'https://mediador.trabalho.gov.br/sistemas/mediador/ConsultarInstColetivo'
const ENDPOINT = `${CONSULTA}/getConsultaAvancada`
const pairs = [
  ['01','93.246.940/0001-46','89.069.835/0001-01'], ['02','18.006.733/0001-07','15.635.336/0001-06'], ['03','91.100.339/0001-15','96.757.612/0001-00'], ['04','89.138.168/0001-71','91.345.231/0001-92'], ['05','88.368.592/0001-40','97.202.535/0001-87'], ['06','88.368.592/0001-40','96.757.737/0001-22'], ['07','89.138.168/0001-71','91.343.194/0001-83'], ['08','92.962.919/0001-84','92.931.492/0001-57'], ['09','89.137.574/0001-10','93.074.185/0001-60'], ['10','96.755.145/0001-71','96.758.008/0001-90'], ['11','93.712.909/0001-53','93.074.383/0001-23'], ['12','93.712.909/0001-53','96.758.040/0001-76']
]
const clean = s => String(s || '').replace(/\D/g, '')
const sleep = ms => new Promise(r => setTimeout(r, ms))
const solicitudUrl = s => `https://mediador.trabalho.gov.br/sistemas/mediador/Resumo/ResumoVisualizar?NrSolicitacao=${encodeURIComponent(s)}`

function extractSolicitations(html) {
  const text = String(html || '').replace(/&amp;/g, '&').replace(/\\u002F/g, '/')
  const found = new Set()
  const re = /MR\s*\d+\s*(?:%2F|\/)+\s*\d{4}/gi
  for (const m of text.matchAll(re)) {
    const v = decodeURIComponent(m[0]).replace(/\s+/g, '').toUpperCase()
    if (/^MR\d+\/\d{4}$/.test(v)) found.add(v)
  }
  return [...found]
}

async function openOfficialSession(page) {
  const response = await page.goto(CONSULTA, { waitUntil: 'domcontentloaded', timeout: 30000 })
  const status = response?.status() || 0
  if (status < 200 || status >= 400) throw new Error(`Mediador HTTP ${status}`)
  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {})
  const body = await page.locator('body').innerText()
  if (!/Consultar Instrumentos Coletivos Registrados/i.test(body)) throw new Error('A página oficial de consulta não carregou o formulário esperado.')
}

async function searchByCnpj(page, cnpj) {
  await page.goto(CONSULTA, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {})
  const result = await page.evaluate(async ({ endpoint, cnpj }) => {
    const params = new URLSearchParams()
    params.append('nrCnpj', cnpj)
    params.append('nrCei', '')
    params.append('noRazaoSocial', '')
    params.append('dsCategoria', '')
    for (const value of ['acordo','acordoColetivoEspecificoPPE','acordoColetivoEspecificoDomingosFeriados','convencao','termoAditivoAcordo','termoAditivoConvecao','termoAditivoAcordoEspecificoPPE','termoAditivoAcordoEspecificoDomingoFeriado']) params.append('tpRequerimento', value)
    params.append('tpVigencia', '2')
    params.append('sgUfDeRegistro', '')
    params.append('dtInicioRegistro', '')
    params.append('dtFimRegistro', '')
    params.append('dtInicioVigenciaInstrumentoColetivo', '')
    params.append('dtFimVigenciaInstrumentoColetivo', '')
    params.append('tpAbrangencia', 'Todos os tipos')
    params.append('ufsAbrangidasTotalmente', '')
    params.append('cdMunicipiosAbrangidos', '')
    params.append('cdGrupo', '')
    params.append('cdSubGrupo', '')
    params.append('noTituloClausula', '')
    params.append('utilizarSiracc', '')
    params.append('pagina', '1')
    params.append('qtdTotalRegistro', '-1')
    const response = await fetch(endpoint, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', 'X-Requested-With': 'XMLHttpRequest', 'Accept': 'text/html, */*; q=0.01' }, body: params.toString() })
    return { status: response.status, url: response.url, body: await response.text() }
  }, { endpoint: ENDPOINT, cnpj: clean(cnpj) })
  if (result.status === 403) throw new Error('Mediador HTTP 403')
  if (result.status < 200 || result.status >= 400) throw new Error(`Mediador HTTP ${result.status}`)
  const solicitations = extractSolicitations(result.body)
  const lower = result.body.toLowerCase()
  return { requestSucceeded: true, noResults: /nenhum|não foram encontrados|nao foram encontrados|nenhum registro|0\s+registro/.test(lower), total: solicitations.length, solicitations, responseUrl: result.url, responseSize: result.body.length }
}

function extractTextValue(text, regex) { return text.match(regex)?.[1]?.trim() || '' }
async function validate(page, solicitation, patronal, laboral) {
  const response = await page.goto(solicitacaoUrl(solicitation), { waitUntil: 'domcontentloaded', timeout: 30000 })
  if (!response || !response.ok()) return null
  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {})
  const text = await page.locator('body').innerText()
  const normalized = clean(text)
  if (!normalized.includes(clean(patronal)) || !normalized.includes(clean(laboral))) return null
  return { url: solicitudUrl(solicitation), registro: extractTextValue(text, /N[ÚU]MERO DE REGISTRO NO MTE:\s*([^\n]+)/i), solicitacao: extractTextValue(text, /N[ÚU]MERO DA SOLICITA[CÇ][AÃ]O:\s*([^\n]+)/i) || solicitation, dataRegistro: extractTextValue(text, /DATA DE REGISTRO NO MTE:\s*([^\n]+)/i), vigencia: extractTextValue(text, /per[íi]odo de\s*([^\n]+)/i), titulo: text.match(/^(Acordo Coletivo[^\n]*|Conven[cç][aã]o Coletiva[^\n]*|Termo Aditivo[^\n]*)/im)?.[1]?.trim() || 'Instrumento coletivo', validatedAt: new Date().toISOString() }
}
async function discoverPair(page, patronal, laboral) {
  const all = new Set(); let totalFound = 0; let successfulQueries = 0; const errors = []
  for (const cnpj of [patronal, laboral]) { try { const result = await searchByCnpj(page, cnpj); successfulQueries++; totalFound += result.total; for (const s of result.solicitations) all.add(s) } catch (e) { errors.push(e instanceof Error ? e.message : String(e)) } }
  return { solicitations: [...all], totalFound, successfulQueries, error: errors.join('; ') || null }
}
async function main() {
  let store = { generatedAt: null, source: 'Mediador/MTE', overallStatus: 'NOT_RUN', pairs: [], history: [] }
  try { store = JSON.parse(await fs.readFile(OUT, 'utf8')) } catch {}
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ ignoreHTTPSErrors: true, userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36', locale: 'pt-BR', timezoneId: 'America/Sao_Paulo' })
  const results = []
  try {
    for (const [id, patronal, laboral] of pairs) {
      const page = await context.newPage()
      try {
        await openOfficialSession(page)
        const discovery = await discoverPair(page, patronal, laboral)
        if (discovery.successfulQueries === 0) { results.push({ id, patronal, laboral, status: 'FONTE INDISPONÍVEL', error: discovery.error || 'Não foi possível obter resposta da consulta oficial.', instrumentos: [], candidatosVerificados: 0, consultedAt: new Date().toISOString() }); continue }
        const instrumentos = []
        for (const solicitation of discovery.solicitations.slice(0, 100)) { try { const doc = await validate(page, solicitation, patronal, laboral); if (doc) instrumentos.push(doc) } catch {} }
        const unique = [...new Map(instrumentos.map(x => [x.registro || x.solicitacao || x.url, x])).values()]
        results.push({ id, patronal, laboral, status: 'CONSULTADO', metodo: 'POST oficial do Mediador dentro da sessão do navegador + validação dos dois CNPJs no documento oficial', instrumentos: unique, candidatosVerificados: discovery.solicitations.length, totalEncontradoNaConsulta: discovery.totalFound, consultasConfirmadas: discovery.successfulQueries, consultedAt: new Date().toISOString() })
      } catch (e) { results.push({ id, patronal, laboral, status: 'FONTE INDISPONÍVEL', error: e instanceof Error ? e.message : String(e), instrumentos: [], candidatosVerificados: 0, consultedAt: new Date().toISOString() }) }
      finally { await page.close() }
    }
  } finally { await context.close(); await browser.close() }
  const run = { at: new Date().toISOString(), pairs: results }
  store.generatedAt = run.at; store.source = 'Mediador/MTE'; store.overallStatus = results.every(x => x.status === 'CONSULTADO') ? 'CONSULTADO' : results.some(x => x.status === 'CONSULTADO') ? 'PARCIAL' : 'FONTE INDISPONÍVEL'; store.pairs = results; store.history = [run, ...(store.history || [])].slice(0, 90)
  await fs.writeFile(OUT, JSON.stringify(store, null, 2) + '\n')
}
main().catch(e => { console.error(e); process.exit(1) })

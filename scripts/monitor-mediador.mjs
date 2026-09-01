import { chromium } from 'playwright'
import fs from 'node:fs/promises'

const OUT = 'data/results.json'
const pairs = [
  ['01','93.246.940/0001-46','89.069.835/0001-01'],
  ['02','18.006.733/0001-07','15.635.336/0001-06'],
  ['03','91.100.339/0001-15','96.757.612/0001-00'],
  ['04','89.138.168/0001-71','91.345.231/0001-92'],
  ['05','88.368.592/0001-40','97.202.535/0001-87'],
  ['06','88.368.592/0001-40','96.757.737/0001-22'],
  ['07','89.138.168/0001-71','91.343.194/0001-83'],
  ['08','92.962.919/0001-84','92.931.492/0001-57'],
  ['09','89.137.574/0001-10','93.074.185/0001-60'],
  ['10','96.755.145/0001-71','96.758.008/0001-90'],
  ['11','93.712.909/0001-53','93.074.383/0001-23'],
  ['12','93.712.909/0001-53','96.758.040/0001-76']
]

const clean = s => (s || '').replace(/\D/g, '')
const sleep = ms => new Promise(r => setTimeout(r, ms))
const solicitudUrl = s => `https://mediador.trabalho.gov.br/sistemas/mediador/Resumo/ResumoVisualizar?NrSolicitacao=${encodeURIComponent(s)}`
const TYPES = ['acordo','acordoColetivoEspecificoPPE','acordoColetivoEspecificoDomingosFeriados','convencao','termoAditivoAcordo','termoAditivoConvecao','termoAditivoAcordoEspecificoPPE','termoAditivoAcordoEspecificoDomingoFeriado']

function makeForm(cnpj, page = '1', total = '-1') {
  return { nrCnpj: clean(cnpj), nrCei: '', noRazaoSocial: '', dsCategoria: '', tpRequerimento: TYPES, tpVigencia: '2', sgUfDeRegistro: '', dtInicioRegistro: '', dtFimRegistro: '', dtInicioVigenciaInstrumentoColetivo: '', dtFimVigenciaInstrumentoColetivo: '', tpAbrangencia: 'Todos os tipos', ufsAbrangidasTotalmente: '', cdMunicipiosAbrangidos: '', cdGrupo: '', cdSubGrupo: '', noTituloClausula: '', utilizarSiracc: '', pagina: String(page), qtdTotalRegistro: String(total) }
}

function extractSolicitations(html) {
  const text = String(html || '').replace(/&amp;/g, '&')
  const found = new Set()
  for (const re of [/(?:NrSolicitacao|nrSolicitacao|N[úu]mero da solicita[cç][aã]o)[^A-Z0-9]{0,80}(MR\d+\/\d{4})/gi,/MR\d+\/\d{4}/gi]) {
    for (const m of text.matchAll(re)) {
      const v = (m[1] || m[0] || '').toUpperCase().replace(/%2F/gi, '/')
      if (/^MR\d+\/\d{4}$/.test(v)) found.add(v)
    }
  }
  return [...found]
}

function resultCount(html) {
  const text = String(html || '').replace(/&nbsp;/g, ' ')
  for (const re of [/Resultado\s*:\s*(\d+)/i,/Resultados?\s*:\s*(\d+)/i,/qtdTotalRegistro[^>]*value=["'](\d+)["']/i]) {
    const m = text.match(re); if (m) return Number(m[1])
  }
  return null
}

async function openOfficialSession(page) {
  for (const url of ['https://mediador.trabalho.gov.br/sistemas/mediador/ConsultarInstColetivo','https://www3.mte.gov.br/sistemas/mediador/ConsultarInstColetivo']) {
    try {
      const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
      const status = response?.status() || 0
      if (status >= 200 && status < 400) return { url, status }
    } catch {}
  }
  throw new Error('Não foi possível abrir a consulta oficial do Mediador.')
}

async function postSearch(page, cnpj, pageNo, total) {
  const endpoints = [
    'https://mediador.trabalho.gov.br/sistemas/mediador/ConsultarInstColetivo/getConsultaAvancada',
    'https://www3.mte.gov.br/sistemas/mediador/ConsultarInstColetivo/getConsultaAvancada'
  ]
  let lastError = null
  for (const endpoint of endpoints) {
    try {
      const response = await page.request.post(endpoint, {
        form: makeForm(cnpj, pageNo, total), timeout: 30000, failOnStatusCode: false,
        headers: { Referer: 'https://mediador.trabalho.gov.br/sistemas/mediador/ConsultarInstColetivo', Origin: new URL(endpoint).origin, 'X-Requested-With': 'XMLHttpRequest', Accept: 'text/html, */*; q=0.01' }
      })
      const status = response.status(); const body = await response.text()
      if (status >= 200 && status < 300 && body && !/403 Forbidden/i.test(body)) return { status, body }
      lastError = new Error(`Mediador HTTP ${status}`)
    } catch (e) { lastError = e }
  }
  throw lastError || new Error('Mediador indisponível')
}

async function searchByCnpj(page, cnpj) {
  const first = await postSearch(page, cnpj, 1, -1)
  const total = resultCount(first.body)
  const solicitations = new Set(extractSolicitations(first.body))
  if (total && total > 10) {
    for (let p = 2; p <= Math.min(Math.ceil(total / 10), 20); p++) {
      const result = await postSearch(page, cnpj, p, total)
      for (const s of extractSolicitations(result.body)) solicitations.add(s)
    }
  }
  return { total: total ?? solicitations.size, solicitations: [...solicitations] }
}

function extractTextValue(text, regex) { return text.match(regex)?.[1]?.trim() || '' }

async function validate(page, solicitation, patronal, laboral) {
  const response = await page.goto(solicitudUrl(solicitation), { waitUntil: 'domcontentloaded', timeout: 30000 })
  if (!response || !response.ok()) return null
  await sleep(300)
  const text = await page.locator('body').innerText(); const normalized = clean(text)
  if (!normalized.includes(clean(patronal)) || !normalized.includes(clean(laboral))) return null
  return {
    url: solicitudUrl(solicitation),
    registro: extractTextValue(text, /N[ÚU]MERO DE REGISTRO NO MTE:\s*([^\n]+)/i),
    solicitacao: extractTextValue(text, /N[ÚU]MERO DA SOLICITA[CÇ][AÃ]O:\s*([^\n]+)/i) || solicitation,
    dataRegistro: extractTextValue(text, /DATA DE REGISTRO NO MTE:\s*([^\n]+)/i),
    vigencia: extractTextValue(text, /per[íi]odo de\s*([^\n]+)/i),
    titulo: text.match(/^(Acordo Coletivo[^\n]*|Conven[cç][aã]o Coletiva[^\n]*|Termo Aditivo[^\n]*)/im)?.[1]?.trim() || 'Instrumento coletivo',
    validatedAt: new Date().toISOString()
  }
}

async function discoverPair(page, patronal, laboral) {
  const all = new Set(); let totalFound = 0; const errors = []
  for (const cnpj of [patronal, laboral]) {
    try { const result = await searchByCnpj(page, cnpj); totalFound += result.total || 0; for (const s of result.solicitations) all.add(s) }
    catch (e) { errors.push(e instanceof Error ? e.message : String(e)) }
  }
  return { available: all.size > 0 || totalFound > 0, solicitations: [...all], totalFound, error: errors.join('; ') || null }
}

async function main() {
  let store = { generatedAt: null, source: 'Mediador/MTE', overallStatus: 'NOT_RUN', pairs: [], history: [] }
  try { store = JSON.parse(await fs.readFile(OUT, 'utf8')) } catch {}
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ ignoreHTTPSErrors: true, userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36', locale: 'pt-BR', timezoneId: 'America/Sao_Paulo' })
  const results = []
  try {
    for (const [id, patronal, laboral] of pairs) {
      const page = await context.newPage()
      try {
        await openOfficialSession(page)
        const discovery = await discoverPair(page, patronal, laboral)
        if (!discovery.available) {
          results.push({ id, patronal, laboral, status: 'FONTE INDISPONÍVEL', error: discovery.error || 'O endpoint oficial de consulta não retornou resultados.', instrumentos: [], candidatosVerificados: 0, consultedAt: new Date().toISOString() })
          continue
        }
        const instrumentos = []
        for (const solicitation of discovery.solicitations.slice(0, 100)) {
          try { const doc = await validate(page, solicitation, patronal, laboral); if (doc) instrumentos.push(doc) } catch {}
        }
        const unique = [...new Map(instrumentos.map(x => [x.registro || x.solicitacao || x.url, x])).values()]
        results.push({ id, patronal, laboral, status: 'CONSULTADO', metodo: 'consulta oficial do Mediador por CNPJ + validação dos dois CNPJs no documento oficial', instrumentos: unique, candidatosVerificados: discovery.solicitations.length, totalEncontradoNaConsulta: discovery.totalFound, consultedAt: new Date().toISOString() })
      } catch (e) {
        results.push({ id, patronal, laboral, status: 'FONTE INDISPONÍVEL', error: e instanceof Error ? e.message : String(e), instrumentos: [], candidatosVerificados: 0, consultedAt: new Date().toISOString() })
      } finally { await page.close() }
    }
  } finally { await context.close(); await browser.close() }
  const run = { at: new Date().toISOString(), pairs: results }
  store.generatedAt = run.at; store.source = 'Mediador/MTE'; store.overallStatus = results.some(x => x.status === 'FONTE INDISPONÍVEL') ? 'FONTE INDISPONÍVEL' : 'CONSULTADO'; store.pairs = results; store.history = [run, ...(store.history || [])].slice(0, 90)
  await fs.writeFile(OUT, JSON.stringify(store, null, 2) + '\n')
}
main().catch(e => { console.error(e); process.exit(1) })

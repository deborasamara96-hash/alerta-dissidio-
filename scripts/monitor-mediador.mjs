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
const agora = () => new Date()
const anoAtual = () => agora().getFullYear()
const hoje = () => { const d = agora(); return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}` }
const inicioAno = () => `01/01/${anoAtual()}`
const solicitudUrl = s => `https://mediador.trabalho.gov.br/sistemas/mediador/Resumo/ResumoVisualizar?NrSolicitacao=${encodeURIComponent(s)}`

function normalizeSolicitud(value) {
  try { value = decodeURIComponent(String(value)) } catch {}
  return String(value).replace(/\\\//g, '/').replace(/\s+/g, '').toUpperCase()
}

function extractSolicitations(html) {
  const text = String(html || '').replace(/&amp;/g, '&').replace(/\\u002F/gi, '/').replace(/\\\//g, '/')
  const found = new Set()
  const patterns = [
    /MR\s*\d+\s*(?:%2F|\/)+\s*\d{4}/gi,
    /MR\d+%2F\d{4}/gi,
    /MR\d+\/\d{4}/gi
  ]
  for (const re of patterns) for (const m of text.matchAll(re)) {
    const v = normalizeSolicitud(m[0])
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
  const result = await page.evaluate(async ({ endpoint, cnpj, dataInicio, dataFim }) => {
    const params = new URLSearchParams()
    params.append('nrCnpj', cnpj)
    params.append('nrCei', '')
    params.append('noRazaoSocial', '')
    params.append('dsCategoria', '')
    for (const value of ['acordo','acordoColetivoEspecificoPPE','acordoColetivoEspecificoDomingosFeriados','convencao','termoAditivoAcordo','termoAditivoConvecao','termoAditivoAcordoEspecificoPPE','termoAditivoAcordoEspecificoDomingoFeriado']) params.append('tpRequerimento', value)
    params.append('tpVigencia', '2')
    params.append('sgUfDeRegistro', '')
    params.append('dtInicioRegistro', dataInicio)
    params.append('dtFimRegistro', dataFim)
    params.append('dtInicioVigenciaInstrumentoColetivo', dataInicio)
    params.append('dtFimVigenciaInstrumentoColetivo', dataFim)
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
    const body = await response.text()
    const doc = new DOMParser().parseFromString(body, 'text/html')
    const rows = [...doc.querySelectorAll('#grdInstrumentos tr')]
    const links = [...doc.querySelectorAll('a[href], [onclick]')]
    const structured = []
    for (const link of links) {
      const raw = `${link.getAttribute('href') || ''} ${link.getAttribute('onclick') || ''} ${link.textContent || ''}`
      const match = raw.match(/MR\s*\d+\s*(?:%2F|\/)+\s*\d{4}/i)
      if (!match) continue
      const solicitation = decodeURIComponent(match[0]).replace(/\s+/g, '').toUpperCase()
      if (!/^MR\d+\/\d{4}$/.test(solicitation)) continue
      const row = link.closest('tr')
      structured.push({ solicitation, href: link.getAttribute('href') || '', onclick: link.getAttribute('onclick') || '', rowText: row?.innerText || '' })
    }
    return { status: response.status, url: response.url, body, structured, rowCount: rows.length }
  }, { endpoint: ENDPOINT, cnpj: clean(cnpj), dataInicio: inicioAno(), dataFim: hoje() })
  if (result.status === 403) throw new Error('Mediador HTTP 403')
  if (result.status === 504) throw new Error('Mediador HTTP 504 (consulta oficial expirou)')
  if (result.status < 200 || result.status >= 400) throw new Error(`Mediador HTTP ${result.status}`)
  const solicitations = new Set(extractSolicitations(result.body))
  for (const item of result.structured || []) solicitations.add(item.solicitation)
  const lower = result.body.toLowerCase()
  return {
    requestSucceeded: true,
    noResults: /nenhum|não foram encontrados|nao foram encontrados|nenhum registro|0\s+registro/.test(lower),
    total: solicitations.size,
    solicitations: [...solicitations],
    structured: result.structured || [],
    responseUrl: result.url,
    responseSize: result.body.length,
    rowCount: result.rowCount
  }
}

function extractTextValue(text, regex) { return text.match(regex)?.[1]?.trim() || '' }

function parseDateBR(value) {
  const m = String(value || '').match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (!m) return null
  const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]))
  return Number.isNaN(d.getTime()) ? null : d
}

function extractVigencia(text) {
  const lines = String(text || '').split(/\r?\n/).map(x => x.trim()).filter(Boolean)
  const line = lines.find(x => /vig[eê]ncia|per[ií]odo de vig[eê]ncia/i.test(x) && /\d{1,2}\/\d{1,2}\/\d{4}/.test(x))
  if (line) return line
  return extractTextValue(text, /per[íi]odo de\s*([^\n]+)/i)
}

function vigenciaExpirada(vigencia) {
  const dates = [...String(vigencia || '').matchAll(/\d{1,2}\/\d{1,2}\/\d{4}/g)].map(m => parseDateBR(m[0])).filter(Boolean)
  if (dates.length < 2) return null
  const fim = dates[dates.length - 1]
  const hojeDate = new Date()
  hojeDate.setHours(0, 0, 0, 0)
  return fim < hojeDate
}

async function validate(page, solicitation, patronal, laboral, directUrl = null) {
  const url = directUrl && /^https:\/\/mediador\.trabalho\.gov\.br\/sistemas\/mediador\/Resumo\//i.test(directUrl)
    ? directUrl
    : solicitudUrl(solicitation)
  const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
  if (!response || !response.ok()) return null
  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {})
  const text = await page.locator('body').innerText()
  const normalized = clean(text)
  if (!normalized.includes(clean(patronal)) || !normalized.includes(clean(laboral))) return null
  const dataRegistro = extractTextValue(text, /DATA DE REGISTRO NO MTE:\s*([^\n]+)/i)
  const anoRegistro = dataRegistro.match(/\b(20\d{2})\b/)?.[1]
  if (anoRegistro !== String(anoAtual())) return null
  const vigencia = extractVigencia(text)
  const expirada = vigenciaExpirada(vigencia)
  if (expirada === true) return null
  return {
    url,
    registro: extractTextValue(text, /N[ÚU]MERO DE REGISTRO NO MTE:\s*([^\n]+)/i),
    solicitacao: extractTextValue(text, /N[ÚU]MERO DA SOLICITA[CÇ][AÃ]O:\s*([^\n]+)/i) || solicitation,
    dataRegistro,
    vigencia,
    vigencia_status: expirada === false ? 'VIGENTE' : 'INDETERMINADO',
    titulo: text.match(/^(Acordo Coletivo[^\n]*|Conven[cç][aã]o Coletiva[^\n]*|Termo Aditivo[^\n]*)/im)?.[1]?.trim() || 'Instrumento coletivo',
    validatedAt: new Date().toISOString()
  }
}

async function discoverPair(page, patronal, laboral) {
  const all = new Map(); let totalFound = 0; let successfulQueries = 0; const errors = []
  for (const cnpj of [patronal, laboral]) {
    let lastError = null
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const result = await searchByCnpj(page, cnpj)
        successfulQueries++
        totalFound += result.total
        for (const s of result.solicitations) {
          const row = result.structured.find(x => x.solicitation === s)
          all.set(s, row?.href || null)
        }
        lastError = null
        break
      } catch (e) {
        lastError = e instanceof Error ? e.message : String(e)
        if (attempt < 2) await sleep(1500)
      }
    }
    if (lastError) errors.push(lastError)
  }
  return { solicitations: [...all.entries()].map(([solicitation, href]) => ({ solicitation, href })), totalFound, successfulQueries, error: errors.join('; ') || null }
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
        if (discovery.successfulQueries === 0) {
          results.push({ id, patronal, laboral, status: 'FONTE INDISPONÍVEL', error: discovery.error || 'Não foi possível obter resposta da consulta oficial.', instrumentos: [], candidatosVerificados: 0, consultedAt: new Date().toISOString() })
          continue
        }
        const instrumentos = []
        const validationErrors = []
        for (const { solicitation, href } of discovery.solicitations.slice(0, 100)) {
          try {
            const doc = await validate(page, solicitation, patronal, laboral, href && href.startsWith('http') ? href : null)
            if (doc) instrumentos.push(doc)
          } catch (e) {
            validationErrors.push(`${solicitation}: ${e instanceof Error ? e.message : String(e)}`)
          }
        }
        const unique = [...new Map(instrumentos.map(x => [x.registro || x.solicitacao || x.url, x])).values()]
        results.push({
          id, patronal, laboral, status: 'CONSULTADO',
          metodo: `Consulta oficial do Mediador — registros de ${inicioAno()} até ${hoje()} + filtro de vigência até ${hoje()} + validação dos dois CNPJs no documento oficial`,
          filtroRegistro: { de: inicioAno(), ate: hoje(), ano: anoAtual() },
          filtroVigencia: { somenteVigentes: true, referencia: hoje() },
          instrumentos: unique,
          candidatosVerificados: discovery.solicitations.length,
          totalEncontradoNaConsulta: discovery.totalFound,
          consultasConfirmadas: discovery.successfulQueries,
          observacao: unique.length === 0 && discovery.solicitations.length > 0 ? 'Consulta oficial retornou candidatos, mas nenhum documento foi validado para os dois CNPJs no ano corrente e com vigência ativa. Não interpretar como ausência de novidade.' : undefined,
          errosValidacao: validationErrors.length ? validationErrors.slice(0, 20) : undefined,
          consultedAt: new Date().toISOString()
        })
      } catch (e) {
        results.push({ id, patronal, laboral, status: 'FONTE INDISPONÍVEL', error: e instanceof Error ? e.message : String(e), instrumentos: [], candidatosVerificados: 0, consultedAt: new Date().toISOString() })
      } finally { await page.close() }
    }
  } finally { await context.close(); await browser.close() }
  const run = { at: new Date().toISOString(), pairs: results }
  store.generatedAt = run.at
  store.source = 'Mediador/MTE'
  store.overallStatus = results.every(x => x.status === 'CONSULTADO') ? 'CONSULTADO' : results.some(x => x.status === 'CONSULTADO') ? 'PARCIAL' : 'FONTE INDISPONÍVEL'
  store.pairs = results
  store.history = [run, ...(store.history || [])].slice(0, 90)
  await fs.writeFile(OUT, JSON.stringify(store, null, 2) + '\n')
}
main().catch(e => { console.error(e); process.exit(1) })

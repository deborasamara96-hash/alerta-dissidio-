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

async function openOfficialSession(page) {
  const url = 'https://mediador.trabalho.gov.br/sistemas/mediador/ConsultarInstColetivo'
  const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
  const status = response?.status() || 0
  if (status < 200 || status >= 400) throw new Error(`Mediador HTTP ${status}`)
  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {})
  if (!/Consultar Instrumentos Coletivos Registrados/i.test(await page.locator('body').innerText())) {
    throw new Error('A página oficial de consulta não carregou o formulário esperado.')
  }
  return { url, status }
}

async function findCnpjInput(page) {
  const inputs = page.locator('input')
  const count = await inputs.count()
  const candidates = []
  for (let i = 0; i < count; i++) {
    const el = inputs.nth(i)
    const attrs = await el.evaluate(node => ({ id: node.id || '', name: node.getAttribute('name') || '', placeholder: node.getAttribute('placeholder') || '', value: node.value || '', type: node.type || '' }))
    const hay = `${attrs.id} ${attrs.name} ${attrs.placeholder}`.toLowerCase()
    if (/cnpj|caepf/.test(hay)) candidates.push({ i, attrs })
  }
  if (candidates.length) return inputs.nth(candidates[0].i)

  const visible = []
  for (let i = 0; i < count; i++) {
    if (await inputs.nth(i).isVisible().catch(() => false)) visible.push(i)
  }
  if (visible.length) return inputs.nth(visible[0])
  throw new Error('Campo CNPJ/CAEPF não encontrado na consulta oficial.')
}

async function searchByCnpj(page, cnpj) {
  await page.goto('https://mediador.trabalho.gov.br/sistemas/mediador/ConsultarInstColetivo', { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {})
  const input = await findCnpjInput(page)
  await input.fill(clean(cnpj))

  const searchButton = page.getByRole('button', { name: /^Pesquisar$/i }).first()
  if (!(await searchButton.count())) throw new Error('Botão Pesquisar não encontrado na consulta oficial.')

  await Promise.all([
    page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {}),
    searchButton.click()
  ])
  await sleep(1000)

  const responseText = await page.locator('body').innerText()
  const url = page.url()
  const statusText = responseText.match(/HTTP\s*([45]\d\d)/i)?.[1]
  if (statusText) throw new Error(`Mediador HTTP ${statusText}`)
  if (/403 Forbidden|Access Denied|Forbidden/i.test(responseText)) throw new Error('Mediador HTTP 403')

  const solicitations = new Set(extractSolicitations(await page.content()))
  const links = await page.locator('a').evaluateAll(els => els.map(a => ({ text: (a.textContent || '').trim(), href: a.href || '' })))
  for (const link of links) {
    const m = link.href.match(/MR\d+%2F\d{4}|MR\d+\/\d{4}/i)
    if (m) solicitations.add(decodeURIComponent(m[0]).toUpperCase())
    const t = link.text.match(/MR\d+\/\d{4}/i)
    if (t) solicitations.add(t[0].toUpperCase())
  }

  const noResults = /nenhum|não foram encontrados|nao foram encontrados|0\s+registro/i.test(responseText)
  return { total: noResults ? 0 : solicitations.size, solicitations: [...solicitations], url, body: responseText }
}

function extractTextValue(text, regex) { return text.match(regex)?.[1]?.trim() || '' }

async function validate(page, solicitation, patronal, laboral) {
  const response = await page.goto(solicitacaoUrl(solicitation), { waitUntil: 'domcontentloaded', timeout: 30000 })
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
    try {
      const result = await searchByCnpj(page, cnpj)
      totalFound += result.total || 0
      for (const s of result.solicitations) all.add(s)
    } catch (e) { errors.push(e instanceof Error ? e.message : String(e)) }
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
          results.push({ id, patronal, laboral, status: 'FONTE INDISPONÍVEL', error: discovery.error || 'A consulta oficial não retornou instrumentos.', instrumentos: [], candidatosVerificados: 0, consultedAt: new Date().toISOString() })
          continue
        }
        const instrumentos = []
        for (const solicitation of discovery.solicitations.slice(0, 100)) {
          try { const doc = await validate(page, solicitation, patronal, laboral); if (doc) instrumentos.push(doc) } catch {}
        }
        const unique = [...new Map(instrumentos.map(x => [x.registro || x.solicitacao || x.url, x])).values()]
        results.push({ id, patronal, laboral, status: 'CONSULTADO', metodo: 'consulta pela interface oficial do Mediador por CNPJ + validação dos dois CNPJs', instrumentos: unique, candidatosVerificados: discovery.solicitations.length, totalEncontradoNaConsulta: discovery.totalFound, consultedAt: new Date().toISOString() })
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

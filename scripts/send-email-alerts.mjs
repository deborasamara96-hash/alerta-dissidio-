import fs from 'node:fs/promises'

const RESEND_ENDPOINT = 'https://api.resend.com/emails'
const previousPath = process.argv[2] || '/tmp/previous-results.json'

const readJson = async path => {
  try { return JSON.parse(await fs.readFile(path, 'utf8')) } catch { return null }
}
const recipients = () => String(process.env.ALERTA_EMAILS || '')
  .split(/[;,\s]+/).map(v => v.trim().toLowerCase())
  .filter(v => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v))
const key = item => String(item.registro || item.solicitacao || item.url || '').trim().toUpperCase()
const escapeHtml = value => String(value || '').replace(/[&<>\"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]))

const previous = await readJson(previousPath)
const current = await readJson('data/results.json')
const to = recipients()
const apiKey = process.env.RESEND_API_KEY
const from = process.env.ALERTA_FROM_EMAIL

if (!current) throw new Error('Resultado atual do monitoramento não encontrado.')
if (current.overallStatus === 'FONTE INDISPONÍVEL') {
  console.log('E-mail não enviado: FONTE INDISPONÍVEL.')
  process.exit(0)
}
if (!apiKey || !from || !to.length) {
  console.log('Alertas por e-mail aguardando configuração: RESEND_API_KEY, ALERTA_FROM_EMAIL e ALERTA_EMAILS.')
  process.exit(0)
}

const oldKeys = new Set((previous?.pairs || []).flatMap(pair => (pair.instrumentos || []).map(item => `${pair.id}:${key(item)}`)))
const fresh = []
for (const pair of current.pairs || []) {
  for (const item of pair.instrumentos || []) {
    const itemKey = key(item)
    if (itemKey && !oldKeys.has(`${pair.id}:${itemKey}`)) fresh.push({ pair, item })
  }
}
if (!fresh.length) {
  console.log('Nenhum novo instrumento vigente. Nenhum e-mail enviado.')
  process.exit(0)
}

const rows = fresh.map(({ pair, item }) => `<div style="padding:14px 0;border-bottom:1px solid #e5e7eb"><strong>Par ${escapeHtml(pair.id)}</strong><br>Tipo: ${escapeHtml(item.tipo || item.titulo || 'Instrumento coletivo')}<br>Registro: ${escapeHtml(item.registro || item.solicitacao || 'Não informado')}<br>Data de registro: ${escapeHtml(item.dataRegistro || 'Não informada')}<br>Vigência: ${escapeHtml(item.vigencia || 'Não informada')}<br><a href="${escapeHtml(item.url || item.documentUrl || item.link || '')}">Abrir documento oficial no Mediador/MTE</a></div>`).join('')
const html = `<div style="font-family:Arial,sans-serif;max-width:720px;margin:auto;color:#1f2937"><h2>NOVO INSTRUMENTO VIGENTE</h2><p>O Alerta Dissídio Zwei Bock encontrou ${fresh.length} novo(s) instrumento(s) vigente(s) na consulta oficial do Mediador/MTE.</p>${rows}<p style="font-size:12px;color:#6b7280;margin-top:24px">Alerta Dissídio Zwei Bock • Sem dados fictícios.</p></div>`

const response = await fetch(RESEND_ENDPOINT, {
  method: 'POST',
  headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ from, to, subject: `Alerta Dissídio: ${fresh.length} novo(s) instrumento(s) vigente(s)`, html })
})
if (!response.ok) throw new Error(`Falha no envio do e-mail (${response.status}).`)
console.log(`Alerta enviado para ${to.length} destinatário(s). Novos instrumentos: ${fresh.length}.`)

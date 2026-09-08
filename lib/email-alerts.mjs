const RESEND_ENDPOINT = 'https://api.resend.com/emails'

function recipients() {
  return String(process.env.ALERTA_EMAILS || '')
    .split(/[;,\s]+/)
    .map(v => v.trim().toLowerCase())
    .filter(v => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v))
}

function instrumentKey(item) {
  return String(item.registro || item.solicitacao || item.url || '').trim().toUpperCase()
}

function flatten(store) {
  const out = new Map()
  for (const pair of store?.pairs || []) {
    for (const item of pair.instrumentos || []) {
      const key = `${pair.id}:${instrumentKey(item)}`
      if (instrumentKey(item)) out.set(key, { pair, item })
    }
  }
  return out
}

function htmlEscape(value) {
  return String(value || '').replace(/[&<>\"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[ch]))
}

export function getEmailStatus() {
  const to = recipients()
  return {
    configured: Boolean(process.env.RESEND_API_KEY && process.env.ALERTA_FROM_EMAIL && to.length),
    recipients: to.length,
    provider: 'Resend',
    reason: !process.env.RESEND_API_KEY
      ? 'RESEND_API_KEY não configurada.'
      : !process.env.ALERTA_FROM_EMAIL
        ? 'ALERTA_FROM_EMAIL não configurada.'
        : !to.length
          ? 'ALERTA_EMAILS não configurada.'
          : undefined
  }
}

export async function sendAlertEmail({ subject, title, intro, items }) {
  const to = recipients()
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.ALERTA_FROM_EMAIL
  if (!apiKey || !from || !to.length) return { sent: false, skipped: true, reason: getEmailStatus().reason }

  const rows = items.map(({ pair, item }) => `
    <div style="padding:14px 0;border-bottom:1px solid #e5e7eb">
      <strong>Par ${htmlEscape(pair.id)}</strong><br>
      Tipo: ${htmlEscape(item.tipo || item.titulo || 'Instrumento coletivo')}<br>
      Registro: ${htmlEscape(item.registro || item.solicitacao || 'Não informado')}<br>
      Data de registro: ${htmlEscape(item.dataRegistro || 'Não informada')}<br>
      Vigência: ${htmlEscape(item.vigencia || 'Não informada')}<br>
      <a href="${htmlEscape(item.url || item.documentUrl || item.link || '')}">Abrir documento oficial no Mediador/MTE</a>
    </div>`).join('')

  const body = `<div style="font-family:Arial,sans-serif;max-width:720px;margin:auto;color:#1f2937">
    <h2>${htmlEscape(title)}</h2><p>${htmlEscape(intro)}</p>${rows}
    <p style="font-size:12px;color:#6b7280;margin-top:24px">Alerta Dissídio Zwei Bock • Dados exclusivamente da fonte oficial Mediador/MTE.</p>
  </div>`

  const response = await fetch(RESEND_ENDPOINT, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to, subject, html: body })
  })
  if (!response.ok) throw new Error(`Falha no envio do e-mail (${response.status}).`)
  return { sent: true, recipients: to.length }
}

export async function notifyNewInstruments(previous, current) {
  if (current?.overallStatus === 'FONTE INDISPONÍVEL') return { sent: false, skipped: true, reason: 'FONTE INDISPONÍVEL' }
  const oldKeys = new Set(flatten(previous).keys())
  const fresh = [...flatten(current).entries()]
    .filter(([key]) => !oldKeys.has(key))
    .map(([, value]) => value)
  if (!fresh.length) return { sent: false, skipped: true, reason: 'Nenhum instrumento novo.' }
  return sendAlertEmail({
    subject: `Alerta Dissídio: ${fresh.length} novo(s) instrumento(s) vigente(s)`,
    title: 'NOVO INSTRUMENTO VIGENTE',
    intro: 'O monitoramento oficial encontrou documento(s) novo(s) ainda não registrados no histórico anterior.',
    items: fresh
  })
}

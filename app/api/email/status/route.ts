import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const emails = String(process.env.ALERTA_EMAILS || '').split(/[;,\s]+/).map(v => v.trim()).filter(Boolean)
  const valid = emails.filter(v => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v))
  const configured = Boolean(process.env.RESEND_API_KEY && process.env.ALERTA_FROM_EMAIL && valid.length)
  return NextResponse.json({
    configured,
    recipients: valid.length,
    provider: 'Resend',
    message: configured
      ? `${valid.length} destinatário(s) configurado(s) para alertas automáticos.`
      : 'Envio automático aguardando configuração segura do serviço de e-mail.'
  }, { headers: { 'Cache-Control': 'no-store' } })
}

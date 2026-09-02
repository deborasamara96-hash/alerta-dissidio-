import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST() {
  return NextResponse.json({
    ok: false,
    error: 'CONSULTA MANUAL INDISPONÍVEL NO SERVIDOR WEB: a consulta do Mediador usa navegador Chromium e deve ser executada pelo monitor oficial. O botão não deve transformar FONTE INDISPONÍVEL em SEM NOVIDADE.'
  }, { status: 503 })
}

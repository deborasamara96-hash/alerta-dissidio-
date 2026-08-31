import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const SOURCES = [
  'https://mediador.trabalho.gov.br/sistemas/mediador/ConsultarInstColetivo',
  'https://www3.mte.gov.br/sistemas/mediador/ConsultarInstColetivo',
]

async function probe(url: string) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 12000)
  try {
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      cache: 'no-store',
      signal: controller.signal,
      headers: { 'User-Agent': 'AlertaDissidio/1.0 (monitoramento de fonte oficial)' },
    })
    return { ok: response.ok, status: response.status, url: response.url }
  } catch (error) {
    return { ok: false, status: 0, url, error: error instanceof Error ? error.message : 'erro desconhecido' }
  } finally {
    clearTimeout(timer)
  }
}

export async function GET() {
  const attempts = await Promise.all(SOURCES.map(probe))
  const available = attempts.find((item) => item.ok)

  if (!available) {
    return NextResponse.json({
      status: 'FONTE_INDISPONIVEL',
      checkedAt: new Date().toISOString(),
      source: 'Mediador / MTE',
      attempts,
      message: 'O sistema não conseguiu consultar a página oficial do Mediador. Isso NÃO é interpretado como ausência de novidade.',
    }, { status: 503 })
  }

  return NextResponse.json({
    status: 'FONTE_DISPONIVEL',
    checkedAt: new Date().toISOString(),
    source: 'Mediador / MTE',
    url: available.url,
    message: 'A fonte oficial respondeu. A etapa de consulta estruturada por CNPJ deve validar os campos e resultados antes de classificar instrumentos.',
    attempts,
  })
}

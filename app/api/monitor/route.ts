import { NextResponse } from 'next/server'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const file = await readFile(path.join(process.cwd(),'data','results.json'),'utf8')
    const data = JSON.parse(file)
    const unavailable = data.overallStatus === 'FONTE INDISPONÍVEL'
    return NextResponse.json({
      checkedAt: data.generatedAt,
      source: 'Mediador/MTE',
      sourceUrl: 'https://mediador.trabalho.gov.br/sistemas/mediador/ConsultarInstColetivo',
      status: unavailable ? 'FONTE INDISPONÍVEL' : 'MONITORAMENTO CONCLUÍDO',
      message: unavailable ? 'A última execução não conseguiu consultar a fonte oficial.' : 'Última execução validada a partir de documentos oficiais do Mediador.',
      method: 'Descoberta pública de documentos + validação dos dois CNPJs no documento oficial.',
      rule: 'FONTE INDISPONÍVEL nunca é interpretada como SEM NOVIDADE',
    })
  } catch (error) {
    return NextResponse.json({status:'FONTE INDISPONÍVEL',message:'Histórico de monitoramento indisponível.',checkedAt:null},{status:503})
  }
}

import { NextResponse } from 'next/server'
import { checkMediador } from '@/lib/monitor'
export const dynamic='force-dynamic'
export async function GET(){
 const checkedAt=new Date().toISOString(); const source=await checkMediador()
 return NextResponse.json({checkedAt,source:'Mediador/MTE',sourceUrl:'https://mediador.trabalho.gov.br/sistemas/mediador/ConsultarInstColetivo',status:source.status==='ONLINE'?'SITE ACESSÍVEL':'FONTE INDISPONÍVEL',message:source.message,httpStatus:source.httpStatus??null,rule:'Acessibilidade do site não equivale a resultado de consulta. FONTE INDISPONÍVEL nunca é interpretada como SEM NOVIDADE.'},{status:200})
}

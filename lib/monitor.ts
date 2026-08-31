export const MEDIADOR_URL = 'https://mediador.trabalho.gov.br/sistemas/mediador/ConsultarInstColetivo'

export type Pair = { id:string; patronal:string; laboral:string }

export async function checkMediador(): Promise<{status:'ONLINE'|'OFFLINE'; httpStatus?:number; message:string}> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15000)
  try {
    const response = await fetch(MEDIADOR_URL, {
      method: 'GET',
      redirect: 'follow',
      headers: { 'user-agent': 'Alerta-Dissidio/1.0 (monitoramento público)' },
      cache: 'no-store',
      signal: controller.signal,
    })
    if (!response.ok) return { status:'OFFLINE', httpStatus:response.status, message:`Mediador respondeu HTTP ${response.status}` }
    return { status:'ONLINE', httpStatus:response.status, message:'Fonte oficial acessível.' }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido ao consultar a fonte oficial.'
    return { status:'OFFLINE', message }
  } finally { clearTimeout(timeout) }
}

export function pairKey(patronal:string, laboral:string) { return `${patronal.replace(/\D/g,'')}:${laboral.replace(/\D/g,'')}` }

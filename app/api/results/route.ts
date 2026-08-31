import { NextResponse } from 'next/server'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const file = await readFile(path.join(process.cwd(),'data','results.json'),'utf8')
    return NextResponse.json(JSON.parse(file), {headers:{'Cache-Control':'no-store'}})
  } catch (error) {
    return NextResponse.json({generatedAt:null,source:'Mediador/MTE',overallStatus:'FONTE INDISPONÍVEL',pairs:[],history:[],message:error instanceof Error?error.message:'Histórico indisponível.'},{status:503})
  }
}

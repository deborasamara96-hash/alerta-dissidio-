'use client'

import { useState } from 'react'

const pairs = [
['01','93.246.940/0001-46','89.069.835/0001-01','FEDERACAO DOS HOSPITAIS E ESTABELECIMENTO DE SERVIO DE SAUDE DO RIO GRANDE SUL','SIND. DOS TRAB. EM ESTABELECIMENTOS DE SERVICOS DE SAUDE DO VALE DOS SINOS'],
['02','18.006.733/0001-07','15.635.336/0001-06','SIND. DAS EMPRESAS PREST. DE SERV. NO SEGM. DE REFRIG. AQUEC. CLIMATIZ E VENT RS','SIND. DOS TRABALHADORES EM REFRIGERACAO, AQUECIMENTO E TRATAMENTO DE AR NO RS'],
['03','91.100.339/0001-15','96.757.612/0001-00','SIND. DO COMERCIO VAREJISTA DE SAO LEOPOLDO','SIND. DOS EMPREGADOS NO COMERCIO DE SAO LEOPOLDO'],
['04','89.138.168/0001-71','91.345.231/0001-92','SIND. DAS EMPRESAS DE SERVIÇOS CONTABEIS, ASSES, PERICIA, INF. E PESQUISA DO RS','SIND. DOS EMPREG. EMPRESAS ASS PERICIAS INF PESQ FUND EST RS'],
['05','88.368.592/0001-40','97.202.535/0001-87','SIND. DAS INDUSTRIAS DA CONSTRUCAO E DO MOBILIARIO DE SAO LEOPOLDO','SIND. DOS TRAB. NAS IND. DA CONSTRUÇÃO E DO MOBILIÁRIO DE SÃO SEBASTIÃO DO CAÍ'],
['06','88.368.592/0001-40','96.757.737/0001-22','SIND. DAS INDUSTRIAS DA CONSTRUCAO E DO MOBILIARIO DE SAO LEOPOLDO','SIND. DOS TRAB. NAS IND. DA CONSTRUCAO E DO MOBILIARIO DE SAO LEOPOLDO'],
['07','89.138.168/0001-71','91.343.194/0001-83','SIND. DAS EMPRESAS DE SERVIÇOS CONTABEIS, ASSES, PERICIA, INF. E PESQUISA DO RS','SINDICATO DOS ADVOGADOS NO ESTADO DO RIO GRANDE DO SUL'],
['08','92.962.919/0001-84','92.931.492/0001-57','SIND. DE HOTEIS, RESTAURANTES, BARES E SIMILARES DE PORTO ALEGRE','SIND. DOS EMPREG. COM HOT REST BARES SIM E EMP ALIM PREP DE SL'],
['09','89.137.574/0001-10','93.074.185/0001-60','SIND. INTERMUNICIPAL EMPR COMPRA,VENDA,LOC E ADM IMOV E COND RESD E COMERC NO RS','SIND. DOS EMPREG. EM EMPRESAS DE COMPRA, VENDA E LOC ADMN DE IMOVEIS NO RS'],
['10','96.755.145/0001-71','96.758.008/0001-90','SIND. DAS IND. METALURGICAS, MECANICAS E DE MATERIAL ELETRICO E ELETRONICO DE SL','SIND DOS TRABALHADORES NAS IND MET MEC E DE MAT ELETR DE SAO LEOPOLDO'],
['11','93.712.909/0001-53','93.074.383/0001-23','SIND. DAS EMPRESAS DE LOCACAO DE BENS MOVEIS DO ESTADO DO RIO GRANDE DO SUL','SIND. DOS EMPREGADOS DE AGENTES AUTONOMOS DO COMERCIO NO ESTADO DO RS'],
['12','93.712.909/0001-53','96.758.040/0001-76','SIND. DAS EMPRESAS DE LOCACAO DE BENS MOVEIS DO ESTADO DO RIO GRANDE DO SUL','SIND. DOS TRABALHADORES EM TRANSPORTES RODOVIARIOS DE SAO LEOPOLDO'],
]

type SourceResult = { status: string; checkedAt: string; message?: string; attempts?: unknown[] }

export default function Home(){
 const [checking,setChecking]=useState(false)
 const [result,setResult]=useState<SourceResult | null>(null)
 const check=async()=>{
   setChecking(true)
   setResult(null)
   try {
     const response=await fetch('/api/monitor',{cache:'no-store'})
     const data=await response.json()
     setResult(data)
   } catch {
     setResult({status:'FONTE_INDISPONIVEL',checkedAt:new Date().toISOString(),message:'Não foi possível executar a consulta. Isso NÃO é interpretado como ausência de novidade.'})
   } finally { setChecking(false) }
 }
 const sourceUnavailable=result?.status==='FONTE_INDISPONIVEL'
 return <main className="shell">
  <header className="topbar"><div className="brand"><span className="brandMark">AD</span> Alerta Dissídio</div><span className="sourceBadge">● Mediador / MTE — fonte oficial</span></header>
  <div className="content">
   <section className="hero"><div><div className="eyebrow">Departamento Pessoal</div><h1>Monitoramento de Dissídios</h1><p>12 pares de sindicatos cadastrados para acompanhamento de instrumentos coletivos.</p></div><button className="refresh" onClick={check} disabled={checking}>{checking?'Consultando fonte oficial…':'Verificar fonte oficial'}</button></section>
   <section className="grid">
    <div className="card"><div className="muted">Pares monitorados</div><div className="metric">12</div></div>
    <div className="card"><div className="muted">Novos instrumentos</div><div className="metric">—</div></div>
    <div className="card"><div className="muted">Aditivos</div><div className="metric">—</div></div>
    <div className="card"><div className="muted">Sem novidade</div><div className="metric">—</div></div>
    <div className="card"><div className="status"><span className={`dot ${sourceUnavailable?'red':'warn'}`}/> Fonte</div><div className="metric" style={{fontSize:18}}>{result ? (sourceUnavailable?'FONTE INDISPONÍVEL':'FONTE DISPONÍVEL') : 'Aguardando consulta'}</div></div>
   </section>
   <div className="notice"><strong>Regra de segurança:</strong> disponibilidade da fonte não significa que instrumentos foram encontrados. A classificação de novidades só ocorrerá após uma consulta estruturada e validada dos dados oficiais. Se a fonte falhar, o sistema mostra <strong>FONTE INDISPONÍVEL</strong>.</div>
   {result && <div className={sourceUnavailable?'notice':'notice'}><strong>{sourceUnavailable?'FONTE INDISPONÍVEL':'FONTE DISPONÍVEL'}</strong> — {result.message} <span className="muted">Verificação: {new Date(result.checkedAt).toLocaleString('pt-BR')}</span></div>}
   <section className="section"><div className="sectionTitle"><h2>Sindicatos monitorados</h2><span className="muted">Fonte: Mediador / MTE</span></div>
    <div className="table"><div className="row head"><div>#</div><div>Entidade patronal</div><div>Entidade laboral</div><div>Fonte</div><div>Situação</div></div>
    {pairs.map(p=><div className="row" key={p[0]}><div className="pair">{p[0]}</div><div><strong>{p[3]}</strong><div className="cnpj">CNPJ {p[1]}</div></div><div><strong>{p[4]}</strong><div className="cnpj">CNPJ {p[2]}</div></div><div><span className="tag">Mediador/MTE</span></div><div><span className={`tag ${sourceUnavailable?'offline':'pending'}`}>{result ? (sourceUnavailable?'FONTE INDISPONÍVEL':'Aguardando consulta dos instrumentos') : 'Não consultado'}</span></div></div>)}
    </div>
   </section>
   <div className="footer">V1 • Não são exibidos instrumentos fictícios. A consulta de instrumentos será considerada válida somente quando os resultados oficiais puderem ser obtidos e identificados com segurança.</div>
  </div>
 </main>
}

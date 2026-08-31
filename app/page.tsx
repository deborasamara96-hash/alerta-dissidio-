'use client'

import { useEffect, useState } from 'react'

const pairs = [
['01','93.246.940/0001-46','89.069.835/0001-01','FEDERACAO DOS HOSPITAIS E ESTABELECIMENTO DE SERVIO DE SAUDE DO RIO GRANDE SUL','SIND. DOS TRAB. EM ESTABELECIMENTOS DE SERVICOS DE SAUDE DO VALE DOS SINOS'],
['02','18.006.733/0001-07','15.635.336/0001-06','SIND. DAS EMPRESAS PREST. DE SERV. NO SEGM. DE REFRIG. AQUEC. CLIMATIZ E VENT RS','SIND. DOS TRABALHADORES EM REFRIGERACAO, AQUECIMENTO E TRATAMENTO DE AR NO RS'],
['03','91.100.339/0001-15','96.757.612/0001-00','SIND. DO COMERCIO VAREJISTA DE SAO LEOPOLDO','SIND. DOS EMPREGADOS NO COMERCIO DE SAO LEOPOLDO'],
['04','89.138.168/0001-71','91.345.231/0001-92','SIND. DAS EMPRESAS DE SERVIÇOS CONTABEIS, ASSES, PERICIA, INF. E PESQUISA DO RS','SIND. DOS EMPREG. EMPRESAS ASS PERICIAS INF PESQ FUND EST RS'],
['05','88.368.592/0001-40','97.202.535/0001-87','SIND. DAS INDUSTRIAS DA CONSTRUCAO E DO MOBILIARIO DE SAO LEOPOLDO','SIND. DOS TRAB. NAS IND. DA CONSTRUÇÃO E DO MOBILIÁRIO DE SÃO SEBASTIÃO DO CAÍ'],
['06','88.368.592/0001-40','96.757.737/0001-22','SIND. DAS INDUSTRIAS DA CONSTRUCAO E DO MOBILIARIO DE SAO LEOPOLDO','SIND. DOS TRAB. NAS IND. DA CONSTRUÇÃO E DO MOBILIÁRIO DE SAO LEOPOLDO'],
['07','89.138.168/0001-71','91.343.194/0001-83','SIND. DAS EMPRESAS DE SERVIÇOS CONTABEIS, ASSES, PERICIA, INF. E PESQUISA DO RS','SINDICATO DOS ADVOGADOS NO ESTADO DO RIO GRANDE DO SUL'],
['08','92.962.919/0001-84','92.931.492/0001-57','SIND. DE HOTEIS, RESTAURANTES, BARES E SIMILARES DE PORTO ALEGRE','SIND. DOS EMPREG. COM HOT REST BARES SIM E EMP ALIM PREP DE SL'],
['09','89.137.574/0001-10','93.074.185/0001-60','SIND. INTERMUNICIPAL EMPR COMPRA,VENDA,LOC E ADM IMOV E COND RESD E COMERC NO RS','SIND. DOS EMPREG. EM EMPRESAS DE COMPRA, VENDA E LOC ADMN DE IMOVEIS NO RS'],
['10','96.755.145/0001-71','96.758.008/0001-90','SIND. DAS IND. METALURGICAS, MECANICAS E DE MATERIAL ELETRICO E ELETRONICO DE SL','SIND DOS TRABALHADORES NAS IND MET MEC E DE MAT ELETR DE SAO LEOPOLDO'],
['11','93.712.909/0001-53','93.074.383/0001-23','SIND. DAS EMPRESAS DE LOCACAO DE BENS MOVEIS DO ESTADO DO RIO GRANDE DO SUL','SIND. DOS EMPREGADOS DE AGENTES AUTONOMOS DO COMERCIO NO ESTADO DO RS'],
['12','93.712.909/0001-53','96.758.040/0001-76','SIND. DAS EMPRESAS DE LOCACAO DE BENS MOVEIS DO ESTADO DO RIO GRANDE DO SUL','SIND. DOS TRABALHADORES EM TRANSPORTES RODOVIARIOS DE SAO LEOPOLDO'],
]

type PairResult={id:string;status:string;instrumentos?:unknown[];error?:string;consultedAt?:string}
type Store={generatedAt:string|null;overallStatus:string;pairs:PairResult[]}

export default function Home(){
 const [checking,setChecking]=useState(false)
 const [source,setSource]=useState<{status:string;message?:string;checkedAt?:string}|null>(null)
 const [store,setStore]=useState<Store|null>(null)
 const load=async()=>{
   const [r,s]=await Promise.all([fetch('/api/results?ts='+Date.now(),{cache:'no-store'}),fetch('/api/monitor?ts='+Date.now(),{cache:'no-store'})])
   const data=await r.json(); const health=await s.json(); setStore(data); setSource(health)
 }
 useEffect(()=>{load().catch(()=>{})},[])
 const check=async()=>{setChecking(true);try{await load()}catch{setSource({status:'FONTE INDISPONÍVEL',message:'Não foi possível carregar o último monitoramento.'})}finally{setChecking(false)}}
 const unavailable=store?.overallStatus==='FONTE INDISPONÍVEL'
 const consulted=store?.pairs?.filter(p=>p.status==='CONSULTADO')||[]
 const instruments=consulted.reduce((n,p)=>n+(p.instrumentos?.length||0),0)
 return <main className="shell">
  <header className="topbar"><div className="brand"><span className="brandMark">AD</span> Alerta Dissídio</div><span className={unavailable?'sourceBadge offline':'sourceBadge'}>● Mediador / MTE — fonte oficial</span></header>
  <div className="content">
   <section className="hero"><div><div className="eyebrow">Departamento Pessoal</div><h1>Monitoramento de Dissídios</h1><p>12 pares de sindicatos cadastrados para acompanhamento de instrumentos coletivos.</p></div><button className="refresh" onClick={check} disabled={checking}>{checking?'Atualizando…':'Atualizar monitoramento'}</button></section>
   <section className="grid">
    <div className="card"><div className="muted">Pares monitorados</div><div className="metric">12</div></div>
    <div className="card"><div className="muted">Instrumentos encontrados</div><div className="metric">{store?instruments:'—'}</div></div>
    <div className="card"><div className="muted">Pares consultados</div><div className="metric">{store?consulted.length:'—'}</div></div>
    <div className="card"><div className="muted">Fonte indisponível</div><div className="metric">{store?store.pairs.filter(p=>p.status==='FONTE INDISPONÍVEL').length:'—'}</div></div>
    <div className="card"><div className="status"><span className={`dot ${unavailable?'red':'warn'}`}/> Fonte</div><div className="metric" style={{fontSize:18}}>{unavailable?'FONTE INDISPONÍVEL':source?.status||'Aguardando monitoramento'}</div></div>
   </section>
   <div className={unavailable?'notice danger':'notice'}><strong>Regra de segurança:</strong> FONTE INDISPONÍVEL nunca é tratada como SEM NOVIDADE. Instrumentos só são contabilizados quando o documento oficial do Mediador contém e valida os dois CNPJs do par.</div>
   {source?.message&&<div className="notice"><strong>Status do último monitoramento:</strong> {source.message} {source.checkedAt&&<span className="muted"> — {new Date(source.checkedAt).toLocaleString('pt-BR')}</span>}</div>}
   <section className="section"><div className="sectionTitle"><h2>Sindicatos monitorados</h2><span className="muted">Histórico oficial armazenado no repositório</span></div>
    <div className="table"><div className="row head"><div>#</div><div>Entidade patronal</div><div>Entidade laboral</div><div>Fonte</div><div>Situação</div></div>
    {pairs.map(p=>{const r=store?.pairs?.find(x=>x.id===p[0]);const off=r?.status==='FONTE INDISPONÍVEL';const count=r?.instrumentos?.length||0;return <div className="row" key={p[0]}><div className="pair">{p[0]}</div><div><strong>{p[3]}</strong><div className="cnpj">CNPJ {p[1]}</div></div><div><strong>{p[4]}</strong><div className="cnpj">CNPJ {p[2]}</div></div><div><span className="tag">Mediador/MTE</span></div><div><span className={`tag ${off?'offline':r?'':'pending'}`}>{off?'FONTE INDISPONÍVEL':r?`${count} instrumento(s) validado(s)`:'Aguardando execução automática'}</span></div></div>})}
    </div>
   </section>
   <div className="footer">V2 • Monitoramento automático diário. Descoberta pública de documentos e validação no documento oficial do MTE. Sem dados fictícios.</div>
  </div>
 </main>
}

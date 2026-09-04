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

type Instrument={url?:string;documentUrl?:string;link?:string;registro?:string;numeroRegistro?:string;tipo?:string;vigencia?:string;ano?:string;anoRegistro?:string;vigencia_status?:string;origem?:string;titulo?:string;[key:string]:unknown}
type PairResult={id:string;status:string;instrumentos?:Instrument[];error?:string;consultedAt?:string;origem?:string;observacao?:string}
type Store={generatedAt:string|null;overallStatus:string;pairs:PairResult[]}

const documentUrl=(item:Instrument)=>item.documentUrl||item.url||item.link||''
const isFallback=(item:Instrument)=>item.origem==='ULTIMO_VIGENTE'

export default function Home(){
 const [checking,setChecking]=useState(false)
 const [message,setMessage]=useState('')
 const [source,setSource]=useState<{status:string;message?:string;checkedAt?:string}|null>(null)
 const [store,setStore]=useState<Store|null>(null)
 const load=async()=>{const [r,s]=await Promise.all([fetch('/api/results?ts='+Date.now(),{cache:'no-store'}),fetch('/api/monitor?ts='+Date.now(),{cache:'no-store'})]);setStore(await r.json());setSource(await s.json())}
 useEffect(()=>{load().catch(()=>{})},[])
 const check=async()=>{setChecking(true);setMessage('Iniciando consulta real no Mediador/MTE…');try{const response=await fetch('/api/monitor/run',{method:'POST',cache:'no-store'});const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data?.error||'A consulta não pôde ser executada.');await load();setMessage(data?.message||'Consulta concluída.')}catch(error){setMessage(error instanceof Error?error.message:'FONTE INDISPONÍVEL');await load().catch(()=>{})}finally{setChecking(false)}}
 const unavailable=store?.overallStatus==='FONTE INDISPONÍVEL'; const consulted=store?.pairs?.filter(p=>p.status==='CONSULTADO')||[]; const instruments=consulted.reduce((n,p)=>n+(p.instrumentos?.length||0),0); const fallbackCount=consulted.filter(p=>p.origem==='ULTIMO_VIGENTE').length
 return <main className="shell"><header className="topbar"><div className="brand"><span className="brandMark">AD</span> Alerta Dissídio</div><span className={unavailable?'sourceBadge offline':'sourceBadge'}>● Mediador / MTE — fonte oficial</span></header><div className="content">
 <section className="hero"><div><div className="eyebrow">Departamento Pessoal</div><h1>Monitoramento de Dissídios</h1><p>12 pares de sindicatos cadastrados para acompanhamento de instrumentos coletivos.</p></div><button className="refresh" onClick={check} disabled={checking}>{checking?'Consultando Mediador…':'Consultar agora'}</button></section>
 {message&&<div className={unavailable?'notice danger':'notice'}><strong>Execução:</strong> {message}</div>}
 <section className="grid"><div className="card"><div className="muted">Pares monitorados</div><div className="metric">12</div></div><div className="card"><div className="muted">Instrumentos vigentes</div><div className="metric">{store?instruments:'—'}</div></div><div className="card"><div className="muted">Pares consultados</div><div className="metric">{store?consulted.length:'—'}</div></div><div className="card"><div className="muted">Último vigente histórico</div><div className="metric">{store?fallbackCount:'—'}</div></div><div className="card"><div className="status"><span className={`dot ${unavailable?'red':'warn'}`}/> Fonte</div><div className="metric" style={{fontSize:18}}>{unavailable?'FONTE INDISPONÍVEL':source?.status||'Aguardando monitoramento'}</div></div></section>
 <div className={unavailable?'notice danger':'notice'}><strong>Regra de segurança:</strong> FONTE INDISPONÍVEL nunca é tratada como SEM NOVIDADE. Só entram instrumentos com documento oficial do Mediador contendo e validando os dois CNPJs do par e com vigência ativa.</div>
 {source?.message&&<div className="notice"><strong>Status do último monitoramento:</strong> {source.message} {source.checkedAt&&<span className="muted"> — {new Date(source.checkedAt).toLocaleString('pt-BR')}</span>}</div>}
 <section className="section"><div className="sectionTitle"><h2>Sindicatos monitorados</h2><span className="muted">Prioridade: ano corrente • fallback: último vigente histórico</span></div><div className="table"><div className="row head"><div>#</div><div>Entidade patronal</div><div>Entidade laboral</div><div>Fonte</div><div>Situação / documento</div></div>{pairs.map(p=>{const r=store?.pairs?.find(x=>x.id===p[0]);const off=r?.status==='FONTE INDISPONÍVEL';const count=r?.instrumentos?.length||0;const first=r?.instrumentos?.[0];const url=first?documentUrl(first):'';const fallback=first?isFallback(first):false;return <div className="row" key={p[0]}><div className="pair">{p[0]}</div><div><strong>{p[3]}</strong><div className="cnpj">CNPJ {p[1]}</div></div><div><strong>{p[4]}</strong><div className="cnpj">CNPJ {p[2]}</div></div><div><span className="tag">Mediador/MTE</span></div><div>{off?<span className="tag offline">FONTE INDISPONÍVEL</span>:!r?<span className="tag pending">Aguardando execução automática</span>:count===0?<><span className="tag offline">NENHUM INSTRUMENTO VIGENTE ENCONTRADO</span>{r.observacao&&<div className="cnpj" style={{marginTop:6}}>{r.observacao}</div>}</>:<><span className="tag">{count} instrumento(s) vigente(s)</span>{fallback&&<div style={{marginTop:7}}><span className="tag" style={{background:'#fff3cd'}}>🟡 ÚLTIMO VIGENTE — histórico</span></div>}<div className="cnpj" style={{marginTop:6}}>{first?.titulo||'Instrumento coletivo'}{first?.registro&&<> • Registro {first.registro}</>}{first?.vigencia&&<> • Vigência: {first.vigencia}</>}</div>{url&&<div style={{marginTop:8}}><a href={url} target="_blank" rel="noopener noreferrer" className="tag" style={{textDecoration:'none',cursor:'pointer'}}>📄 Abrir documento oficial</a></div>}</>}</div></div>})}</div></section><div className="footer">V4 • Consulta manual real + monitoramento automático diário. Sem dados fictícios.</div></div></main>
}

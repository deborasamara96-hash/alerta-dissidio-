'use client'

import { useState } from 'react'

const pairs = [
['01','93.246.940/0001-46','89.069.835/0001-01','Hospitais e Estabelecimentos de Serviço de Saúde do RS','Trab. em Estabelecimentos de Serviços de Saúde do Vale dos Sinos'],
['02','18.006.733/0001-07','15.635.336/0001-06','Empresas Prest. de Serv. no Segm. de Refrigeração, Aquecimento, Climatização e Vent. RS','Trabalhadores em Refrigeração, Aquecimento e Tratamento de Ar no RS'],
['03','91.100.339/0001-15','96.757.612/0001-00','Comércio Varejista de São Leopoldo','Empregados no Comércio de São Leopoldo'],
['04','89.138.168/0001-71','91.345.231/0001-92','Empresas de Serviços Contábeis, Assessoria, Perícia, Informações e Pesquisa do RS','Empregados de Empresas de Assessoria, Perícias, Informações e Pesquisa – Fundação Est. RS'],
['05','88.368.592/0001-40','97.202.535/0001-87','Indústrias da Construção e do Mobiliário de São Leopoldo','Trabalhadores nas Indústrias da Construção e do Mobiliário de São Sebastião do Caí'],
['06','88.368.592/0001-40','96.757.737/0001-22','Indústrias da Construção e do Mobiliário de São Leopoldo','Trabalhadores nas Indústrias da Construção e do Mobiliário de São Leopoldo'],
['07','89.138.168/0001-71','91.343.194/0001-83','Empresas de Serviços Contábeis, Assessoria, Perícia, Informações e Pesquisa do RS','Sindicato dos Advogados no Estado do Rio Grande do Sul'],
['08','92.962.919/0001-84','92.931.492/0001-57','Hotéis, Restaurantes, Bares e Similares de Porto Alegre','Empregados em Hotéis, Restaurantes, Bares, Similares e Empresas de Alimentação Preparada de SL'],
['09','89.137.574/0001-10','93.074.185/0001-60','Empresas de Compra, Venda, Locação e Administração de Imóveis e Condomínios no RS','Empregados em Empresas de Compra, Venda e Locação/Administração de Imóveis no RS'],
['10','96.755.145/0001-71','96.758.008/0001-90','Indústrias Metalúrgicas, Mecânicas e de Material Elétrico e Eletrônico de SL','Trabalhadores nas Indústrias Metalúrgicas, Mecânicas e de Material Elétrico de São Leopoldo'],
['11','93.712.909/0001-53','93.074.383/0001-23','Empresas de Locação de Bens Móveis do Estado do RS','Empregados de Agentes Autônomos do Comércio no Estado do RS'],
['12','93.712.909/0001-53','96.758.040/0001-76','Empresas de Locação de Bens Móveis do Estado do RS','Trabalhadores em Transportes Rodoviários de São Leopoldo'],
]

export default function Home(){
 const [checking,setChecking]=useState(false)
 const [last,setLast]=useState('Ainda não executada')
 const check=()=>{setChecking(true);setTimeout(()=>{setChecking(false);setLast(new Date().toLocaleString('pt-BR'))},700)}
 return <main className="shell">
  <header className="topbar"><div className="brand"><span className="brandMark">AD</span> Alerta Dissídio</div><span className="sourceBadge">● Mediador / MTE — fonte oficial</span></header>
  <div className="content">
   <section className="hero"><div><div className="eyebrow">Departamento Pessoal</div><h1>Monitoramento de Dissídios</h1><p>12 pares de sindicatos cadastrados para acompanhamento de instrumentos coletivos.</p></div><button className="refresh" onClick={check}>{checking?'Consultando…':'Executar verificação'}</button></section>
   <section className="grid">
    <div className="card"><div className="muted">Pares monitorados</div><div className="metric">12</div></div>
    <div className="card"><div className="muted">Novos instrumentos</div><div className="metric">0</div></div>
    <div className="card"><div className="muted">Aditivos</div><div className="metric">0</div></div>
    <div className="card"><div className="muted">Sem novidade</div><div className="metric">—</div></div>
    <div className="card"><div className="status"><span className="dot warn"/> Fonte</div><div className="metric" style={{fontSize:18}}>Aguardando consulta</div></div>
   </section>
   <div className="notice"><strong>Regra de segurança:</strong> uma consulta que falhar nunca será apresentada como “sem novidade”. O status deverá ser <strong>FONTE INDISPONÍVEL</strong>.</div>
   <section className="section"><div className="sectionTitle"><h2>Sindicatos monitorados</h2><span className="muted">Última ação: {last}</span></div>
    <div className="table"><div className="row head"><div>#</div><div>Entidade patronal</div><div>Entidade laboral</div><div>Fonte</div><div>Situação</div></div>
    {pairs.map(p=><div className="row" key={p[0]}><div className="pair">{p[0]}</div><div><strong>{p[3]}</strong><div className="cnpj">CNPJ {p[1]}</div></div><div><strong>{p[4]}</strong><div className="cnpj">CNPJ {p[2]}</div></div><div><span className="tag">Mediador/MTE</span></div><div><span className="tag pending">Não consultado</span></div></div>)}
    </div>
   </section>
   <div className="footer">V1 inicial • Sem dados fictícios de instrumentos. A integração com o Mediador será liberada somente quando a consulta oficial puder ser executada e validada.</div>
  </div>
 </main>
}

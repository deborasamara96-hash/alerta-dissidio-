'use client'

import { useEffect, useState } from 'react'

type Status = { configured: boolean; recipients: number; provider: string; message: string }

export default function EmailAlerts() {
  const [emails, setEmails] = useState<string[]>([''])
  const [status, setStatus] = useState<Status | null>(null)

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('alerta-dissidio-emails') || '[]')
      if (Array.isArray(saved) && saved.length) setEmails(saved)
    } catch {}
    fetch('/api/email/status?ts=' + Date.now(), { cache: 'no-store' }).then(r => r.json()).then(setStatus).catch(() => {})
  }, [])

  const save = () => {
    const valid = emails.map(v => v.trim().toLowerCase()).filter(v => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v))
    localStorage.setItem('alerta-dissidio-emails', JSON.stringify(valid))
    setEmails(valid.length ? valid : [''])
  }

  const update = (index: number, value: string) => setEmails(current => current.map((item, i) => i === index ? value : item))
  const remove = (index: number) => setEmails(current => current.length === 1 ? [''] : current.filter((_, i) => i !== index))

  return <section className="card" style={{ marginTop: 24 }}>
    <div className="sectionTitle" style={{ marginBottom: 10 }}>
      <h2 style={{ margin: 0 }}>🔔 Alertas por e-mail</h2>
      <span className={`tag ${status?.configured ? '' : 'pending'}`}>{status?.configured ? 'ATIVO' : 'AGUARDANDO CONFIGURAÇÃO'}</span>
    </div>
    <p className="muted" style={{ marginTop: 0 }}>Cadastre mais de um destinatário para receber aviso quando surgir um novo instrumento coletivo vigente.</p>
    {emails.map((email, index) => <div key={index} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
      <input aria-label={`E-mail ${index + 1}`} value={email} onChange={e => update(index, e.target.value)} placeholder="nome@empresa.com.br" style={{ flex: 1, padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 8 }} />
      <button onClick={() => remove(index)} type="button" className="tag" style={{ border: 0, cursor: 'pointer' }}>Remover</button>
    </div>)}
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <button type="button" className="tag" onClick={() => setEmails(current => [...current, ''])}>+ Adicionar e-mail</button>
      <button type="button" className="refresh" onClick={save}>Salvar destinatários</button>
    </div>
    <div className="notice" style={{ marginTop: 12 }}>
      <strong>Envio automático:</strong> {status?.message || 'Verificando configuração…'} O sistema não envia para endereços cadastrados somente no navegador; o disparo automático usa configuração segura do ambiente de produção.
    </div>
  </section>
}

import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Alerta Dissídio',
  description: 'Monitoramento de instrumentos coletivos para Departamento Pessoal',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>
}

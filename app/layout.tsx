import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Dashboard Trader Universal',
  description: 'Plataforma web de gestão operacional e estatística para traders.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR" className="dark">
      <head>
        <script src="https://cdn.tailwindcss.com"></script>
      </head>
      <body className="bg-slate-950 text-slate-100 min-h-screen font-sans">
        {children}
      </body>
    </html>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseAnonKey)

export default function Home() {
  const [dbStatus, setDbStatus] = useState('Verificando conexão...')

  useEffect(() => {
    async function checkConnection() {
      try {
        const { data, error } = await supabase.from('connection_test').select('*').limit(1)
        if (error) {
          setDbStatus('Erro ao conectar: ' + error.message)
        } else if (data) {
          setDbStatus('Conectado com sucesso ao Supabase! 🚀')
        }
      } catch (e) {
        setDbStatus('Erro na tentativa de conexão')
      }
    }
    checkConnection()
  }, [])

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-6">
      <header className="max-w-6xl mx-auto w-full flex justify-between items-center py-4 border-b border-slate-800">
        <h1 className="text-xl font-bold text-emerald-400 flex items-center gap-2">
          📊 TRADER DASHBOARD
        </h1>
        <span className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1 rounded-full font-medium">
          MVP v1.0
        </span>
      </header>

      <main className="max-w-4xl mx-auto w-full my-auto py-12 text-center">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute -right-10 -top-10 w-40 h-40 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>
          
          <h2 className="text-3xl font-extrabold text-white mb-3">
            Dashboard Trader Universal 🚀
          </h2>
          <p className="text-slate-400 max-w-xl mx-auto mb-8 text-sm">
            Sua plataforma universal para diário operational, gestão de risco e análise estatística avançada.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
              <p className="text-xs text-slate-500 uppercase font-semibold mb-1">Status do Banco</p>
              <p className="text-xs font-medium text-emerald-400">{dbStatus}</p>
            </div>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
              <p className="text-xs text-slate-500 uppercase font-semibold mb-1">Hospedagem</p>
              <p className="text-xs font-medium text-blue-400">Vercel Cloud (Online)</p>
            </div>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
              <p className="text-xs text-slate-500 uppercase font-semibold mb-1">Versão</p>
              <p className="text-xs font-medium text-purple-400">1.0.0 MVP</p>
            </div>
          </div>
        </div>
      </main>

      <footer className="max-w-6xl mx-auto w-full text-center text-xs text-slate-600 py-4 border-t border-slate-900">
        Plataforma desenvolvida para gestão de alta performance operacional.
      </footer>
    </div>
  )
}

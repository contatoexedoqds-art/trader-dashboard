'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseAnonKey)

interface Trade {
  id?: string
  asset: string
  direction: string
  entry_price: number
  stop_loss: number
  take_profit: number
  pnl: number
  r_multiple: number
  result_type: string
  notes?: string
  created_at?: string
}

export default function Home() {
  const [session, setSession] = useState<any>(null)
  const [loadingSession, setLoadingSession] = useState(true)

  // Auth States
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [authError, setAuthError] = useState('')

  // Dashboard States
  const [trades, setTrades] = useState<Trade[]>([])
  const [loadingTrades, setLoadingTrades] = useState(false)

  // Form Trades
  const [asset, setAsset] = useState('NASDAQ')
  const [direction, setDirection] = useState('BUY')
  const [entryPrice, setEntryPrice] = useState('')
  const [stopLoss, setStopLoss] = useState('')
  const [takeProfit, setTakeProfit] = useState('')
  const [pnl, setPnl] = useState('')
  const [rMultiple, setRMultiple] = useState('')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoadingSession(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setLoadingSession(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (session) {
      fetchTrades()
    }
  }, [session])

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault()
    setAuthError('')

    if (isSignUp) {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) setAuthError(error.message)
      else alert('Conta criada com sucesso!')
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setAuthError(error.message)
    }
  }

  async function fetchTrades() {
    setLoadingTrades(true)
    const { data, error } = await supabase
      .from('trades')
      .select('*')
      .order('created_at', { ascending: false })

    if (!error && data) {
      setTrades(data)
    }
    setLoadingTrades(false)
  }

  async function handleSubmitTrade(e: React.FormEvent) {
    e.preventDefault()
    if (!session?.user) return

    const pnlVal = parseFloat(pnl) || 0
    const rVal = parseFloat(rMultiple) || 0
    let result = 'BREAKEVEN'
    if (pnlVal > 0) result = 'WIN'
    if (pnlVal < 0) result = 'LOSS'

    // Obter ou criar workspace do usuário autenticado
    let { data: wsData } = await supabase
      .from('workspaces')
      .select('id')
      .eq('user_id', session.user.id)
      .limit(1)

    let wsId = wsData?.[0]?.id

    if (!wsId) {
      const { data: newWs, error: wsError } = await supabase
        .from('workspaces')
        .insert([{ name: 'Workspace Principal', initial_capital: 5000, user_id: session.user.id }])
        .select()

      if (wsError) {
        alert('Erro ao criar workspace: ' + wsError.message)
        return
      }
      wsId = newWs?.[0]?.id
    }

    const newTrade = {
      workspace_id: wsId,
      user_id: session.user.id,
      asset,
      direction,
      entry_price: parseFloat(entryPrice) || 0,
      stop_loss: parseFloat(stopLoss) || 0,
      take_profit: parseFloat(takeProfit) || 0,
      pnl: pnlVal,
      r_multiple: rVal,
      result_type: result,
      notes,
    }

    const { error } = await supabase.from('trades').insert([newTrade])

    if (!error) {
      setEntryPrice('')
      setStopLoss('')
      setTakeProfit('')
      setPnl('')
      setRMultiple('')
      setNotes('')
      fetchTrades()
    } else {
      alert('Erro ao salvar trade: ' + error.message)
    }
  }

  if (loadingSession) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center font-sans">
        <p className="text-sm text-slate-400">Carregando aplicação...</p>
      </div>
    )
  }

  // Tela de Login / Cadastro
  if (!session) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 font-sans">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 max-w-md w-full shadow-2xl space-y-6">
          <div className="text-center space-y-1">
            <h1 className="text-2xl font-bold text-emerald-400 flex items-center justify-center gap-2">
              📊 TRADER DASHBOARD
            </h1>
            <p className="text-xs text-slate-400">
              {isSignUp ? 'Crie sua conta para acessar seu diário' : 'Entre com suas credenciais de acesso'}
            </p>
          </div>

          {authError && (
            <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs p-3 rounded-lg text-center">
              {authError}
            </div>
          )}

          <form onSubmit={handleAuth} className="space-y-4">
            <div>
              <label className="text-xs text-slate-400">E-mail</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 mt-1"
                required
              />
            </div>

            <div>
              <label className="text-xs text-slate-400">Senha</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 mt-1"
                required
              />
            </div>

            <button
              type="submit"
              className="w-full bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold py-2.5 rounded-lg transition text-sm"
            >
              {isSignUp ? 'Criar Conta' : 'Entrar no Dashboard'}
            </button>
          </form>

          <div className="text-center">
            <button
              onClick={() => {
                setIsSignUp(!isSignUp)
                setAuthError('')
              }}
              className="text-xs text-slate-400 hover:text-emerald-400 transition"
            >
              {isSignUp ? 'Já tem uma conta? Faça Login' : 'Não tem conta? Cadastre-se'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Estatísticas Dinâmicas
  const totalTrades = trades.length
  const totalPnl = trades.reduce((acc, t) => acc + (t.pnl || 0), 0)
  const totalWins = trades.filter((t) => t.result_type === 'WIN').length
  const winRate = totalTrades > 0 ? ((totalWins / totalTrades) * 100).toFixed(1) : '0'

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 font-sans">
      {/* Header */}
      <header className="max-w-7xl mx-auto flex justify-between items-center pb-6 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-emerald-400 flex items-center gap-2">
            📊 DASHBOARD TRADER UNIVERSAL
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Usuário: <span className="text-slate-200 font-semibold">{session.user.email}</span>
          </p>
        </div>
        <button
          onClick={() => supabase.auth.signOut()}
          className="text-xs bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 font-semibold px-4 py-2 rounded-lg transition"
        >
          Sair
        </button>
      </header>

      <main className="max-w-7xl mx-auto mt-8 space-y-8">
        {/* Cards Estatísticos */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl">
            <span className="text-xs text-slate-400 font-medium uppercase">Resultado Total</span>
            <p className={`text-2xl font-bold mt-1 ${totalPnl >= 0 ? 'text-emerald-400' : 'text-rose-500'}`}>
              ${totalPnl.toFixed(2)}
            </p>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl">
            <span className="text-xs text-slate-400 font-medium uppercase">Win Rate</span>
            <p className="text-2xl font-bold text-blue-400 mt-1">{winRate}%</p>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl">
            <span className="text-xs text-slate-400 font-medium uppercase">Total de Trades</span>
            <p className="text-2xl font-bold text-slate-100 mt-1">{totalTrades}</p>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl">
            <span className="text-xs text-slate-400 font-medium uppercase">Expectativa R</span>
            <p className="text-2xl font-bold text-purple-400 mt-1">
              {totalTrades > 0 ? (trades.reduce((a, b) => a + (b.r_multiple || 0), 0) / totalTrades).toFixed(2) : '0'}R
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Form de Cadastro */}
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl space-y-4 h-fit">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              ➕ Novo Trade
            </h2>
            <form onSubmit={handleSubmitTrade} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400">Ativo</label>
                  <input
                    type="text"
                    value={asset}
                    onChange={(e) => setAsset(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-sm text-white focus:outline-none focus:border-emerald-500 mt-1"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400">Direção</label>
                  <select
                    value={direction}
                    onChange={(e) => setDirection(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-sm text-white focus:outline-none focus:border-emerald-500 mt-1"
                  >
                    <option value="BUY">BUY (Compra)</option>
                    <option value="SELL">SELL (Venda)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-xs text-slate-400">Entrada</label>
                  <input
                    type="number"
                    step="any"
                    value={entryPrice}
                    onChange={(e) => setEntryPrice(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-sm text-white focus:outline-none focus:border-emerald-500 mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400">Stop Loss</label>
                  <input
                    type="number"
                    step="any"
                    value={stopLoss}
                    onChange={(e) => setStopLoss(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-sm text-white focus:outline-none focus:border-emerald-500 mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400">Take Profit</label>
                  <input
                    type="number"
                    step="any"
                    value={takeProfit}
                    onChange={(e) => setTakeProfit(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-sm text-white focus:outline-none focus:border-emerald-500 mt-1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400">Resultado ($)</label>
                  <input
                    type="number"
                    step="any"
                    value={pnl}
                    onChange={(e) => setPnl(e.target.value)}
                    placeholder="Ex: 150 ou -50"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-sm text-white focus:outline-none focus:border-emerald-500 mt-1"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400">Retorno em R</label>
                  <input
                    type="number"
                    step="any"
                    value={rMultiple}
                    onChange={(e) => setRMultiple(e.target.value)}
                    placeholder="Ex: 3 ou -1"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-sm text-white focus:outline-none focus:border-emerald-500 mt-1"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-400">Notas / Diário</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Gatilho de entrada, contexto psicológico..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-sm text-white focus:outline-none focus:border-emerald-500 mt-1 h-20"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold py-2.5 rounded-lg transition text-sm"
              >
                Salvar Operação
              </button>
            </form>
          </div>

          {/* Tabela de Operações */}
          <div className="lg:col-span-2 bg-slate-900 border border-slate-800 p-6 rounded-xl space-y-4">
            <h2 className="text-lg font-bold text-white flex items-center justify-between">
              <span>📋 Diário de Operações</span>
              <span className="text-xs text-slate-500 font-normal">{trades.length} registrados</span>
            </h2>

            {loadingTrades ? (
              <p className="text-sm text-slate-500 py-8 text-center">Carregando diário...</p>
            ) : trades.length === 0 ? (
              <p className="text-sm text-slate-500 py-8 text-center">
                Nenhum trade registrado ainda. Cadastre sua primeira operação ao lado!
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-300">
                  <thead className="text-xs text-slate-500 uppercase bg-slate-950 border-b border-slate-800">
                    <tr>
                      <th className="p-3">Ativo</th>
                      <th className="p-3">Tipo</th>
                      <th className="p-3">Resultado</th>
                      <th className="p-3">Retorno R</th>
                      <th className="p-3">Notas</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {trades.map((t) => (
                      <tr key={t.id} className="hover:bg-slate-950/50 transition">
                        <td className="p-3 font-semibold text-white">{t.asset}</td>
                        <td className="p-3">
                          <span
                            className={`text-xs px-2 py-0.5 rounded font-bold ${
                              t.direction === 'BUY'
                                ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                                : 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                            }`}
                          >
                            {t.direction}
                          </span>
                        </td>
                        <td className="p-3">
                          <span
                            className={`font-semibold ${
                              t.pnl > 0
                                ? 'text-emerald-400'
                                : t.pnl < 0
                                ? 'text-rose-500'
                                : 'text-slate-400'
                            }`}
                          >
                            ${t.pnl.toFixed(2)}
                          </span>
                        </td>
                        <td className="p-3 font-medium text-slate-300">
                          {t.r_multiple ? `${t.r_multiple}R` : '-'}
                        </td>
                        <td className="p-3 text-xs text-slate-400 max-w-xs truncate">
                          {t.notes || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

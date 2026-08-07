'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  parseISO,
  subMonths,
  addMonths,
  getDay
} from 'date-fns'
import { ptBR } from 'date-fns/locale'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseAnonKey)

interface Workspace {
  id: string
  name: string
  initial_capital: number
}

interface Strategy {
  id: string
  name: string
}

interface Trade {
  id: string
  workspace_id: string
  asset: string
  direction: string
  strategy_name?: string
  entry_price: number
  stop_loss: number
  take_profit: number
  pnl: number
  r_multiple: number
  result_type: string
  chart_url?: string
  notes?: string
  trade_date: string
  created_at?: string
}

export default function Home() {
  const [session, setSession] = useState<any>(null)
  const [loadingSession, setLoadingSession] = useState(true)

  // Auth States
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isSignUp, setIsSignUp] = useState(false)
  const [authError, setAuthError] = useState('')

  // Workspaces States
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>('ALL')
  const [newWorkspaceName, setNewWorkspaceName] = useState('')
  const [showCreateWsModal, setShowCreateWsModal] = useState(false)

  // Strategies States
  const [strategies, setStrategies] = useState<Strategy[]>([])
  const [newStrategyName, setNewStrategyName] = useState('')
  const [showCreateStratModal, setShowCreateStratModal] = useState(false)

  // Dashboard & Trades States
  const [trades, setTrades] = useState<Trade[]>([])
  const [loadingTrades, setLoadingTrades] = useState(false)
  const [editingTradeId, setEditingTradeId] = useState<string | null>(null)

  // Calendar & Date Filters
  const [currentCalendarMonth, setCurrentCalendarMonth] = useState(new Date())
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  // Form Trades
  const [asset, setAsset] = useState('NASDAQ')
  const [direction, setDirection] = useState('BUY')
  const [strategyName, setStrategyName] = useState('')
  const [entryPrice, setEntryPrice] = useState('')
  const [stopLoss, setStopLoss] = useState('')
  const [takeProfit, setTakeProfit] = useState('')
  const [pnl, setPnl] = useState('')
  const [rMultiple, setRMultiple] = useState('')
  const [chartUrl, setChartUrl] = useState('')
  const [tradeDate, setTradeDate] = useState(new Date().toISOString().split('T')[0])
  const [notes, setNotes] = useState('')
  const [targetWorkspaceId, setTargetWorkspaceId] = useState<string>('')

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
      fetchData()
    }
  }, [session])

  async function fetchData() {
    setLoadingTrades(true)

    // 1. Workspaces
    const { data: wsData } = await supabase
      .from('workspaces')
      .select('*')
      .order('created_at', { ascending: true })

    if (wsData) {
      setWorkspaces(wsData)
      if (wsData.length > 0 && !targetWorkspaceId) {
        setTargetWorkspaceId(wsData[0].id)
      }
    }

    // 2. Estratégias
    const { data: stratData } = await supabase
      .from('strategies')
      .select('*')
      .order('name', { ascending: true })

    if (stratData) {
      setStrategies(stratData)
      if (stratData.length > 0 && !strategyName) {
        setStrategyName(stratData[0].name)
      }
    }

    // 3. Trades
    const { data: tradesData } = await supabase
      .from('trades')
      .select('*')
      .order('trade_date', { ascending: false })

    if (tradesData) {
      setTrades(tradesData)
    }
    setLoadingTrades(false)
  }

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

  // --- Gerenciamento de Workspaces ---
  async function handleCreateWorkspace(e: React.FormEvent) {
    e.preventDefault()
    if (!newWorkspaceName.trim() || !session?.user) return

    const { data, error } = await supabase
      .from('workspaces')
      .insert([{ name: newWorkspaceName.trim(), user_id: session.user.id }])
      .select()

    if (!error && data) {
      setWorkspaces([...workspaces, data[0]])
      setSelectedWorkspaceId(data[0].id)
      setTargetWorkspaceId(data[0].id)
      setNewWorkspaceName('')
      setShowCreateWsModal(false)
    } else {
      alert('Erro ao criar workspace: ' + error?.message)
    }
  }

  async function handleDeleteWorkspace() {
    if (selectedWorkspaceId === 'ALL') return
    const currentWs = workspaces.find((w) => w.id === selectedWorkspaceId)
    if (!currentWs) return

    if (
      confirm(
        `Tem certeza que deseja apagar o workspace "${currentWs.name}"? Todas as operações vinculadas a ele serão excluídas permanente.`
      )
    ) {
      const { error } = await supabase.from('workspaces').delete().eq('id', selectedWorkspaceId)

      if (!error) {
        const updatedWs = workspaces.filter((w) => w.id !== selectedWorkspaceId)
        setWorkspaces(updatedWs)
        setTrades(trades.filter((t) => t.workspace_id !== selectedWorkspaceId))
        setSelectedWorkspaceId('ALL')
        if (updatedWs.length > 0) setTargetWorkspaceId(updatedWs[0].id)
      } else {
        alert('Erro ao apagar workspace: ' + error.message)
      }
    }
  }

  // --- Gerenciamento de Estratégias ---
  async function handleCreateStrategy(e: React.FormEvent) {
    e.preventDefault()
    if (!newStrategyName.trim() || !session?.user) return

    const { data, error } = await supabase
      .from('strategies')
      .insert([{ name: newStrategyName.trim(), user_id: session.user.id }])
      .select()

    if (!error && data) {
      setStrategies([...strategies, data[0]])
      setStrategyName(data[0].name)
      setNewStrategyName('')
      setShowCreateStratModal(false)
    } else {
      alert('Erro ao criar estratégia: ' + error?.message)
    }
  }

  // --- Gerenciamento de Trades ---
  async function handleSubmitTrade(e: React.FormEvent) {
    e.preventDefault()
    if (!session?.user) return

    const pnlVal = parseFloat(pnl) || 0
    const rVal = parseFloat(rMultiple) || 0
    let result = 'BREAKEVEN'
    if (pnlVal > 0) result = 'WIN'
    if (pnlVal < 0) result = 'LOSS'

    let activeWsId = targetWorkspaceId
    if (!activeWsId && selectedWorkspaceId !== 'ALL') activeWsId = selectedWorkspaceId
    if (!activeWsId && workspaces.length > 0) activeWsId = workspaces[0].id

    if (!activeWsId) {
      const { data: newWs, error: wsError } = await supabase
        .from('workspaces')
        .insert([{ name: 'Conta Principal', initial_capital: 5000, user_id: session.user.id }])
        .select()

      if (wsError) {
        alert('Erro ao criar workspace: ' + wsError.message)
        return
      }
      activeWsId = newWs[0].id
      setWorkspaces([newWs[0]])
    }

    const tradePayload = {
      workspace_id: activeWsId,
      user_id: session.user.id,
      asset,
      direction,
      strategy_name: strategyName || 'Sem Estratégia',
      entry_price: parseFloat(entryPrice) || 0,
      stop_loss: parseFloat(stopLoss) || 0,
      take_profit: parseFloat(takeProfit) || 0,
      pnl: pnlVal,
      r_multiple: rVal,
      result_type: result,
      chart_url: chartUrl.trim() || null,
      trade_date: tradeDate || new Date().toISOString().split('T')[0],
      notes,
    }

    if (editingTradeId) {
      const { error } = await supabase.from('trades').update(tradePayload).eq('id', editingTradeId)

      if (!error) {
        resetForm()
        fetchData()
      } else {
        alert('Erro ao atualizar trade: ' + error.message)
      }
    } else {
      const { error } = await supabase.from('trades').insert([tradePayload])

      if (!error) {
        resetForm()
        fetchData()
      } else {
        alert('Erro ao salvar trade: ' + error.message)
      }
    }
  }

  function handleEditTrade(trade: Trade) {
    setEditingTradeId(trade.id)
    setAsset(trade.asset)
    setDirection(trade.direction)
    setStrategyName(trade.strategy_name || '')
    setEntryPrice(trade.entry_price.toString())
    setStopLoss(trade.stop_loss.toString())
    setTakeProfit(trade.take_profit.toString())
    setPnl(trade.pnl.toString())
    setRMultiple(trade.r_multiple.toString())
    setChartUrl(trade.chart_url || '')
    setTradeDate(trade.trade_date || new Date().toISOString().split('T')[0])
    setNotes(trade.notes || '')
    setTargetWorkspaceId(trade.workspace_id)
  }

  async function handleDeleteTrade(id: string) {
    if (confirm('Deseja apagar esta operação?')) {
      const { error } = await supabase.from('trades').delete().eq('id', id)

      if (!error) {
        setTrades(trades.filter((t) => t.id !== id))
      } else {
        alert('Erro ao apagar trade: ' + error.message)
      }
    }
  }

  async function handleClearAllTrades() {
    const isAll = selectedWorkspaceId === 'ALL'
    const msg = isAll
      ? 'Tem certeza que deseja apagar TODAS as operações de TODOS os workspaces?'
      : 'Tem certeza que deseja apagar TODAS as operações deste workspace?'

    if (confirm(msg)) {
      let query = supabase.from('trades').delete()
      if (!isAll) {
        query = query.eq('workspace_id', selectedWorkspaceId)
      } else {
        query = query.eq('user_id', session.user.id)
      }

      const { error } = await query

      if (!error) {
        if (isAll) {
          setTrades([])
        } else {
          setTrades(trades.filter((t) => t.workspace_id !== selectedWorkspaceId))
        }
      } else {
        alert('Erro ao limpar operações: ' + error.message)
      }
    }
  }

  function resetForm() {
    setEditingTradeId(null)
    setEntryPrice('')
    setStopLoss('')
    setTakeProfit('')
    setPnl('')
    setRMultiple('')
    setChartUrl('')
    setNotes('')
    setTradeDate(new Date().toISOString().split('T')[0])
  }

  if (loadingSession) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center font-sans">
        <p className="text-sm text-slate-400">Carregando aplicação...</p>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 font-sans">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 max-w-md w-full shadow-2xl space-y-6">
          <div className="text-center space-y-1">
            <h1 className="text-2xl font-bold text-emerald-400 flex items-center justify-center gap-2">
              📊 TRADER DASHBOARD
            </h1>
            <p className="text-xs text-slate-400">
              {isSignUp ? 'Crie sua conta com e-mail' : 'Entre no seu diário de operações'}
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
              <div className="relative mt-1">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 pr-10 text-sm text-white focus:outline-none focus:border-emerald-500"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 text-sm"
                >
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>
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

  // --- Filtragem dos Trades pelo Workspace Selecionado e Período de Data ---
  const filteredTrades = trades.filter((t) => {
    const matchWs = selectedWorkspaceId === 'ALL' || t.workspace_id === selectedWorkspaceId
    let matchDate = true
    if (startDate) {
      matchDate = matchDate && t.trade_date >= startDate
    }
    if (endDate) {
      matchDate = matchDate && t.trade_date <= endDate
    }
    return matchWs && matchDate
  })

  // --- Estatísticas Dinâmicas ---
  const totalTrades = filteredTrades.length
  const totalPnl = filteredTrades.reduce((acc, t) => acc + (t.pnl || 0), 0)
  const totalWins = filteredTrades.filter((t) => t.result_type === 'WIN').length
  const winRate = totalTrades > 0 ? ((totalWins / totalTrades) * 100).toFixed(1) : '0'

  // --- Lógica do Calendário ---
  const monthStart = startOfMonth(currentCalendarMonth)
  const monthEnd = endOfMonth(monthStart)
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd })
  const startDayOfWeek = getDay(monthStart)

  const monthTrades = trades.filter((t) => {
    const matchWs = selectedWorkspaceId === 'ALL' || t.workspace_id === selectedWorkspaceId
    if (!matchWs) return false
    const d = parseISO(t.trade_date)
    return isSameMonth(d, currentCalendarMonth)
  })

  const monthlyPnl = monthTrades.reduce((acc, t) => acc + (t.pnl || 0), 0)

  // --- Análise de Eficiência por Estratégia ---
  const strategyStats = Object.values(
    filteredTrades.reduce((acc: any, trade) => {
      const strat = trade.strategy_name || 'Outros / Sem Categoria'
      if (!acc[strat]) {
        acc[strat] = { name: strat, total: 0, wins: 0, pnl: 0, totalR: 0 }
      }
      acc[strat].total += 1
      if (trade.result_type === 'WIN') acc[strat].wins += 1
      acc[strat].pnl += trade.pnl || 0
      acc[strat].totalR += trade.r_multiple || 0
      return acc
    }, {})
  ).sort((a: any, b: any) => b.pnl - a.pnl)

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 font-sans">
      {/* Header */}
      <header className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between md:items-center gap-4 pb-6 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-emerald-400 flex items-center gap-2">
            📊 DASHBOARD TRADER
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Usuário: <span className="text-slate-200 font-semibold">{session.user.email}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-1">
            <span className="text-xs text-slate-400 px-2 font-medium">Workspace:</span>
            <select
              value={selectedWorkspaceId}
              onChange={(e) => setSelectedWorkspaceId(e.target.value)}
              className="bg-slate-950 text-white text-xs border border-slate-800 rounded-md p-1.5 focus:outline-none focus:border-emerald-500 font-semibold"
            >
              <option value="ALL">🌐 Geral (Estatística Global)</option>
              {workspaces.map((w) => (
                <option key={w.id} value={w.id}>
                  📁 {w.name}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => setShowCreateWsModal(true)}
            className="text-xs bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500/20 text-emerald-400 font-semibold px-3 py-2 rounded-lg transition"
          >
            + Criar Conta
          </button>

          {selectedWorkspaceId !== 'ALL' && (
            <button
              onClick={handleDeleteWorkspace}
              className="text-xs bg-rose-500/10 border border-rose-500/30 hover:bg-rose-500/20 text-rose-400 font-semibold px-3 py-2 rounded-lg transition"
              title="Apagar Workspace Atual"
            >
              🗑️ Apagar Workspace
            </button>
          )}

          <button
            onClick={() => supabase.auth.signOut()}
            className="text-xs bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 font-semibold px-4 py-2 rounded-lg transition ml-auto md:ml-2"
          >
            Sair
          </button>
        </div>
      </header>

      {/* Modal Criar Novo Workspace */}
      {showCreateWsModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-sm w-full space-y-4">
            <h3 className="text-lg font-bold text-white">Criar Novo Sub-Workspace</h3>
            <form onSubmit={handleCreateWorkspace} className="space-y-4">
              <div>
                <label className="text-xs text-slate-400">Nome da Conta / Mesa</label>
                <input
                  type="text"
                  value={newWorkspaceName}
                  onChange={(e) => setNewWorkspaceName(e.target.value)}
                  placeholder="Ex: Mesa FTMO 50k, Conta Pessoal..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 mt-1"
                  required
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateWsModal(false)}
                  className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="text-xs bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold px-4 py-2 rounded-lg"
                >
                  Criar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Criar Nova Estratégia */}
      {showCreateStratModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-sm w-full space-y-4">
            <h3 className="text-lg font-bold text-white">Criar Categoria de Estratégia</h3>
            <form onSubmit={handleCreateStrategy} className="space-y-4">
              <div>
                <label className="text-xs text-slate-400">Nome do Setup / Modelo</label>
                <input
                  type="text"
                  value={newStrategyName}
                  onChange={(e) => setNewStrategyName(e.target.value)}
                  placeholder="Ex: FVG + OB, Liquidity Sweep, Order Flow..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 mt-1"
                  required
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateStratModal(false)}
                  className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="text-xs bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold px-4 py-2 rounded-lg"
                >
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto mt-8 space-y-8">
        {/* Filtro de Período Geral */}
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-white">📅 Filtro de Período:</span>
            <span className="text-xs text-slate-400 hidden sm:inline">
              (Aplica no resumo, gráficos e lista)
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-400">De:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg p-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-400">Até:</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg p-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            {(startDate || endDate) && (
              <button
                onClick={() => {
                  setStartDate('')
                  setEndDate('')
                }}
                className="text-xs text-rose-400 hover:underline px-2 py-1"
              >
                Limpar Filtro
              </button>
            )}
          </div>
        </div>

        {/* Cards Estatísticos Globais */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl">
            <span className="text-xs text-slate-400 font-medium uppercase">Resultado Total</span>
            <p className={`text-2xl font-bold mt-1 ${totalPnl >= 0 ? 'text-emerald-400' : 'text-rose-500'}`}>
              ${totalPnl.toFixed(2)}
            </p>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl">
            <span className="text-xs text-slate-400 font-medium uppercase">Win Rate Global</span>
            <p className="text-2xl font-bold text-blue-400 mt-1">{winRate}%</p>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl">
            <span className="text-xs text-slate-400 font-medium uppercase">Total de Trades</span>
            <p className="text-2xl font-bold text-slate-100 mt-1">{totalTrades}</p>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl">
            <span className="text-xs text-slate-400 font-medium uppercase">Expectativa R</span>
            <p className="text-2xl font-bold text-purple-400 mt-1">
              {totalTrades > 0
                ? (
                    filteredTrades.reduce((a, b) => a + (b.r_multiple || 0), 0) / totalTrades
                  ).toFixed(2)
                : '0'}
              R
            </p>
          </div>
        </div>

        {/* Eficiência por Estratégia */}
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              🎯 Eficiência por Estratégia / Setup
            </h2>
            <button
              onClick={() => setShowCreateStratModal(true)}
              className="text-xs bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500/20 text-emerald-400 font-semibold px-3 py-1.5 rounded-lg transition"
            >
              + Nova Estratégia
            </button>
          </div>

          {strategyStats.length === 0 ? (
            <p className="text-xs text-slate-500 py-4 text-center">
              Nenhuma operação cadastrada no período selecionado.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {strategyStats.map((st: any) => {
                const stratWinRate = ((st.wins / st.total) * 100).toFixed(1)
                return (
                  <div key={st.name} className="bg-slate-950 border border-slate-800/80 p-4 rounded-lg space-y-2">
                    <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                      <span className="font-bold text-slate-100 text-sm">{st.name}</span>
                      <span className="text-xs text-slate-400">{st.total} trades</span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 pt-1 text-center">
                      <div>
                        <span className="text-[10px] text-slate-500 uppercase block">Win Rate</span>
                        <span className="text-sm font-bold text-blue-400">{stratWinRate}%</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 uppercase block">Lucro ($)</span>
                        <span className={`text-sm font-bold ${st.pnl >= 0 ? 'text-emerald-400' : 'text-rose-500'}`}>
                          ${st.pnl.toFixed(2)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 uppercase block">Retorno R</span>
                        <span className="text-sm font-bold text-purple-400">{st.totalR.toFixed(1)}R</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Formulário e Tabela de Operações */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Form de Cadastro / Edição */}
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl space-y-4 h-fit">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                {editingTradeId ? '✏️ Editar Trade' : '➕ Novo Trade'}
              </h2>
              {editingTradeId && (
                <button
                  onClick={resetForm}
                  className="text-xs text-slate-400 hover:text-rose-400 transition"
                >
                  Cancelar
                </button>
              )}
            </div>

            <form onSubmit={handleSubmitTrade} className="space-y-4">
              <div>
                <label className="text-xs text-slate-400">Data da Operação</label>
                <input
                  type="date"
                  value={tradeDate}
                  onChange={(e) => setTradeDate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-sm text-white focus:outline-none focus:border-emerald-500 mt-1"
                  required
                />
              </div>

              <div>
                <label className="text-xs text-slate-400">Destinar à Conta / Workspace</label>
                <select
                  value={targetWorkspaceId}
                  onChange={(e) => setTargetWorkspaceId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-sm text-white focus:outline-none focus:border-emerald-500 mt-1"
                >
                  {workspaces.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex justify-between items-center">
                  <label className="text-xs text-slate-400">Estratégia / Setup</label>
                  <button
                    type="button"
                    onClick={() => setShowCreateStratModal(true)}
                    className="text-[11px] text-emerald-400 hover:underline"
                  >
                    + Adicionar
                  </button>
                </div>
                <select
                  value={strategyName}
                  onChange={(e) => setStrategyName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-sm text-white focus:outline-none focus:border-emerald-500 mt-1"
                >
                  <option value="Sem Estratégia">Sem Estratégia Especificada</option>
                  {strategies.map((s) => (
                    <option key={s.id} value={s.name}>
                      🎯 {s.name}
                    </option>
                  ))}
                </select>
              </div>

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
                <label className="text-xs text-slate-400">URL do Print / TradingView</label>
                <input
                  type="url"
                  value={chartUrl}
                  onChange={(e) => setChartUrl(e.target.value)}
                  placeholder="https://www.tradingview.com/x/..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-sm text-white focus:outline-none focus:border-emerald-500 mt-1"
                />
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
                {editingTradeId ? 'Atualizar Operação' : 'Salvar Operação'}
              </button>
            </form>
          </div>

          {/* Tabela de Operações */}
          <div className="lg:col-span-2 bg-slate-900 border border-slate-800 p-6 rounded-xl space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <span>📋 Diário de Operações</span>
                <span className="text-xs text-slate-500 font-normal">
                  ({filteredTrades.length} registrados)
                </span>
              </h2>

              {filteredTrades.length > 0 && (
                <button
                  onClick={handleClearAllTrades}
                  className="text-xs bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-500/20 px-3 py-1.5 rounded-lg transition"
                >
                  🧹 Limpar Operações
                </button>
              )}
            </div>

            {loadingTrades ? (
              <p className="text-sm text-slate-500 py-8 text-center">Carregando diário...</p>
            ) : filteredTrades.length === 0 ? (
              <p className="text-sm text-slate-500 py-8 text-center">
                Nenhuma operação encontrada para o workspace ou período selecionado.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-300">
                  <thead className="text-xs text-slate-500 uppercase bg-slate-950 border-b border-slate-800">
                    <tr>
                      <th className="p-3">Data</th>
                      <th className="p-3">Ativo</th>
                      <th className="p-3">Estratégia</th>
                      <th className="p-3">Tipo</th>
                      <th className="p-3">Resultado</th>
                      <th className="p-3">Retorno R</th>
                      <th className="p-3">Gráfico</th>
                      <th className="p-3">Notas</th>
                      <th className="p-3 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {filteredTrades.map((t) => (
                      <tr key={t.id} className="hover:bg-slate-950/50 transition">
                        <td className="p-3 text-xs text-slate-400 font-medium">
                          {t.trade_date ? format(parseISO(t.trade_date), 'dd/MM/yyyy') : '-'}
                        </td>
                        <td className="p-3 font-semibold text-white">{t.asset}</td>
                        <td className="p-3">
                          <span className="text-xs bg-slate-800 text-emerald-400 px-2 py-0.5 rounded font-medium">
                            {t.strategy_name || 'Sem Estratégia'}
                          </span>
                        </td>
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
                        <td className="p-3">
                          {t.chart_url ? (
                            <a
                              href={t.chart_url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-emerald-400 hover:underline bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded"
                            >
                              🖼️ Ver Print
                            </a>
                          ) : (
                            <span className="text-xs text-slate-600">-</span>
                          )}
                        </td>
                        <td className="p-3 text-xs text-slate-400 max-w-xs truncate">
                          {t.notes || '-'}
                        </td>
                        <td className="p-3 text-right space-x-2">
                          <button
                            onClick={() => handleEditTrade(t)}
                            className="text-xs text-slate-400 hover:text-emerald-400 transition"
                            title="Editar"
                          >
                            ✏️
                          </button>
                          <button
                            onClick={() => handleDeleteTrade(t.id)}
                            className="text-xs text-slate-400 hover:text-rose-400 transition"
                            title="Apagar"
                          >
                            🗑️
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* CALENDÁRIO ESTILO TRADER LEZELLA (Posicionado no Final) */}
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                📆 Calendário de Desempenho
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Visão mensal estilo Trader Lezella com diário de lucros e operações por dia.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <span className={`text-sm font-bold ${monthlyPnl >= 0 ? 'text-emerald-400' : 'text-rose-500'}`}>
                Mês: ${monthlyPnl.toFixed(2)}
              </span>

              <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 rounded-lg p-1">
                <button
                  onClick={() => setCurrentCalendarMonth(subMonths(currentCalendarMonth, 1))}
                  className="px-2 py-1 text-xs text-slate-300 hover:bg-slate-800 rounded transition"
                >
                  ◀
                </button>
                <span className="text-xs font-bold text-slate-200 px-2 capitalize">
                  {format(currentCalendarMonth, 'MMMM yyyy', { locale: ptBR })}
                </span>
                <button
                  onClick={() => setCurrentCalendarMonth(addMonths(currentCalendarMonth, 1))}
                  className="px-2 py-1 text-xs text-slate-300 hover:bg-slate-800 rounded transition"
                >
                  ▶
                </button>
              </div>
            </div>
          </div>

          {/* Grid do Calendário */}
          <div className="grid grid-cols-7 gap-1 md:gap-2">
            {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((day) => (
              <div key={day} className="text-center text-xs font-bold text-slate-500 py-1 uppercase">
                {day}
              </div>
            ))}

            {/* Células vazias para alinhar o primeiro dia do mês */}
            {Array.from({ length: startDayOfWeek }).map((_, index) => (
              <div key={`empty-${index}`} className="min-h-[70px] md:min-h-[85px] bg-slate-950/30 rounded-lg border border-slate-900" />
            ))}

            {/* Dias do Mês */}
            {daysInMonth.map((day) => {
              const formattedDate = format(day, 'yyyy-MM-dd')
              const dayTrades = monthTrades.filter((t) => t.trade_date === formattedDate)
              const dayPnl = dayTrades.reduce((acc, t) => acc + (t.pnl || 0), 0)
              const hasTrades = dayTrades.length > 0

              return (
                <div
                  key={formattedDate}
                  className={`min-h-[70px] md:min-h-[85px] p-2 rounded-lg border flex flex-col justify-between transition relative ${
                    hasTrades
                      ? dayPnl > 0
                        ? 'bg-emerald-950/20 border-emerald-500/30'
                        : dayPnl < 0
                        ? 'bg-rose-950/20 border-rose-500/30'
                        : 'bg-slate-900 border-slate-800'
                      : 'bg-slate-950/60 border-slate-800/50 text-slate-600'
                  }`}
                >
                  <span className="text-xs font-bold text-slate-400">{format(day, 'd')}</span>

                  {hasTrades && (
                    <div className="mt-1">
                      <span
                        className={`text-xs md:text-sm font-bold block ${
                          dayPnl > 0
                            ? 'text-emerald-400'
                            : dayPnl < 0
                            ? 'text-rose-500'
                            : 'text-slate-400'
                        }`}
                      >
                        ${dayPnl.toFixed(2)}
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium block">
                        {dayTrades.length} trade{dayTrades.length > 1 ? 's' : ''}
                      </span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </main>
    </div>
  )
}

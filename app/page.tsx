'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  addMonths,
  subMonths,
  getDay,
  parseISO
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

  // Navegação de Abas ("dashboard" ou "montecarlo")
  const [activeTab, setActiveTab] = useState<'dashboard' | 'montecarlo'>('dashboard')

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

  // Pagination State for History
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 8

  // Calendar & Date Filters
  const [currentCalendarMonth, setCurrentCalendarMonth] = useState(new Date())
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [calendarFilterDate, setCalendarFilterDate] = useState('')

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

  // --- Estados do Painel de Simulação de Monte Carlo estilo FTMO ---
  const [mcCapital, setMcCapital] = useState('50000') 
  const [mcWinRate, setMcWinRate] = useState('50') 
  const [mcRrr, setMcRrr] = useState('1.00') 
  const [mcIterations, setMcIterations] = useState('100') 
  const [mcLines, setMcLines] = useState('10') 
  const [mcRiskMode, setMcRiskMode] = useState<'percent' | 'risk'>('percent')
  const [mcRiskPercent, setMcRiskPercent] = useState('1.00')
  const [mcResults, setMcResults] = useState<any | null>(null)

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

    const { data: tradesData } = await supabase
      .from('trades')
      .select('*')
      .order('trade_date', { ascending: false })

    if (tradesData) {
      setTrades(tradesData)
    }
    setLoadingTrades(false)
  }

  function handleExportBackup() {
    const backupData = {
      exportDate: new Date().toISOString(),
      workspaces,
      strategies,
      trades
    }

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupData, null, 2))
    const downloadAnchor = document.createElement('a')
    downloadAnchor.setAttribute("href", dataStr)
    downloadAnchor.setAttribute("download", `trader_backup_${format(new Date(), 'yyyy-MM-dd')}.json`)
    document.body.appendChild(downloadAnchor)
    downloadAnchor.click()
    downloadAnchor.remove()
  }

  async function handleImportBackup(e: React.ChangeEvent<HTMLInputElement>) {
    const fileReader = new FileReader()
    if (e.target.files && e.target.files[0]) {
      fileReader.readAsText(e.target.files[0], "UTF-8")
      fileReader.onload = async (event) => {
        try {
          const parsedData = JSON.parse(event.target?.result as string)
          if (!parsedData.trades || !parsedData.workspaces) {
            alert('Arquivo de backup inválido!')
            return
          }

          if (confirm(`Deseja restaurar o backup? Isso irá inserir ${parsedData.trades.length} operações e ${parsedData.workspaces.length} workspaces na sua conta atual.`)) {
            setLoadingTrades(true)

            for (const ws of parsedData.workspaces) {
              await supabase.from('workspaces').upsert({
                id: ws.id,
                name: ws.name,
                initial_capital: ws.initial_capital,
                user_id: session.user.id
              })
            }

            if (parsedData.strategies) {
              for (const st of parsedData.strategies) {
                await supabase.from('strategies').upsert({
                  id: st.id,
                  name: st.name,
                  user_id: session.user.id
                })
              }
            }

            for (const t of parsedData.trades) {
              await supabase.from('trades').upsert({
                id: t.id,
                workspace_id: t.workspace_id,
                user_id: session.user.id,
                asset: t.asset,
                direction: t.direction,
                strategy_name: t.strategy_name,
                entry_price: t.entry_price,
                stop_loss: t.stop_loss,
                take_profit: t.take_profit,
                pnl: t.pnl,
                r_multiple: t.r_multiple,
                result_type: t.result_type,
                chart_url: t.chart_url,
                notes: t.notes,
                trade_date: t.trade_date
              })
            }

            await fetchData()
            alert('Backup restaurado com sucesso!')
          }
        } catch (error: any) {
          alert('Erro ao ler arquivo de backup: ' + error.message)
        } finally {
          setLoadingTrades(false)
          e.target.value = ''
        }
      }
    }
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
        `Tem certeza que deseja apagar o workspace "${currentWs.name}"? Todas as operações vinculadas a ele serão excluídas permanentemente.`
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
    
    window.scrollTo({ top: 0, behavior: 'smooth' })
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

  // --- Função para Rodar a Simulação de Monte Carlo Estilo FTMO ---
  function runMonteCarloSimulation(e?: React.FormEvent) {
    if (e) e.preventDefault()

    const initialCap = parseFloat(mcCapital) || 50000
    const winRate = parseFloat(mcWinRate) || 50
    const rrr = parseFloat(mcRrr) || 1.0
    const iterations = parseInt(mcIterations) || 100
    const pathsCount = parseInt(mcLines) || 10
    const riskPct = parseFloat(mcRiskPercent) || 1.0

    const colorPalette = [
      '#eab308', // amarelo
      '#a855f7', // roxo
      '#22c55e', // verde
      '#3b82f6', // azul
      '#ec4899', // rosa
      '#f97316', // laranja
      '#06b6d4', // ciano
      '#84cc16', // lima
      '#6366f1', // indigo
      '#ef4444'  // vermelho
    ]

    const paths: { step: number; equity: number; isWin: boolean; drawdown: number }[][] = []
    let allEquitiesFlat: number[] = []
    let maxDrawdowns: number[] = []

    let maxWinStreakGlobal = 0
    let maxLossStreakGlobal = 0

    // Para calcular a média por passo (iteracao)
    const stepSumEquities = new Array(iterations + 1).fill(0)

    for (let p = 0; p < pathsCount; p++) {
      let currentCap = initialCap
      let pathDetails: { step: number; equity: number; isWin: boolean; drawdown: number }[] = [
        { step: 0, equity: currentCap, isWin: true, drawdown: 0 }
      ]
      stepSumEquities[0] += currentCap

      let peak = currentCap
      let curWinStreak = 0
      let curLossStreak = 0
      let pathMaxDd = 0

      for (let i = 1; i <= iterations; i++) {
        const isWin = Math.random() * 100 < winRate
        const riskAmount = currentCap * (riskPct / 100)
        let tradePnl = 0

        if (isWin) {
          tradePnl = riskAmount * rrr
          currentCap += tradePnl
          curWinStreak++
          curLossStreak = 0
          if (curWinStreak > maxWinStreakGlobal) maxWinStreakGlobal = curWinStreak
        } else {
          tradePnl = -riskAmount
          currentCap -= riskAmount
          curLossStreak++
          curWinStreak = 0
          if (curLossStreak > maxLossStreakGlobal) maxLossStreakGlobal = curLossStreak
        }

        if (currentCap < 0) currentCap = 0

        if (currentCap > peak) {
          peak = currentCap
        }
        const dd = peak > 0 ? ((peak - currentCap) / peak) * 100 : 0
        if (dd > pathMaxDd) {
          pathMaxDd = dd
        }

        allEquitiesFlat.push(currentCap)
        stepSumEquities[i] += currentCap

        pathDetails.push({
          step: i,
          equity: currentCap,
          isWin,
          drawdown: pathMaxDd
        })
      }

      paths.push(pathDetails)
      maxDrawdowns.push(pathMaxDd)
    }

    // Calcular a curva média
    const averagePath = stepSumEquities.map((sumVal, idx) => ({
      step: idx,
      equity: sumVal / pathsCount
    }))

    const minEquity = Math.min(...allEquitiesFlat, initialCap)
    const maxEquity = Math.max(...allEquitiesFlat, initialCap)
    const avgMaxDD = maxDrawdowns.reduce((a, b) => a + b, 0) / pathsCount
    const maxOfMaxDD = Math.max(...maxDrawdowns)

    setMcResults({
      minEquity,
      maxEquity,
      maxDrawdown: maxOfMaxDD,
      avgDrawdown: avgMaxDD,
      maxWinStreak: maxWinStreakGlobal,
      maxLossStreak: maxLossStreakGlobal,
      paths,
      averagePath,
      initialCap,
      iterations,
      pathsCount,
      colorPalette
    })
  }

  // Executar simulação padrão ao carregar a aba de monte carlo pela primeira vez se vazio
  useEffect(() => {
    if (activeTab === 'montecarlo' && !mcResults) {
      runMonteCarloSimulation()
    }
  }, [activeTab])

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

  // --- Filtragem dos Trades ---
  const filteredTrades = trades.filter((t) => {
    const matchWs = selectedWorkspaceId === 'ALL' || t.workspace_id === selectedWorkspaceId
    let matchDate = true
    
    if (calendarFilterDate) {
      matchDate = t.trade_date === calendarFilterDate
    } else {
      if (startDate) matchDate = matchDate && t.trade_date >= startDate
      if (endDate) matchDate = matchDate && t.trade_date <= endDate
    }
    
    return matchWs && matchDate
  })

  // Paginação do Histórico
  const totalPages = Math.ceil(filteredTrades.length / itemsPerPage) || 1
  const paginatedTrades = filteredTrades.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )

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
  ).sort((a: any, b: any) => b.pnl - a.pnl);

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
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`text-xs px-3 py-1.5 rounded transition font-semibold ${activeTab === 'dashboard' ? 'bg-emerald-500 text-slate-950' : 'text-slate-300 hover:bg-slate-800'}`}
            >
              📈 Dashboard
            </button>
            <button
              onClick={() => setActiveTab('montecarlo')}
              className={`text-xs px-3 py-1.5 rounded transition font-semibold ${activeTab === 'montecarlo' ? 'bg-emerald-500 text-slate-950' : 'text-slate-300 hover:bg-slate-800'}`}
            >
              📊 Teste de Monte Carlo
            </button>
          </div>

          <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg p-1">
            <button
              onClick={handleExportBackup}
              className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded transition font-medium"
              title="Salvar dados em arquivo JSON no computador"
            >
              💾 Salvar Backup
            </button>
            <label className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded transition font-medium cursor-pointer" title="Restaurar dados de um arquivo JSON">
              📂 Restaurar
              <input type="file" accept=".json" onChange={handleImportBackup} className="hidden" />
            </label>
          </div>

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

      {/* RENDERIZAÇÃO CONDICIONAL DA ABA: DASHBOARD OU MONTE CARLO */}
      {activeTab === 'montecarlo' ? (
        <main className="max-w-7xl mx-auto mt-8 space-y-8">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl space-y-6">
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                🎲 Simulador de Monte Carlo (Estilo FTMO)
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Simule múltiplas trajetórias de equidade com base no capital, assertividade e taxa de risco configurados.
              </p>
            </div>

            <form onSubmit={runMonteCarloSimulation} className="space-y-6 bg-slate-950 p-6 rounded-xl border border-slate-800/80">
              
              {/* Linha 1 de Inputs */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex flex-col justify-between">
                  <div className="flex justify-between items-center text-xs text-slate-400 mb-1">
                    <span>Capital</span>
                  </div>
                  <div className="flex items-center justify-between bg-slate-950 border border-slate-800 rounded-lg px-3 py-2">
                    <button type="button" onClick={() => setMcCapital(Math.max(1000, (parseFloat(mcCapital) || 50000) - 5000).toString())} className="text-emerald-400 hover:text-emerald-300 font-bold px-1 text-sm">◀</button>
                    <input
                      type="number"
                      step="any"
                      value={mcCapital}
                      onChange={(e) => setMcCapital(e.target.value)}
                      className="w-28 bg-transparent text-center font-bold text-emerald-400 text-sm focus:outline-none"
                      required
                    />
                    <button type="button" onClick={() => setMcCapital(((parseFloat(mcCapital) || 50000) + 5000).toString())} className="text-emerald-400 hover:text-emerald-300 font-bold px-1 text-sm">▶</button>
                  </div>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex flex-col justify-between">
                  <div className="flex justify-between items-center text-xs text-slate-400 mb-1">
                    <span>Rácio de ganhos</span>
                  </div>
                  <div className="flex items-center justify-between bg-slate-950 border border-slate-800 rounded-lg px-3 py-2">
                    <button type="button" onClick={() => setMcWinRate(Math.max(1, (parseFloat(mcWinRate) || 50) - 5).toString())} className="text-emerald-400 hover:text-emerald-300 font-bold px-1 text-sm">◀</button>
                    <input
                      type="number"
                      step="any"
                      value={mcWinRate}
                      onChange={(e) => setMcWinRate(e.target.value)}
                      className="w-24 bg-transparent text-center font-bold text-emerald-400 text-sm focus:outline-none"
                      required
                    />
                    <button type="button" onClick={() => setMcWinRate(Math.min(99, (parseFloat(mcWinRate) || 50) + 5).toString())} className="text-emerald-400 hover:text-emerald-300 font-bold px-1 text-sm">▶</button>
                  </div>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex flex-col justify-between">
                  <div className="flex justify-between items-center text-xs text-slate-400 mb-1">
                    <span>RRR (Risco/Retorno)</span>
                  </div>
                  <div className="flex items-center justify-between bg-slate-950 border border-slate-800 rounded-lg px-3 py-2">
                    <button type="button" onClick={() => setMcRrr(Math.max(0.1, (parseFloat(mcRrr) || 1.0) - 0.1).toFixed(2))} className="text-emerald-400 hover:text-emerald-300 font-bold px-1 text-sm">◀</button>
                    <input
                      type="number"
                      step="any"
                      value={mcRrr}
                      onChange={(e) => setMcRrr(e.target.value)}
                      className="w-24 bg-transparent text-center font-bold text-emerald-400 text-sm focus:outline-none"
                      required
                    />
                    <button type="button" onClick={() => setMcRrr(((parseFloat(mcRrr) || 1.0) + 0.1).toFixed(2))} className="text-emerald-400 hover:text-emerald-300 font-bold px-1 text-sm">▶</button>
                  </div>
                </div>
              </div>

              {/* Linha 2 de Inputs */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex flex-col justify-between">
                  <div className="flex justify-between items-center text-xs text-slate-400 mb-1">
                    <span>Iterações</span>
                  </div>
                  <div className="flex items-center justify-between bg-slate-950 border border-slate-800 rounded-lg px-3 py-2">
                    <button type="button" onClick={() => setMcIterations(Math.max(10, (parseInt(mcIterations) || 100) - 10).toString())} className="text-emerald-400 hover:text-emerald-300 font-bold px-1 text-sm">◀</button>
                    <input
                      type="number"
                      value={mcIterations}
                      onChange={(e) => setMcIterations(e.target.value)}
                      className="w-24 bg-transparent text-center font-bold text-emerald-400 text-sm focus:outline-none"
                      required
                    />
                    <button type="button" onClick={() => setMcIterations(((parseInt(mcIterations) || 100) + 10).toString())} className="text-emerald-400 hover:text-emerald-300 font-bold px-1 text-sm">▶</button>
                  </div>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex flex-col justify-between">
                  <div className="flex justify-between items-center text-xs text-slate-400 mb-1">
                    <span>Linhas (Caminhos)</span>
                  </div>
                  <div className="flex items-center justify-between bg-slate-950 border border-slate-800 rounded-lg px-3 py-2">
                    <button type="button" onClick={() => setMcLines(Math.max(1, (parseInt(mcLines) || 10) - 1).toString())} className="text-emerald-400 hover:text-emerald-300 font-bold px-1 text-sm">◀</button>
                    <input
                      type="number"
                      value={mcLines}
                      onChange={(e) => setMcLines(e.target.value)}
                      className="w-24 bg-transparent text-center font-bold text-emerald-400 text-sm focus:outline-none"
                      required
                    />
                    <button type="button" onClick={() => setMcLines(((parseInt(mcLines) || 10) + 1).toString())} className="text-emerald-400 hover:text-emerald-300 font-bold px-1 text-sm">▶</button>
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-800 pt-4">
                <span className="text-xs text-slate-400 block mb-2">Tipo de Risco</span>
                <div className="grid grid-cols-2 gap-4 max-w-lg">
                  <button
                    type="button"
                    onClick={() => setMcRiskMode('percent')}
                    className={`py-3 px-4 rounded-xl font-bold text-xs transition border ${
                      mcRiskMode === 'percent'
                        ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-lg shadow-emerald-500/20'
                        : 'bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800'
                    }`}
                  >
                    Percentagem de Risco
                  </button>
                  <button
                    type="button"
                    onClick={() => setMcRiskMode('risk')}
                    className={`py-3 px-4 rounded-xl font-bold text-xs transition border ${
                      mcRiskMode === 'risk'
                        ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-lg'
                        : 'bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800'
                    }`}
                  >
                    Risco
                  </button>
                </div>
              </div>

              <div>
                <span className="text-xs text-slate-400 block mb-1">Percentagem</span>
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 max-w-xs flex items-center justify-between">
                  <button type="button" onClick={() => setMcRiskPercent(Math.max(0.1, (parseFloat(mcRiskPercent) || 1.0) - 0.25).toFixed(2))} className="text-emerald-400 hover:text-emerald-300 font-bold px-2">◀</button>
                  <input
                    type="number"
                    step="any"
                    value={mcRiskPercent}
                    onChange={(e) => setMcRiskPercent(e.target.value)}
                    className="w-24 bg-transparent text-center font-bold text-emerald-400 text-sm focus:outline-none"
                    required
                  />
                  <span className="text-emerald-400 font-bold">%</span>
                  <button type="button" onClick={() => setMcRiskPercent(((parseFloat(mcRiskPercent) || 1.0) + 0.25).toFixed(2))} className="text-emerald-400 hover:text-emerald-300 font-bold px-2">▶</button>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3.5 px-6 rounded-xl transition text-sm shadow-xl shadow-blue-600/20"
                >
                  Executar
                </button>
              </div>
            </form>

            {mcResults && (
              <div className="space-y-6 pt-6 border-t border-slate-800">
                {/* GRÁFICO DE LINHAS ESTILO FTMO */}
                <div className="bg-slate-950 border border-slate-800 p-6 rounded-xl space-y-4 shadow-2xl">
                  <div className="flex justify-end gap-2 text-slate-400 text-xs">
                    <button type="button" onClick={() => runMonteCarloSimulation()} className="p-1 hover:text-white" title="Atualizar / Recalcular">🔄</button>
                  </div>

                  <div className="relative h-96 bg-slate-900 border border-slate-800 rounded-lg p-4 flex items-end">
                    {/* Grade de fundo horizontal */}
                    <div className="absolute inset-0 flex flex-col justify-between pointer-events-none p-4">
                      {[0, 1, 2, 3, 4].map((i) => {
                        const val = mcResults.minEquity + ((mcResults.maxEquity - mcResults.minEquity) / 4) * (4 - i)
                        return (
                          <div key={i} className="border-b border-slate-800/80 w-full flex justify-between items-center text-[10px] text-slate-500">
                            <span>{val.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</span>
                          </div>
                        )
                      })}
                    </div>

                    {/* SVG para renderizar as linhas de equidade */}
                    <svg className="absolute inset-4 w-[calc(100%-2rem)] h-[calc(100%-2rem)]">
                      {(() => {
                        const minEq = mcResults.minEquity
                        const maxEq = mcResults.maxEquity === minEq ? minEq + 1000 : mcResults.maxEquity
                        const spanEq = maxEq - minEq

                        return (
                          <>
                            {/* Caminhos individuais simulados */}
                            {mcResults.paths.map((path: any[], pIdx: number) => {
                              const pointsStr = path.map((pt, i) => {
                                const x = (i / mcResults.iterations) * 100
                                const y = 100 - ((pt.equity - minEq) / spanEq) * 100
                                return `${x}%,${y}%`
                              }).join(' ')

                              const color = mcResults.colorPalette[pIdx % mcResults.colorPalette.length]

                              return (
                                <polyline
                                  key={pIdx}
                                  fill="none"
                                  stroke={color}
                                  strokeWidth="1.5"
                                  strokeOpacity="0.85"
                                  points={pointsStr}
                                />
                              )
                            })}

                            {/* Linha preta grossa da média */}
                            {mcResults.averagePath && (
                              <polyline
                                fill="none"
                                stroke="#000000"
                                strokeWidth="3"
                                points={mcResults.averagePath.map((pt: any, i: number) => {
                                  const x = (i / mcResults.iterations) * 100
                                  const y = 100 - ((pt.equity - minEq) / spanEq) * 100
                                  return `${x}%,${y}%`
                                }).join(' ')}
                              />
                            )}
                            {mcResults.averagePath && (
                              <polyline
                                fill="none"
                                stroke="#ffffff"
                                strokeWidth="1.5"
                                strokeDasharray="3,3"
                                points={mcResults.averagePath.map((pt: any, i: number) => {
                                  const x = (i / mcResults.iterations) * 100
                                  const y = 100 - ((pt.equity - minEq) / spanEq) * 100
                                  return `${x}%,${y}%`
                                }).join(' ')}
                              />
                            )}
                          </>
                        )
                      })()}
                    </svg>
                  </div>

                  <div className="flex justify-between text-[11px] text-slate-400 px-1">
                    <span>0</span>
                    <span>Número de trades</span>
                    <span>{mcResults.iterations}</span>
                  </div>

                  <div className="text-center text-xs text-slate-300 font-medium pt-2">
                    A linha pontilhada/preta reflete a média do resultado das outras curvas
                  </div>
                </div>

                {/* TABELA DE ESTATÍSTICAS ESTILO FTMO */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl">
                  <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-800 text-sm">
                    {/* Coluna Esquerda */}
                    <div className="divide-y divide-slate-800">
                      <div className="flex justify-between items-center p-4 hover:bg-slate-800/30 transition">
                        <span className="text-slate-300">Equidade mínima</span>
                        <span className="font-bold text-white">{mcResults.minEquity.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex justify-between items-center p-4 hover:bg-slate-800/30 transition">
                        <span className="text-slate-300">Equidade máxima</span>
                        <span className="font-bold text-white">{mcResults.maxEquity.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex justify-between items-center p-4 hover:bg-slate-800/30 transition">
                        <span className="text-slate-300">Máximo de ganhos consecutivos</span>
                        <span className="font-bold text-emerald-400">{mcResults.maxWinStreak}</span>
                      </div>
                      <div className="flex justify-between items-center p-4 hover:bg-slate-800/30 transition">
                        <span className="text-slate-300">Máximo de perdas consecutivas</span>
                        <span className="font-bold text-rose-500">{mcResults.maxLossStreak}</span>
                      </div>
                    </div>

                    {/* Coluna Direita */}
                    <div className="divide-y divide-slate-800">
                      <div className="flex justify-between items-center p-4 hover:bg-slate-800/30 transition">
                        <span className="text-slate-300">Drawdown Máximo</span>
                        <span className="font-bold text-amber-400">{mcResults.maxDrawdown.toFixed(2)}%</span>
                      </div>
                      <div className="flex justify-between items-center p-4 hover:bg-slate-800/30 transition">
                        <span className="text-slate-300">Média de drawdown</span>
                        <span className="font-bold text-amber-400/80">{mcResults.avgDrawdown.toFixed(2)}%</span>
                      </div>
                      <div className="flex justify-between items-center p-4 hover:bg-slate-800/30 transition">
                        <span className="text-slate-300">Média máxima de drawdown</span>
                        <span className="font-bold text-amber-400">{(mcResults.maxDrawdown * 0.85).toFixed(2)}%</span>
                      </div>
                      <div className="flex justify-between items-center p-4 opacity-0 pointer-events-none md:opacity-100">
                        <span className="text-slate-500">-</span>
                        <span className="text-slate-500">-</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      ) : (
        <main className="max-w-7xl mx-auto mt-8 space-y-8">
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
                onChange={(e) => {
                  setStartDate(e.target.value)
                  setCalendarFilterDate('')
                }}
                className="bg-slate-950 border border-slate-800 rounded-lg p-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-400">Até:</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value)
                  setCalendarFilterDate('')
                }}
                className="bg-slate-950 border border-slate-800 rounded-lg p-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            {(startDate || endDate || calendarFilterDate) && (
              <button
                onClick={() => {
                  setStartDate('')
                  setEndDate('')
                  setCalendarFilterDate('')
                }}
                className="text-xs text-rose-400 hover:underline px-2 py-1"
              >
                Limpar Filtro
              </button>
            )}
          </div>
        </div>

        {calendarFilterDate && (
          <div className="bg-emerald-950/40 border border-emerald-500/30 p-3 rounded-xl text-xs text-emerald-400 flex justify-between items-center">
            <span>🔍 Filtrando apenas o dia: <strong className="text-white">{format(parseISO(calendarFilterDate), 'dd/MM/yyyy')}</strong> (selecionado no calendário)</span>
            <button onClick={() => setCalendarFilterDate('')} className="underline hover:text-emerald-300 font-bold">
              Remover Filtro de Dia
            </button>
          </div>
        )}

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
                : '0.00'}
              R
            </p>
          </div>
        </div>

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
                        <span className="text-[10px] text-slate-500 uppercase block">Total (R)</span>
                        <span className="text-sm font-bold text-purple-400">
                          {st.totalR.toFixed(2)}R
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div id="historico-container" className="grid grid-cols-1 xl:grid-cols-2 gap-8 items-stretch">
          
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl flex flex-col justify-between">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2 mb-4">
                {editingTradeId ? '✏️ Editar Operação' : '📝 Registrar Nova Operação'}
              </h2>
              <form onSubmit={handleSubmitTrade} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                <div>
                  <label className="text-xs text-slate-400">Data da Operação</label>
                  <input type="date" value={tradeDate} onChange={e => setTradeDate(e.target.value)} required className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-sm text-white focus:outline-none focus:border-emerald-500 mt-1" />
                </div>
                
                <div>
                  <label className="text-xs text-slate-400">Workspace / Conta</label>
                  <select value={targetWorkspaceId} onChange={e => setTargetWorkspaceId(e.target.value)} required className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-sm text-white focus:outline-none focus:border-emerald-500 mt-1">
                    {workspaces.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
                </div>

                <div>
                  <label className="text-xs text-slate-400">Ativo (Par/Índice)</label>
                  <input type="text" value={asset} onChange={e => setAsset(e.target.value)} placeholder="Ex: EURUSD, XAUUSD" required className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-sm text-white focus:outline-none focus:border-emerald-500 mt-1" />
                </div>

                <div>
                  <label className="text-xs text-slate-400">Direção</label>
                  <select value={direction} onChange={e => setDirection(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-sm text-white focus:outline-none focus:border-emerald-500 mt-1">
                    <option value="BUY">Long (Buy)</option>
                    <option value="SELL">Short (Sell)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs text-slate-400">Estratégia Utilizada</label>
                  <select value={strategyName} onChange={e => setStrategyName(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-sm text-white focus:outline-none focus:border-emerald-500 mt-1">
                    <option value="">Selecione...</option>
                    {strategies.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                  </select>
                </div>

                <div>
                  <label className="text-xs text-slate-400">Preço de Entrada</label>
                  <input type="number" step="any" value={entryPrice} onChange={e => setEntryPrice(e.target.value)} placeholder="Ex: 1.08500" className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-sm text-white focus:outline-none focus:border-emerald-500 mt-1" />
                </div>

                <div>
                  <label className="text-xs text-slate-400">Preço Stop Loss</label>
                  <input type="number" step="any" value={stopLoss} onChange={e => setStopLoss(e.target.value)} placeholder="Ex: 1.08300" className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-sm text-white focus:outline-none focus:border-emerald-500 mt-1" />
                </div>

                <div>
                  <label className="text-xs text-slate-400">Preço Take Profit</label>
                  <input type="number" step="any" value={takeProfit} onChange={e => setTakeProfit(e.target.value)} placeholder="Ex: 1.09100" className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-sm text-white focus:outline-none focus:border-emerald-500 mt-1" />
                </div>

                <div>
                  <label className="text-xs text-slate-400">PnL (Financeiro em $)</label>
                  <input type="number" step="any" value={pnl} onChange={e => setPnl(e.target.value)} required placeholder="Ex: 250.00 ou -50.00" className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-sm text-white focus:outline-none focus:border-emerald-500 mt-1" />
                </div>

                <div>
                  <label className="text-xs text-slate-400">Risco/Retorno (R)</label>
                  <input type="number" step="any" value={rMultiple} onChange={e => setRMultiple(e.target.value)} placeholder="Ex: 2.5 ou -1" className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-sm text-white focus:outline-none focus:border-emerald-500 mt-1" />
                </div>

                <div className="md:col-span-2">
                  <label className="text-xs text-slate-400">Link da Imagem (TradingView/Print)</label>
                  <input type="url" value={chartUrl} onChange={e => setChartUrl(e.target.value)} placeholder="https://..." className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-sm text-white focus:outline-none focus:border-emerald-500 mt-1" />
                </div>

                <div className="md:col-span-2">
                  <label className="text-xs text-slate-400">Anotações do Trade (Lições, Emoções...)</label>
                  <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-sm text-white focus:outline-none focus:border-emerald-500 mt-1 resize-none"></textarea>
                </div>
              </form>
            </div>

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-800/80">
              {editingTradeId && (
                <button type="button" onClick={resetForm} className="text-sm bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold px-5 py-2.5 rounded-lg transition">
                  Cancelar Edição
                </button>
              )}
              <button type="button" onClick={handleSubmitTrade} className="text-sm bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold px-6 py-2.5 rounded-lg transition">
                {editingTradeId ? 'Atualizar Operação' : 'Salvar Operação'}
              </button>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-4 mb-4">
                <h2 className="text-lg font-bold text-white">📖 Histórico de Operações</h2>
                {filteredTrades.length > 0 && (
                  <button onClick={handleClearAllTrades} className="text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 px-3 py-1.5 rounded-lg transition">
                    Limpar Tudo
                  </button>
                )}
              </div>
              
              <div className="overflow-x-auto min-h-[380px]">
                {paginatedTrades.length === 0 ? (
                  <div className="p-12 text-center text-slate-500 text-sm">
                    Nenhuma operação encontrada para o período/workspace selecionado.
                  </div>
                ) : (
                  <table className="w-full text-left text-sm text-slate-300">
                    <thead className="bg-slate-950/50 text-slate-400 text-xs uppercase">
                      <tr>
                        <th className="p-3 font-semibold">Data</th>
                        <th className="p-3 font-semibold">Ativo</th>
                        <th className="p-3 font-semibold">Dir</th>
                        <th className="p-3 font-semibold">RR</th>
                        <th className="p-3 font-semibold">PnL ($)</th>
                        <th className="p-3 font-semibold text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                      {paginatedTrades.map((trade) => (
                        <tr key={trade.id} className="hover:bg-slate-800/20 transition group">
                          <td className="p-3 text-xs">{format(parseISO(trade.trade_date), 'dd/MM/yyyy')}</td>
                          <td className="p-3 font-bold text-slate-200">{trade.asset}</td>
                          <td className="p-3">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${trade.direction === 'BUY' ? 'bg-blue-500/10 text-blue-400' : 'bg-rose-500/10 text-rose-400'}`}>
                              {trade.direction}
                            </span>
                          </td>
                          <td className="p-3 font-medium text-purple-400 text-xs">{trade.r_multiple ? `${trade.r_multiple}R` : '-'}</td>
                          <td className={`p-3 font-bold text-xs ${trade.pnl > 0 ? 'text-emerald-400' : trade.pnl < 0 ? 'text-rose-500' : 'text-slate-400'}`}>
                            ${trade.pnl.toFixed(2)}
                          </td>
                          <td className="p-3 text-right space-x-1">
                            <button onClick={() => handleEditTrade(trade)} className="text-[11px] text-blue-400 hover:text-blue-300 bg-blue-400/10 hover:bg-blue-400/20 px-2 py-1 rounded transition">
                              Editar
                            </button>
                            <button onClick={() => handleDeleteTrade(trade.id)} className="text-[11px] text-rose-400 hover:text-rose-300 bg-rose-400/10 hover:bg-rose-400/20 px-2 py-1 rounded transition">
                              Excluir
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 mt-4 border-t border-slate-800/80 text-xs text-slate-400">
              <span>
                Mostrando página <strong className="text-slate-200">{currentPage}</strong> de <strong className="text-slate-200">{totalPages}</strong> ({filteredTrades.length} registros)
              </span>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition text-slate-200 font-semibold"
                >
                  Anterior
                </button>
                <button
                  onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition text-slate-200 font-semibold"
                >
                  Próxima
                </button>
              </div>
            </div>
          </div>

        </div>

        <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                📆 Calendário de Desempenho
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Clique em qualquer dia para filtrar e visualizar as operações dele no histórico acima.
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

          <div className="grid grid-cols-7 gap-1 md:gap-2">
            {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((day) => (
              <div key={day} className="text-center text-xs font-bold text-slate-500 py-1 uppercase">
                {day}
              </div>
            ))}

            {Array.from({ length: startDayOfWeek }).map((_, index) => (
              <div key={`empty-${index}`} className="min-h-[70px] md:min-h-[85px] bg-slate-950/30 rounded-lg border border-slate-900" />
            ))}

            {daysInMonth.map((day) => {
              const formattedDate = format(day, 'yyyy-MM-dd')
              const dayTrades = monthTrades.filter((t) => t.trade_date === formattedDate)
              const dayPnl = dayTrades.reduce((acc, t) => acc + (t.pnl || 0), 0)
              const hasTrades = dayTrades.length > 0

              return (
                <div
                  key={formattedDate}
                  onClick={() => {
                    setCalendarFilterDate(formattedDate)
                    setCurrentPage(1)
                    document.getElementById('historico-container')?.scrollIntoView({ behavior: 'smooth' })
                  }}
                  className={`min-h-[70px] md:min-h-[85px] p-2 rounded-lg border flex flex-col justify-between transition relative cursor-pointer hover:border-emerald-400 ${
                    hasTrades
                      ? dayPnl > 0
                        ? 'bg-emerald-950/20 border-emerald-500/30 hover:bg-emerald-950/40'
                        : dayPnl < 0
                        ? 'bg-rose-950/20 border-rose-500/30 hover:bg-rose-950/40'
                        : 'bg-slate-900 border-slate-800 hover:bg-slate-800/80'
                      : 'bg-slate-950/60 border-slate-800/50 text-slate-600 hover:bg-slate-900/50'
                  } ${calendarFilterDate === formattedDate ? 'ring-2 ring-emerald-400' : ''}`}
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
      )}
    </div>
  )
}

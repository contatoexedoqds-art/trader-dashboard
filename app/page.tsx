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
  followed_plan?: string
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
  const [isForgotPassword, setIsForgotPassword] = useState(false)
  const [authError, setAuthError] = useState('')
  const [authSuccess, setAuthSuccess] = useState('')
  const [loadingAuth, setLoadingAuth] = useState(false)

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

  // Modal para Visualização de Imagem do TradingView
  const [viewingImageUrl, setViewingImageUrl] = useState<string | null>(null)

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
  const [followedPlan, setFollowedPlan] = useState('DENTRO')
  const [targetWorkspaceId, setTargetWorkspaceId] = useState<string>('')

  // --- Estados do Painel de Simulação de Monte Carlo estilo FTMO ---
  const [mcCapital, setMcCapital] = useState('50000')
  const [mcWinRate, setMcWinRate] = useState('50')
  const [mcRrr, setMcRrr] = useState('1.00')
  const [mcIterations, setMcIterations] = useState('100')
  const [mcLines, setMcLines] = useState('10')
  const [mcRiskMode, setMcRiskMode] = useState<'percent' | 'risk'>('percent')
  const [mcRiskPercent, setMcRiskPercent] = useState('0.25')
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
                trade_date: t.trade_date,
                followed_plan: t.followed_plan || 'DENTRO'
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
    setAuthSuccess('')
    setLoadingAuth(true)

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) setAuthError(error.message)
        else setAuthSuccess('Conta criada com sucesso! Verifique seu e-mail para confirmar.')
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) setAuthError(error.message)
      }
    } catch (err: any) {
      setAuthError(err.message || 'Erro ao processar autenticação.')
    } finally {
      setLoadingAuth(false)
    }
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault()
    setAuthError('')
    setAuthSuccess('')
    setLoadingAuth(true)

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: 'https://trader-dashboard-lilac.vercel.app/reset-password',
      })
      if (error) {
        setAuthError(error.message)
      } else {
        setAuthSuccess('E-mail de recuperação enviado! Verifique sua caixa de entrada e spam.')
      }
    } catch (err: any) {
      setAuthError(err.message || 'Erro ao solicitar redefinição de senha.')
    } finally {
      setLoadingAuth(false)
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
    } else {
      alert('Erro ao criar estratégia: ' + error?.message)
    }
  }

  async function handleDeleteStrategy(stratId: string, stratName: string) {
    if (confirm(`Tem certeza que deseja excluir a estratégia "${stratName}"? (As operações já salvas com ela não serão apagadas, apenas o setup)`)) {
      const { error } = await supabase.from('strategies').delete().eq('id', stratId)
      if (!error) {
        setStrategies(strategies.filter(s => s.id !== stratId))
        if (strategyName === stratName) {
          setStrategyName('')
        }
      } else {
        alert('Erro ao excluir estratégia: ' + error.message)
      }
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
      followed_plan: followedPlan,
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
    setFollowedPlan(trade.followed_plan || 'DENTRO')
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
    setFollowedPlan('DENTRO')
    setTradeDate(new Date().toISOString().split('T')[0])
  }

  function runMonteCarloSimulation(e?: React.FormEvent) {
    if (e) e.preventDefault()

    const initialCap = parseFloat(mcCapital) || 50000
    const winRate = parseFloat(mcWinRate) || 50
    const rrr = parseFloat(mcRrr) || 1.0
    const iterations = parseInt(mcIterations) || 100
    const pathsCount = parseInt(mcLines) || 10
    const riskPct = parseFloat(mcRiskPercent) || 0.25

    const colorPalette = [
      '#eab308', '#a855f7', '#22c55e', '#3b82f6', '#ec4899',
      '#f97316', '#06b6d4', '#84cc16', '#6366f1', '#ef4444'
    ]

    const paths: { step: number; equity: number; isWin: boolean; drawdown: number }[][] = []
    let allEquitiesFlat: number[] = []
    let maxDrawdowns: number[] = []

    let maxWinStreakGlobal = 0
    let maxLossStreakGlobal = 0

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
              {isForgotPassword
                ? 'Informe o e-mail cadastrado para redefinir a senha'
                : isSignUp
                ? 'Crie sua conta com e-mail'
                : 'Entre no seu diário de operações'}
            </p>
          </div>

          {authError && (
            <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs p-3 rounded-lg text-center">
              {authError}
            </div>
          )}

          {authSuccess && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs p-3 rounded-lg text-center">
              {authSuccess}
            </div>
          )}

          {isForgotPassword ? (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label className="text-xs text-slate-400">E-mail Cadastrado</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 mt-1"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loadingAuth}
                className="w-full bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold py-2.5 rounded-lg transition text-sm disabled:opacity-50"
              >
                {loadingAuth ? 'Enviando...' : 'Enviar Link de Recuperação'}
              </button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => {
                    setIsForgotPassword(false)
                    setAuthError('')
                    setAuthSuccess('')
                  }}
                  className="text-xs text-slate-400 hover:text-emerald-400 transition"
                >
                  ← Voltar para o Login
                </button>
              </div>
            </form>
          ) : (
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
                <div className="flex justify-between items-center">
                  <label className="text-xs text-slate-400">Senha</label>
                  {!isSignUp && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsForgotPassword(true)
                        setAuthError('')
                        setAuthSuccess('')
                      }}
                      className="text-[11px] text-emerald-400 hover:underline"
                    >
                      Esqueceu a senha?
                    </button>
                  )}
                </div>
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
                disabled={loadingAuth}
                className="w-full bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold py-2.5 rounded-lg transition text-sm disabled:opacity-50"
              >
                {loadingAuth ? 'Carregando...' : isSignUp ? 'Criar Conta' : 'Entrar no Dashboard'}
              </button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => {
                    setIsSignUp(!isSignUp)
                    setAuthError('')
                    setAuthSuccess('')
                  }}
                  className="text-xs text-slate-400 hover:text-emerald-400 transition"
                >
                  {isSignUp ? 'Já tem uma conta? Faça Login' : 'Não tem conta? Cadastre-se'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    )
  }

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

  const totalPages = Math.ceil(filteredTrades.length / itemsPerPage) || 1
  const paginatedTrades = filteredTrades.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )

  const totalTrades = filteredTrades.length
  const totalPnl = filteredTrades.reduce((acc, t) => acc + (t.pnl || 0), 0)
  const totalWins = filteredTrades.filter((t) => t.result_type === 'WIN').length
  const winRate = totalTrades > 0 ? ((totalWins / totalTrades) * 100).toFixed(1) : '0'

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

      {/* Modal para Visualizar a Imagem do Gráfico */}
      {viewingImageUrl && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 max-w-4xl w-full space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                📈 Visualização do Gráfico (TradingView)
              </h3>
              <div className="flex items-center gap-2">
                <a
                  href={viewingImageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-lg transition font-medium"
                >
                  Abrir no Navegador ↗
                </a>
                <button
                  onClick={() => setViewingImageUrl(null)}
                  className="text-xs bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 font-bold px-3 py-1.5 rounded-lg transition"
                >
                  ✕ Fechar
                </button>
              </div>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-lg overflow-hidden flex items-center justify-center min-h-[300px] max-h-[75vh]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={viewingImageUrl}
                alt="Gráfico da Operação"
                className="max-w-full max-h-[70vh] object-contain rounded"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none'
                }}
              />
            </div>
          </div>
        </div>
      )}

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

      {/* Conteúdo Principal */}
      <main className="max-w-7xl mx-auto mt-6 space-y-6">
        {activeTab === 'dashboard' ? (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-1">
                <p className="text-xs text-slate-400 uppercase font-semibold">Total de Trades</p>
                <p className="text-2xl font-black text-white">{totalTrades}</p>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-1">
                <p className="text-xs text-slate-400 uppercase font-semibold">Resultado Acumulado (PnL)</p>
                <p className={`text-2xl font-black ${totalPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {totalPnl >= 0 ? `+$${totalPnl.toFixed(2)}` : `-$${Math.abs(totalPnl).toFixed(2)}`}
                </p>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-1">
                <p className="text-xs text-slate-400 uppercase font-semibold">Taxa de Acerto (Win Rate)</p>
                <p className="text-2xl font-black text-white">{winRate}%</p>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-1">
                <p className="text-xs text-slate-400 uppercase font-semibold">Resultado Mensal</p>
                <p className={`text-2xl font-black ${monthlyPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {monthlyPnl >= 0 ? `+$${monthlyPnl.toFixed(2)}` : `-$${Math.abs(monthlyPnl).toFixed(2)}`}
                </p>
              </div>
            </div>

            {/* Form de Cadastro/Edição de Trade */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
              <h2 className="text-sm font-bold text-white flex items-center justify-between">
                <span>{editingTradeId ? '✏️ Editar Operação' : '➕ Registrar Nova Operação'}</span>
                {editingTradeId && (
                  <button onClick={resetForm} className="text-xs text-slate-400 hover:text-white underline">
                    Cancelar Edição
                  </button>
                )}
              </h2>

              <form onSubmit={handleSubmitTrade} className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-sm text-white focus:outline-none focus:border-emerald-500 mt-1 font-semibold"
                  >
                    <option value="BUY">🟢 COMPRA (BUY)</option>
                    <option value="SELL">🔴 VENDA (SELL)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs text-slate-400">Estratégia / Setup</label>
                  <select
                    value={strategyName}
                    onChange={(e) => setStrategyName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-sm text-white focus:outline-none focus:border-emerald-500 mt-1"
                  >
                    <option value="">-- Selecione ou Crie --</option>
                    {strategies.map((s) => (
                      <option key={s.id} value={s.name}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs text-slate-400">Data do Trade</label>
                  <input
                    type="date"
                    value={tradeDate}
                    onChange={(e) => setTradeDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-sm text-white focus:outline-none focus:border-emerald-500 mt-1"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-400">Resultado ($ PnL)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={pnl}
                    onChange={(e) => setPnl(e.target.value)}
                    placeholder="Ex: 268.56 ou -50"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-sm text-white focus:outline-none focus:border-emerald-500 mt-1 font-semibold"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-400">Retorno R (R:R)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={rMultiple}
                    onChange={(e) => setRMultiple(e.target.value)}
                    placeholder="Ex: 2.5 ou -1"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-sm text-white focus:outline-none focus:border-emerald-500 mt-1"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-400">Link do Gráfico (TradingView)</label>
                  <input
                    type="url"
                    value={chartUrl}
                    onChange={(e) => setChartUrl(e.target.value)}
                    placeholder="https://www.tradingview.com/x/..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-sm text-white focus:outline-none focus:border-emerald-500 mt-1"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-400">Plano de Trade</label>
                  <select
                    value={followedPlan}
                    onChange={(e) => setFollowedPlan(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-sm text-white focus:outline-none focus:border-emerald-500 mt-1 font-semibold"
                  >
                    <option value="DENTRO">✅ Seguiu o Plano</option>
                    <option value="FORA">❌ Fora do Plano</option>
                  </select>
                </div>

                <div className="md:col-span-4">
                  <label className="text-xs text-slate-400">Anotações / Notas</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                    placeholder="Contexto da entrada, gatilho, sentimentos..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-sm text-white focus:outline-none focus:border-emerald-500 mt-1"
                  />
                </div>

                <div className="md:col-span-4 flex justify-end">
                  <button
                    type="submit"
                    className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold px-6 py-2.5 rounded-lg transition text-sm"
                  >
                    {editingTradeId ? 'Atualizar Operação' : 'Salvar Operação'}
                  </button>
                </div>
              </form>
            </div>

            {/* Tabela de Operações */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <h2 className="text-sm font-bold text-white">📜 Histórico de Operações</h2>
                {trades.length > 0 && (
                  <button
                    onClick={handleClearAllTrades}
                    className="text-xs text-rose-400 hover:text-rose-300 font-semibold underline"
                  >
                    Limpar Operações
                  </button>
                )}
              </div>

              {loadingTrades ? (
                <p className="text-xs text-slate-400 py-4 text-center">Carregando histórico...</p>
              ) : paginatedTrades.length === 0 ? (
                <p className="text-xs text-slate-400 py-4 text-center">Nenhuma operação registrada ainda.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-950 text-slate-400 uppercase border-b border-slate-800">
                      <tr>
                        <th className="p-3">Data</th>
                        <th className="p-3">Ativo</th>
                        <th className="p-3">Lado</th>
                        <th className="p-3">Estratégia</th>
                        <th className="p-3">PnL ($)</th>
                        <th className="p-3">Retorno (R)</th>
                        <th className="p-3">Plano</th>
                        <th className="p-3">Gráfico</th>
                        <th className="p-3 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                      {paginatedTrades.map((t) => (
                        <tr key={t.id} className="hover:bg-slate-800/30 transition">
                          <td className="p-3 text-slate-300 font-medium">{t.trade_date}</td>
                          <td className="p-3 font-bold text-white">{t.asset}</td>
                          <td className="p-3 font-semibold">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] ${
                                t.direction === 'BUY'
                                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                  : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                              }`}
                            >
                              {t.direction}
                            </span>
                          </td>
                          <td className="p-3 text-slate-400">{t.strategy_name || '-'}</td>
                          <td
                            className={`p-3 font-bold ${
                              t.pnl > 0
                                ? 'text-emerald-400'
                                : t.pnl < 0
                                ? 'text-rose-400'
                                : 'text-slate-400'
                            }`}
                          >
                            {t.pnl > 0 ? `+$${t.pnl.toFixed(2)}` : `$${t.pnl.toFixed(2)}`}
                          </td>
                          <td className="p-3 text-slate-300 font-semibold">{t.r_multiple}R</td>
                          <td className="p-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] ${
                                t.followed_plan === 'DENTRO'
                                  ? 'bg-emerald-500/10 text-emerald-400'
                                  : 'bg-rose-500/10 text-rose-400'
                              }`}
                            >
                              {t.followed_plan === 'DENTRO' ? '✓ Plano' : '✕ Fora'}
                            </span>
                          </td>
                          <td className="p-3">
                            {t.chart_url ? (
                              <button
                                onClick={() => setViewingImageUrl(t.chart_url || null)}
                                className="text-emerald-400 hover:underline font-medium"
                              >
                                Ver Gráfico
                              </button>
                            ) : (
                              <span className="text-slate-600">-</span>
                            )}
                          </td>
                          <td className="p-3 text-right space-x-2">
                            <button
                              onClick={() => handleEditTrade(t)}
                              className="text-slate-400 hover:text-white transition"
                              title="Editar"
                            >
                              ✏️
                            </button>
                            <button
                              onClick={() => handleDeleteTrade(t.id)}
                              className="text-rose-400 hover:text-rose-300 transition"
                              title="Excluir"
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

              {/* Paginação */}
              {totalPages > 1 && (
                <div className="flex justify-between items-center pt-4 border-t border-slate-800 text-xs">
                  <span className="text-slate-400">
                    Página {currentPage} de {totalPages}
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="px-3 py-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 rounded"
                    >
                      Anterior
                    </button>
                    <button
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="px-3 py-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 rounded"
                    >
                      Próxima
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          /* Monte Carlo Tab Content */
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              📊 Simulação de Monte Carlo
            </h2>

            <form onSubmit={runMonteCarloSimulation} className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-xs text-slate-400">Capital Inicial ($)</label>
                <input
                  type="number"
                  value={mcCapital}
                  onChange={(e) => setMcCapital(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-sm text-white focus:outline-none focus:border-emerald-500 mt-1 font-semibold"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400">Taxa de Acerto (Win Rate %)</label>
                <input
                  type="number"
                  step="0.1"
                  value={mcWinRate}
                  onChange={(e) => setMcWinRate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-sm text-white focus:outline-none focus:border-emerald-500 mt-1 font-semibold"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400">Risco / Retorno (RRR)</label>
                <input
                  type="number"
                  step="0.01"
                  value={mcRrr}
                  onChange={(e) => setMcRrr(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-sm text-white focus:outline-none focus:border-emerald-500 mt-1 font-semibold"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400">Risco por Trade (% do Capital)</label>
                <input
                  type="number"
                  step="0.01"
                  value={mcRiskPercent}
                  onChange={(e) => setMcRiskPercent(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-sm text-white focus:outline-none focus:border-emerald-500 mt-1 font-semibold"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400">Quantidade de Operações</label>
                <input
                  type="number"
                  value={mcIterations}
                  onChange={(e) => setMcIterations(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-sm text-white focus:outline-none focus:border-emerald-500 mt-1 font-semibold"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400">Curvas a Simular</label>
                <input
                  type="number"
                  value={mcLines}
                  onChange={(e) => setMcLines(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-sm text-white focus:outline-none focus:border-emerald-500 mt-1 font-semibold"
                />
              </div>

              <div className="md:col-span-3 flex justify-end">
                <button
                  type="submit"
                  className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold px-6 py-2.5 rounded-lg transition text-sm"
                >
                  Rodar Simulação
                </button>
              </div>
            </form>

            {mcResults && (
              <div className="space-y-4 pt-4 border-t border-slate-800">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-slate-950 border border-slate-800 rounded-lg p-3">
                    <p className="text-[11px] text-slate-400 uppercase">Maior Drawdown</p>
                    <p className="text-lg font-bold text-rose-400">{mcResults.maxDrawdown.toFixed(2)}%</p>
                  </div>
                  <div className="bg-slate-950 border border-slate-800 rounded-lg p-3">
                    <p className="text-[11px] text-slate-400 uppercase">Drawdown Médio</p>
                    <p className="text-lg font-bold text-amber-400">{mcResults.avgDrawdown.toFixed(2)}%</p>
                  </div>
                  <div className="bg-slate-950 border border-slate-800 rounded-lg p-3">
                    <p className="text-[11px] text-slate-400 uppercase">Maior Sequência de Loss</p>
                    <p className="text-lg font-bold text-rose-400">{mcResults.maxLossStreak} Trades</p>
                  </div>
                  <div className="bg-slate-950 border border-slate-800 rounded-lg p-3">
                    <p className="text-[11px] text-slate-400 uppercase">Maior Sequência de Win</p>
                    <p className="text-lg font-bold text-emerald-400">{mcResults.maxWinStreak} Trades</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}

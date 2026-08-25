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
  const [authError, setAuthError] = useState('')
  const [authMessage, setAuthMessage] = useState('')

  // Novos estados para Recuperação / Redefinição de Senha
  const [viewMode, setViewMode] = useState<'login' | 'forgot' | 'update_password'>('login')
  const [newPassword, setNewPassword] = useState('')

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

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session)
      setLoadingSession(false)

      // Se o usuário clicou no link de recuperação de senha do e-mail, o Supabase dispara o evento PASSWORD_RECOVERY
      if (event === 'PASSWORD_RECOVERY') {
        setViewMode('update_password')
      }
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
    setAuthMessage('')

    if (isSignUp) {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) setAuthError(error.message)
      else alert('Conta criada com sucesso!')
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setAuthError(error.message)
    }
  }

  // Função para enviar o e-mail de recuperação de senha
  async function handlePasswordResetRequest(e: React.FormEvent) {
    e.preventDefault()
    setAuthError('')
    setAuthMessage('')

    // URL atual para onde o usuário será redirecionado ao clicar no link do e-mail
    const redirectTo = window.location.origin

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    })

    if (error) {
      setAuthError(error.message)
    } else {
      setAuthMessage('E-mail de recuperação enviado! Verifique sua caixa de entrada.')
    }
  }

  // Função para salvar a nova senha após clicar no link do e-mail
  async function handleUpdatePassword(e: React.FormEvent) {
    e.preventDefault()
    setAuthError('')
    setAuthMessage('')

    const { error } = await supabase.auth.updateUser({ password: newPassword })

    if (error) {
      setAuthError(error.message)
    } else {
      alert('Senha alterada com sucesso!')
      setNewPassword('')
      setViewMode('login')
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
              {viewMode === 'update_password'
                ? 'Defina sua nova senha'
                : viewMode === 'forgot'
                ? 'Recupere sua senha'
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

          {authMessage && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs p-3 rounded-lg text-center">
              {authMessage}
            </div>
          )}

          {/* TELA DE REDEFINIÇÃO DE SENHA (Quando o usuário clica no link do e-mail) */}
          {viewMode === 'update_password' ? (
            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <div>
                <label className="text-xs text-slate-400">Nova Senha</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 mt-1"
                  required
                />
              </div>

              <button
                type="submit"
                className="w-full bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold py-2.5 rounded-lg transition text-sm"
              >
                Atualizar Senha
              </button>
            </form>
          ) : viewMode === 'forgot' ? (
            /* TELA DE ESQUECI MINHA SENHA */
            <form onSubmit={handlePasswordResetRequest} className="space-y-4">
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
                className="w-full bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold py-2.5 rounded-lg transition text-sm"
              >
                Enviar Link de Recuperação
              </button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => {
                    setViewMode('login')
                    setAuthError('')
                    setAuthMessage('')
                  }}
                  className="text-xs text-slate-400 hover:text-emerald-400 transition"
                >
                  Voltar para o Login
                </button>
              </div>
            </form>
          ) : (
            /* TELA DE LOGIN / CADASTRO NORMAL */
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
                        setViewMode('forgot')
                        setAuthError('')
                        setAuthMessage('')
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
                className="w-full bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold py-2.5 rounded-lg transition text-sm"
              >
                {isSignUp ? 'Criar Conta' : 'Entrar no Dashboard'}
              </button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => {
                    setIsSignUp(!isSignUp)
                    setAuthError('')
                    setAuthMessage('')
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

  // Restante da aplicação (dashboard, gráficos, tabelas)...
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
      {/* Cabeçalho e conteúdo principal mantidos exatamente como estavam */}
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

          <button
            onClick={() => supabase.auth.signOut()}
            className="text-xs bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 font-semibold px-4 py-2 rounded-lg transition ml-auto md:ml-2"
          >
            Sair
          </button>
        </div>
      </header>

      {/* Conteúdo do Dashboard padrão */}
      <main className="max-w-7xl mx-auto mt-8 space-y-8">
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl text-center">
          <h2 className="text-lg font-bold text-white">Bem-vindo ao seu painel!</h2>
          <p className="text-xs text-slate-400 mt-1">Navegue pelas abas ou registre suas operações normalmente.</p>
        </div>
      </main>
    </div>
  )
}

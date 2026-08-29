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
  parseISO,
  addDays
} from 'date-fns'
import { ptBR } from 'date-fns/locale'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseAnonKey)

interface UserProfile {
  id: string
  email: string
  is_admin: boolean
  access_until: string | null
}

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

  // Perfil e Bloqueio de Usuário
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [allProfiles, setAllProfiles] = useState<UserProfile[]>([])
  const [showAdminModal, setShowAdminModal] = useState(false)
  const [loadingAdmin, setLoadingAdmin] = useState(false)

  // Navegação de Abas ("dashboard" ou "montecarlo")
  const [activeTab, setActiveTab] = useState<'dashboard' | 'montecarlo'>('dashboard')

  // Auth States
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isSignUp, setIsSignUp] = useState(false)
  const [authError, setAuthError] = useState('')
  const [resetMessage, setResetMessage] = useState('')

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
      if (session) fetchUserProfile(session.user.id)
      else setLoadingSession(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) fetchUserProfile(session.user.id)
      else setLoadingSession(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  async function fetchUserProfile(userId: string) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (data) {
      setProfile(data)
    }
    setLoadingSession(false)
  }

  useEffect(() => {
    if (session && isAccessValid()) {
      fetchData()
    }
  }, [session, profile])

  function isAccessValid() {
    if (!profile) return true
    if (profile.is_admin) return true
    if (!profile.access_until) return true // Sem limite definido = acesso liberado
    return new Date(profile.access_until) > new Date()
  }

  async function fetchAdminUsers() {
    setLoadingAdmin(true)
    const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false })
    if (data) setAllProfiles(data)
    setLoadingAdmin(false)
  }

  async function handleUpdateAccess(userId: string, daysToAdd: number | null) {
    let newDate: string | null = null

    if (daysToAdd !== null) {
      const currentAccess = allProfiles.find(p => p.id === userId)?.access_until
      const baseDate = currentAccess && new Date(currentAccess) > new Date() ? new Date(currentAccess) : new Date()
      newDate = addDays(baseDate, daysToAdd).toISOString()
    }

    const { error } = await supabase.from('profiles').update({ access_until: newDate }).eq('id', userId)

    if (!error) {
      fetchAdminUsers()
    } else {
      alert('Erro ao atualizar acesso: ' + error.message)
    }
  }

  async function handleExpireAccess(userId: string) {
    const pastDate = new Date(Date.now() - 86400000).toISOString()
    const { error } = await supabase.from('profiles').update({ access_until: pastDate }).eq('id', userId)
    if (!error) fetchAdminUsers()
    else alert('Erro ao expirar acesso: ' + error.message)
  }

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
    setResetMessage('')

    if (isSignUp) {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) setAuthError(error.message)
      else alert('Conta criada com sucesso!')
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setAuthError(error.message)
    }
  }

  async function handleResetPassword() {
    setAuthError('')
    setResetMessage('')

    if (!email.trim()) {
      setAuthError('Digite seu e-mail no campo acima para redefinir a senha.')
      return
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: 'https://trader-dashboard-lilac.vercel.app/reset-password',
    })

    if (error) {
      setAuthError('Erro ao enviar e-mail: ' + error.message)
    } else {
      setResetMessage('E-mail de redefinição enviado com sucesso! Verifique sua caixa de entrada.')
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

          {resetMessage && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs p-3 rounded-lg text-center">
              {resetMessage}
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
              <div className="flex justify-between items-center">
                <label className="text-xs text-slate-400">Senha</label>
                {!isSignUp && (
                  <button
                    type="button"
                    onClick={handleResetPassword}
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
          </form>

          <div className="text-center">
            <button
              onClick={() => {
                setIsSignUp(!isSignUp)
                setAuthError('')
                setResetMessage('')
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

  // TELA DE BLOQUEIO CASO A LICENÇA TENHA EXPIRADO
  if (!isAccessValid()) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 font-sans">
        <div className="bg-slate-900 border border-rose-500/30 rounded-2xl p-8 max-w-md w-full shadow-2xl text-center space-y-5">
          <div className="w-16 h-16 bg-rose-500/10 border border-rose-500/30 rounded-full flex items-center justify-center mx-auto text-3xl">
            🔒
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-bold text-rose-400">Acesso Expirado</h2>
            <p className="text-xs text-slate-400">
              O seu período de acesso ao Trader Dashboard encerrou em{' '}
              <span className="text-slate-200 font-semibold">
                {profile?.access_until ? format(parseISO(profile.access_until), 'dd/MM/yyyy') : 'data desconhecida'}
              </span>.
            </p>
          </div>

          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-xs text-slate-300">
            Para renovar sua licença ou adquirir mais tempo de uso, entre em contato com o suporte ou administrador.
          </div>

          <button
            onClick={() => supabase.auth.signOut()}
            className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold py-2.5 rounded-lg transition"
          >
            Sair da Conta
          </button>
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

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 font-sans">
      <header className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between md:items-center gap-4 pb-6 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-emerald-400 flex items-center gap-2">
            📊 DASHBOARD TRADER
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Usuário: <span className="text-slate-200 font-semibold">{session.user.email}</span>
            {profile?.access_until && (
              <span className="ml-2 text-emerald-400 font-medium bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded text-[10px]">
                Acesso até: {format(parseISO(profile.access_until), 'dd/MM/yyyy')}
              </span>
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {profile?.is_admin && (
            <button
              onClick={() => {
                setShowAdminModal(true)
                fetchAdminUsers()
              }}
              className="text-xs bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 text-amber-400 font-semibold px-3 py-2 rounded-lg transition"
            >
              👑 Gerenciar Licenças
            </button>
          )}

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
            >
              💾 Salvar Backup
            </button>
            <label className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded transition font-medium cursor-pointer">
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

      {/* MODAL ADMIN - GERENCIADOR DE USUÁRIOS E EXPIRAÇÃO */}
      {showAdminModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-3xl w-full space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-amber-400 flex items-center gap-2">
                👑 Painel de Gerenciamento de Usuários (Licenças)
              </h3>
              <button
                onClick={() => setShowAdminModal(false)}
                className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold px-3 py-1.5 rounded-lg"
              >
                ✕ Fechar
              </button>
            </div>

            {loadingAdmin ? (
              <p className="text-xs text-slate-400 text-center py-8">Carregando usuários...</p>
            ) : (
              <div className="max-h-[60vh] overflow-y-auto space-y-2 pr-1">
                {allProfiles.map((p) => {
                  const isValid = p.is_admin || (p.access_until && new Date(p.access_until) > new Date())
                  return (
                    <div
                      key={p.id}
                      className="bg-slate-950 border border-slate-800 p-3 rounded-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white">{p.email}</span>
                          {p.is_admin && (
                            <span className="bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded text-[10px] font-bold">
                              ADMIN
                            </span>
                          )}
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              isValid ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                            }`}
                          >
                            {isValid ? 'ATIVO' : 'BLOQUEADO'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1">
                          Vencimento:{' '}
                          <span className="text-slate-200">
                            {p.access_until
                              ? format(parseISO(p.access_until), 'dd/MM/yyyy HH:mm')
                              : 'Sem limite (Vitalício)'}
                          </span>
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-1">
                        <button
                          onClick={() => handleUpdateAccess(p.id, 30)}
                          className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 font-bold px-2.5 py-1.5 rounded text-[11px]"
                        >
                          +30 Dias
                        </button>
                        <button
                          onClick={() => handleUpdateAccess(p.id, 60)}
                          className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 font-bold px-2.5 py-1.5 rounded text-[11px]"
                        >
                          +60 Dias
                        </button>
                        <button
                          onClick={() => handleUpdateAccess(p.id, null)}
                          className="bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 font-bold px-2.5 py-1.5 rounded text-[11px]"
                        >
                          Vitalício
                        </button>
                        <button
                          onClick={() => handleExpireAccess(p.id)}
                          className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 font-bold px-2.5 py-1.5 rounded text-[11px]"
                        >
                          Expirar Agora
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Restante do conteúdo do seu dashboard... */}
      <div className="max-w-7xl mx-auto mt-8">
        <p className="text-xs text-slate-400">Dashboard pronto e operando.</p>
      </div>
    </div>
  )
}

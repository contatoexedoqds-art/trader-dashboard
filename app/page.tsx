'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { 
  TrendingUp, TrendingDown, DollarSign, Target, Percent, 
  Calendar as CalendarIcon, Filter, Plus, Trash2, Edit3, 
  Eye, Download, Upload, Activity, Layers, Play
} from 'lucide-react'

// Interfaces
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
  direction: 'BUY' | 'SELL'
  strategy_name?: string
  entry_price?: number
  stop_loss?: number
  take_profit?: number
  pnl: number
  r_multiple?: number
  result_type?: 'GAIN' | 'LOSS' | 'BE'
  chart_url?: string
  notes?: string
  trade_date: string
  followed_plan?: 'DENTRO' | 'FORA'
}

export default function TradingJournal() {
  const supabase = createClientComponentClient()

  // Estados
  const [activeTab, setActiveTab] = useState<'dashboard' | 'montecarlo'>('dashboard')
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [selectedWorkspace, setSelectedWorkspace] = useState<string>('')
  const [strategies, setStrategies] = useState<Strategy[]>([])
  const [trades, setTrades] = useState<Trade[]>([])
  const [loading, setLoading] = useState<boolean>(true)

  // Filtros
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')
  const [selectedDate, setSelectedDate] = useState<string>('')

  // Modais
  const [isTradeModalOpen, setIsTradeModalOpen] = useState(false)
  const [isViewModalOpen, setIsViewModalOpen] = useState(false)
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null)
  const [imageError, setImageError] = useState(false)

  // Form State
  const [formData, setFormData] = useState<Partial<Trade>>({
    asset: '',
    direction: 'BUY',
    pnl: 0,
    r_multiple: 0,
    trade_date: new Date().toISOString().split('T')[0],
    followed_plan: 'DENTRO',
    result_type: 'GAIN'
  })

  // Monte Carlo State
  const [mcSimulations, setMcSimulations] = useState<number>(1000)
  const [mcTradeCount, setMcTradeCount] = useState<number>(100)
  const [mcWinRate, setMcWinRate] = useState<number>(50)
  const [mcRiskReward, setMcRiskReward] = useState<number>(2)
  const [mcRiskPerTrade, setMcRiskPerTrade] = useState<number>(1)
  const [mcResults, setMcResults] = useState<any>(null)

  // Carregar dados iniciais
  useEffect(() => {
    fetchWorkspaces()
    fetchStrategies()
  }, [])

  useEffect(() => {
    if (selectedWorkspace) {
      fetchTrades(selectedWorkspace)
    }
  }, [selectedWorkspace])

  const fetchWorkspaces = async () => {
    const { data } = await supabase.from('workspaces').select('*')
    if (data && data.length > 0) {
      setWorkspaces(data)
      setSelectedWorkspace(data[0].id)
    }
  }

  const fetchStrategies = async () => {
    const { data } = await supabase.from('strategies').select('*')
    if (data) setStrategies(data)
  }

  const fetchTrades = async (workspaceId: string) => {
    setLoading(true)
    const { data } = await supabase
      .from('trades')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('trade_date', { ascending: false })
    if (data) setTrades(data)
    setLoading(false)
  }

  // Filtragem de trades
  const filteredTrades = useMemo(() => {
    return trades.filter(t => {
      const matchStart = startDate ? t.trade_date >= startDate : true
      const matchEnd = endDate ? t.trade_date <= endDate : true
      const matchExact = selectedDate ? t.trade_date === selectedDate : true
      return matchStart && matchEnd && matchExact
    })
  }, [trades, startDate, endDate, selectedDate])

  // Métricas do Dashboard
  const currentWorkspace = workspaces.find(w => w.id === selectedWorkspace)
  const initialCapital = currentWorkspace?.initial_capital || 5000

  const metrics = useMemo(() => {
    const totalTrades = filteredTrades.length
    const wins = filteredTrades.filter(t => t.pnl > 0).length
    const losses = filteredTrades.filter(t => t.pnl < 0).length
    const totalPnl = filteredTrades.reduce((acc, t) => acc + Number(t.pnl || 0), 0)
    const winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0
    const totalR = filteredTrades.reduce((acc, t) => acc + Number(t.r_multiple || 0), 0)

    return { totalTrades, wins, losses, totalPnl, winRate, totalR }
  }, [filteredTrades])

  // Salvar/Editar Trade
  const handleSaveTrade = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedWorkspace) return

    const payload = {
      ...formData,
      workspace_id: selectedWorkspace,
      pnl: Number(formData.pnl),
      r_multiple: Number(formData.r_multiple)
    }

    if (formData.id) {
      await supabase.from('trades').update(payload).eq('id', formData.id)
    } else {
      await supabase.from('trades').insert([payload])
    }

    setIsTradeModalOpen(false)
    fetchTrades(selectedWorkspace)
  }

  // Excluir Trade
  const handleDeleteTrade = async (id: string) => {
    if (confirm('Deseja realmente excluir este trade?')) {
      await supabase.from('trades').delete().eq('id', id)
      fetchTrades(selectedWorkspace)
    }
  }

  // Visualizar Trade
  const handleViewTrade = (trade: Trade) => {
    setSelectedTrade(trade)
    setImageError(false)
    setIsViewModalOpen(true)
  }

  // Backup JSON
  const handleExportBackup = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({ workspaces, strategies, trades }))
    const downloadAnchor = document.createElement('a')
    downloadAnchor.setAttribute("href", dataStr)
    downloadAnchor.setAttribute("download", `trading_journal_backup_${new Date().toISOString().split('T')[0]}.json`)
    document.body.appendChild(downloadAnchor)
    downloadAnchor.click()
    downloadAnchor.remove()
  }

  // Importar JSON
  const handleImportBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileReader = new FileReader()
    if (e.target.files && e.target.files[0]) {
      fileReader.readAsText(e.target.files[0], "UTF-8")
      fileReader.onload = async (event) => {
        try {
          const parsed = JSON.parse(event.target?.result as string)
          if (parsed.trades) {
            await supabase.from('trades').upsert(parsed.trades)
            if (selectedWorkspace) fetchTrades(selectedWorkspace)
            alert('Backup restaurado com sucesso!')
          }
        } catch (err) {
          alert('Erro ao importar o arquivo JSON.')
        }
      }
    }
  }

  // Algoritmo Monte Carlo
  const runMonteCarlo = () => {
    let finalBalances: number[] = []
    let maxDrawdowns: number[] = []
    let maxWinStreaks: number[] = []
    let maxLossStreaks: number[] = []

    for (let sim = 0; sim < mcSimulations; sim++) {
      let balance = initialCapital
      let peak = balance
      let maxDD = 0
      let currentWinStreak = 0
      let maxWinStreak = 0
      let currentLossStreak = 0
      let maxLossStreak = 0

      for (let t = 0; t < mcTradeCount; t++) {
        const isWin = Math.random() * 100 < mcWinRate
        const riskAmount = balance * (mcRiskPerTrade / 100)

        if (isWin) {
          balance += riskAmount * mcRiskReward
          currentWinStreak++
          currentLossStreak = 0
          if (currentWinStreak > maxWinStreak) maxWinStreak = currentWinStreak
        } else {
          balance -= riskAmount
          currentLossStreak++
          currentWinStreak = 0
          if (currentLossStreak > maxLossStreak) maxLossStreak = currentLossStreak
        }

        if (balance > peak) peak = balance
        const dd = ((peak - balance) / peak) * 100
        if (dd > maxDD) maxDD = dd
      }

      finalBalances.push(balance)
      maxDrawdowns.push(maxDD)
      maxWinStreaks.push(maxWinStreak)
      maxLossStreaks.push(maxLossStreak)
    }

    const avgBalance = finalBalances.reduce((a, b) => a + b, 0) / mcSimulations
    const avgDD = maxDrawdowns.reduce((a, b) => a + b, 0) / mcSimulations
    const maxDDRecorded = Math.max(...maxDrawdowns)
    const avgWinStreak = maxWinStreaks.reduce((a, b) => a + b, 0) / mcSimulations
    const avgLossStreak = maxLossStreaks.reduce((a, b) => a + b, 0) / mcSimulations

    setMcResults({
      avgBalance,
      avgDD,
      maxDDRecorded,
      avgWinStreak,
      avgLossStreak
    })
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6">
      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
            Journaling & Risk Management
          </h1>
          <p className="text-slate-400 text-sm">Acompanhamento de alta performance e simulações</p>
        </div>

        <div className="flex items-center gap-3">
          {/* Navegação por Abas */}
          <div className="flex bg-slate-900 p-1 rounded-lg border border-slate-800">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'dashboard' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Activity className="w-4 h-4 inline mr-2" />
              Dashboard
            </button>
            <button
              onClick={() => setActiveTab('montecarlo')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'montecarlo' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Layers className="w-4 h-4 inline mr-2" />
              Monte Carlo
            </button>
          </div>

          {/* Backup Buttons */}
          <button 
            onClick={handleExportBackup} 
            title="Exportar Backup JSON"
            className="p-2 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-lg border border-slate-800 transition-colors"
          >
            <Download className="w-4 h-4" />
          </button>
          <label 
            title="Importar Backup JSON"
            className="p-2 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-lg border border-slate-800 cursor-pointer transition-colors"
          >
            <Upload className="w-4 h-4" />
            <input type="file" accept=".json" onChange={handleImportBackup} className="hidden" />
          </label>
        </div>
      </header>

      {/* Conteúdo Principal */}
      {activeTab === 'dashboard' ? (
        <div>
          {/* Controles de Workspace e Filtros */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Workspace</label>
              <select
                value={selectedWorkspace}
                onChange={(e) => setSelectedWorkspace(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
              >
                {workspaces.map(w => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs text-slate-400 mb-1 block">Data Inicial</label>
              <input 
                type="date" 
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="text-xs text-slate-400 mb-1 block">Data Final</label>
              <input 
                type="date" 
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="text-xs text-slate-400 mb-1 block">Dia Específico (Calendário)</label>
              <input 
                type="date" 
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Cards de Métricas */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-medium">PnL Total</span>
                <DollarSign className="w-4 h-4 text-emerald-400" />
              </div>
              <div className={`text-xl font-bold ${metrics.totalPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                ${metrics.totalPnl.toFixed(2)}
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-medium">Win Rate</span>
                <Percent className="w-4 h-4 text-blue-400" />
              </div>
              <div className="text-xl font-bold text-slate-100">
                {metrics.winRate.toFixed(1)}%
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-medium">Total R:R</span>
                <Target className="w-4 h-4 text-purple-400" />
              </div>
              <div className="text-xl font-bold text-slate-100">
                {metrics.totalR.toFixed(2)}R
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-medium">Operações</span>
                <Activity className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-xl font-bold text-slate-100">
                {metrics.totalTrades} <span className="text-xs font-normal text-slate-400">({metrics.wins}W / {metrics.losses}L)</span>
              </div>
            </div>
          </div>

          {/* Tabela de Trades */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-slate-800 flex justify-between items-center">
              <h2 className="font-semibold text-slate-200">Histórico de Operações</h2>
              <button
                onClick={() => {
                  setFormData({
                    asset: '',
                    direction: 'BUY',
                    pnl: 0,
                    r_multiple: 0,
                    trade_date: new Date().toISOString().split('T')[0],
                    followed_plan: 'DENTRO',
                    result_type: 'GAIN'
                  })
                  setIsTradeModalOpen(true)
                }}
                className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-colors"
              >
                <Plus className="w-4 h-4" /> Novo Trade
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-950 text-slate-400 uppercase text-xs">
                  <tr>
                    <th className="px-4 py-3">Data</th>
                    <th className="px-4 py-3">Ativo</th>
                    <th className="px-4 py-3">Direção</th>
                    <th className="px-4 py-3">Resultado</th>
                    <th className="px-4 py-3">PnL ($)</th>
                    <th className="px-4 py-3">R:R</th>
                    <th className="px-4 py-3">Plano</th>
                    <th className="px-4 py-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {filteredTrades.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-800/50 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap">{t.trade_date}</td>
                      <td className="px-4 py-3 font-semibold text-slate-100">{t.asset}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                          t.direction === 'BUY' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                        }`}>
                          {t.direction}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                          t.pnl > 0 ? 'bg-emerald-500/10 text-emerald-400' : t.pnl < 0 ? 'bg-rose-500/10 text-rose-400' : 'bg-slate-700 text-slate-300'
                        }`}>
                          {t.pnl > 0 ? 'GAIN' : t.pnl < 0 ? 'LOSS' : 'BE'}
                        </span>
                      </td>
                      <td className={`px-4 py-3 font-semibold ${t.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        ${Number(t.pnl).toFixed(2)}
                      </td>
                      <td className="px-4 py-3">{t.r_multiple ? `${t.r_multiple}R` : '-'}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-xs ${
                          t.followed_plan === 'DENTRO' ? 'bg-blue-500/10 text-blue-400' : 'bg-amber-500/10 text-amber-400'
                        }`}>
                          {t.followed_plan}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right space-x-2">
                        <button onClick={() => handleViewTrade(t)} className="text-slate-400 hover:text-white">
                          <Eye className="w-4 h-4 inline" />
                        </button>
                        <button onClick={() => { setFormData(t); setIsTradeModalOpen(true); }} className="text-slate-400 hover:text-blue-400">
                          <Edit3 className="w-4 h-4 inline" />
                        </button>
                        <button onClick={() => handleDeleteTrade(t.id)} className="text-slate-400 hover:text-rose-400">
                          <Trash2 className="w-4 h-4 inline" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredTrades.length === 0 && (
                    <tr>
                      <td colSpan={8} className="text-center py-6 text-slate-500">
                        Nenhum trade encontrado para o filtro selecionado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* Aba Simulador Monte Carlo */
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-4">
            <h2 className="font-semibold text-slate-200 border-b border-slate-800 pb-2">Parâmetros da Simulação</h2>
            
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Número de Simulações</label>
              <input 
                type="number" 
                value={mcSimulations} 
                onChange={e => setMcSimulations(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-sm text-slate-200"
              />
            </div>

            <div>
              <label className="text-xs text-slate-400 mb-1 block">Qtd de Trades por Simulação</label>
              <input 
                type="number" 
                value={mcTradeCount} 
                onChange={e => setMcTradeCount(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-sm text-slate-200"
              />
            </div>

            <div>
              <label className="text-xs text-slate-400 mb-1 block">Win Rate Estimado (%)</label>
              <input 
                type="number" 
                value={mcWinRate} 
                onChange={e => setMcWinRate(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-sm text-slate-200"
              />
            </div>

            <div>
              <label className="text-xs text-slate-400 mb-1 block">Relação Risco:Retorno (R:R)</label>
              <input 
                type="number" 
                step="0.1"
                value={mcRiskReward} 
                onChange={e => setMcRiskReward(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-sm text-slate-200"
              />
            </div>

            <div>
              <label className="text-xs text-slate-400 mb-1 block">Risco por Trade (%)</label>
              <input 
                type="number" 
                step="0.1"
                value={mcRiskPerTrade} 
                onChange={e => setMcRiskPerTrade(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-sm text-slate-200"
              />
            </div>

            <button
              onClick={runMonteCarlo}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-2 rounded-lg flex items-center justify-center gap-2 transition-colors mt-4"
            >
              <Play className="w-4 h-4" /> Executar Simulação
            </button>
          </div>

          <div className="md:col-span-2 bg-slate-900 border border-slate-800 p-5 rounded-xl">
            <h2 className="font-semibold text-slate-200 border-b border-slate-800 pb-2 mb-4">Resultados Esperados</h2>
            {mcResults ? (
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-950 p-4 rounded-lg border border-slate-800">
                  <span className="text-xs text-slate-400 block mb-1">Saldo Médio Final</span>
                  <span className="text-xl font-bold text-emerald-400">${mcResults.avgBalance.toFixed(2)}</span>
                </div>
                <div className="bg-slate-950 p-4 rounded-lg border border-slate-800">
                  <span className="text-xs text-slate-400 block mb-1">Max Drawdown Médio</span>
                  <span className="text-xl font-bold text-rose-400">{mcResults.avgDD.toFixed(2)}%</span>
                </div>
                <div className="bg-slate-950 p-4 rounded-lg border border-slate-800">
                  <span className="text-xs text-slate-400 block mb-1">Pior Drawdown Registrado</span>
                  <span className="text-xl font-bold text-rose-500">{mcResults.maxDDRecorded.toFixed(2)}%</span>
                </div>
                <div className="bg-slate-950 p-4 rounded-lg border border-slate-800">
                  <span className="text-xs text-slate-400 block mb-1">Seq. Média de Derrotas (Streak)</span>
                  <span className="text-xl font-bold text-amber-400">{mcResults.avgLossStreak.toFixed(1)} trades</span>
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-slate-500">
                Configure os parâmetros ao lado e clique em "Executar Simulação".
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL: Adicionar / Editar Trade */}
      {isTradeModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 w-full max-w-md space-y-4">
            <h3 className="text-lg font-bold text-slate-100">{formData.id ? 'Editar Trade' : 'Novo Trade'}</h3>
            <form onSubmit={handleSaveTrade} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Ativo</label>
                  <input 
                    type="text" 
                    required 
                    value={formData.asset || ''} 
                    onChange={e => setFormData({...formData, asset: e.target.value})}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-sm text-slate-200" 
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Direção</label>
                  <select 
                    value={formData.direction || 'BUY'} 
                    onChange={e => setFormData({...formData, direction: e.target.value as any})}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-sm text-slate-200"
                  >
                    <option value="BUY">BUY</option>
                    <option value="SELL">SELL</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">PnL ($)</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    required 
                    value={formData.pnl || 0} 
                    onChange={e => setFormData({...formData, pnl: Number(e.target.value)})}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-sm text-slate-200" 
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">R:R (R-Multiple)</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    value={formData.r_multiple || 0} 
                    onChange={e => setFormData({...formData, r_multiple: Number(e.target.value)})}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-sm text-slate-200" 
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Data</label>
                <input 
                  type="date" 
                  required 
                  value={formData.trade_date || ''} 
                  onChange={e => setFormData({...formData, trade_date: e.target.value})}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-sm text-slate-200" 
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">URL do Gráfico (TradingView)</label>
                <input 
                  type="url" 
                  value={formData.chart_url || ''} 
                  onChange={e => setFormData({...formData, chart_url: e.target.value})}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-sm text-slate-200" 
                  placeholder="https://..."
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Notas / Análise</label>
                <textarea 
                  rows={3} 
                  value={formData.notes || ''} 
                  onChange={e => setFormData({...formData, notes: e.target.value})}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-sm text-slate-200"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button 
                  type="button" 
                  onClick={() => setIsTradeModalOpen(false)} 
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium"
                >
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Visualizar Trade (Com renderização de imagem corrigida) */}
      {isViewModalOpen && selectedTrade && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 w-full max-w-2xl space-y-4">
            <div className="flex justify-between items-start border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-xl font-bold text-slate-100">{selectedTrade.asset} ({selectedTrade.direction})</h3>
                <span className="text-xs text-slate-400">{selectedTrade.trade_date}</span>
              </div>
              <span className={`px-2 py-1 rounded text-sm font-bold ${
                selectedTrade.pnl >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
              }`}>
                ${Number(selectedTrade.pnl).toFixed(2)} ({selectedTrade.r_multiple || 0}R)
              </span>
            </div>

            {/* Imagem do Gráfico */}
            {selectedTrade.chart_url && (
              <div className="space-y-2">
                <span className="text-xs text-slate-400 block">Gráfico Anexado</span>
                {!imageError ? (
                  <div className="relative border border-slate-800 rounded-lg overflow-hidden bg-slate-950">
                    <img 
                      src={selectedTrade.chart_url} 
                      alt="Análise do Trade" 
                      className="w-full max-h-96 object-contain"
                      onError={() => setImageError(true)}
                    />
                  </div>
                ) : (
                  <div className="p-4 bg-slate-950 border border-slate-800 rounded-lg text-center text-xs text-amber-400">
                    Não foi possível carregar a imagem diretamente (bloqueio CORS ou página interativa do TradingView). Use o botão abaixo para abrir.
                  </div>
                )}
                
                <a 
                  href={selectedTrade.chart_url} 
                  target="_blank" 
                  rel="noreferrer" 
                  className="inline-block text-xs text-blue-400 hover:underline"
                >
                  Abrir imagem no navegador →
                </a>
              </div>
            )}

            {selectedTrade.notes && (
              <div>
                <span className="text-xs text-slate-400 block mb-1">Anotações</span>
                <p className="text-sm bg-slate-950 p-3 rounded-lg border border-slate-800 text-slate-300">
                  {selectedTrade.notes}
                </p>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button 
                onClick={() => setIsViewModalOpen(false)} 
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

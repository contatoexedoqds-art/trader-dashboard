'use client';

import React, { useState, useEffect, useMemo } from 'react';

// --- INTERFACES & TIPAGENS ---
export interface Trade {
  id: string;
  workspaceId: string;
  date: string;
  asset: string;
  type: 'LONG' | 'SHORT';
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  pnl: number;
  resultR: number;
  setup: string;
  compliant: boolean;
  chartUrl?: string;
}

export interface Workspace {
  id: string;
  name: string;
  initialCapital: number;
}

export interface MonteCarloResults {
  paths: number[][];
  maxDrawdown: number;
  avgMaxDrawdown: number;
  expectedReturn: number;
}

export default function Page() {
  // --- ESTADOS DE WORKSPACE E TRADES ---
  const [workspaces, setWorkspaces] = useState<Workspace[]>([
    { id: 'ws-1', name: 'Mesa Proprietária ($5k)', initialCapital: 5000 },
    { id: 'ws-2', name: 'Conta Pessoal', initialCapital: 1000 },
  ]);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>('ws-1');

  const [trades, setTrades] = useState<Trade[]>([
    {
      id: 't-1',
      workspaceId: 'ws-1',
      date: '2026-04-10',
      asset: 'EURUSD',
      type: 'LONG',
      entryPrice: 1.0850,
      stopLoss: 1.0830,
      takeProfit: 1.0910,
      pnl: 150,
      resultR: 3.0,
      setup: 'SMC - Liquidity Sweep',
      compliant: true,
      chartUrl: 'https://www.tradingview.com/x/example1/',
    },
    {
      id: 't-2',
      workspaceId: 'ws-1',
      date: '2026-04-12',
      asset: 'GBPUSD',
      type: 'SHORT',
      entryPrice: 1.2650,
      stopLoss: 1.2670,
      takeProfit: 1.2590,
      pnl: -50,
      resultR: -1.0,
      setup: 'SMC - Order Block',
      compliant: true,
      chartUrl: '',
    },
    {
      id: 't-3',
      workspaceId: 'ws-1',
      date: '2026-04-15',
      asset: 'XAUUSD',
      type: 'LONG',
      entryPrice: 2350,
      stopLoss: 2340,
      takeProfit: 2380,
      pnl: 300,
      resultR: 3.0,
      setup: 'SMC - FVG Refinement',
      compliant: true,
    },
  ]);

  // --- ESTADOS DE FILTRO E PAGINAÇÃO ---
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [selectedSetup, setSelectedSetup] = useState<string>('ALL');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const itemsPerPage = 5;

  // Reset automático da página ao alterar qualquer filtro
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedWorkspaceId, startDate, endDate, selectedSetup]);

  // --- ESTADOS DO FORMULÁRIO DE NOVA OPERAÇÃO ---
  const [newAsset, setNewAsset] = useState('EURUSD');
  const [newType, setNewType] = useState<'LONG' | 'SHORT'>('LONG');
  const [newEntry, setNewEntry] = useState('');
  const [newSL, setNewSL] = useState('');
  const [newTP, setNewTP] = useState('');
  const [newPnl, setNewPnl] = useState('');
  const [newResultR, setNewResultR] = useState('');
  const [newSetup, setNewSetup] = useState('SMC - Order Block');
  const [newCompliant, setNewCompliant] = useState(true);
  const [newChartUrl, setNewChartUrl] = useState('');

  // --- CONTROLE DE ERRO NAS IMAGENS TRADINGVIEW ---
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});

  const handleImageError = (tradeId: string) => {
    setImageErrors((prev) => ({ ...prev, [tradeId]: true }));
  };

  // --- ESTADOS DO SIMULADOR DE MONTE CARLO ---
  const [mcInitialCapital, setMcInitialCapital] = useState('5000');
  const [mcRiskPercent, setMcRiskPercent] = useState('0.25');
  const [mcTradeCount, setMcTradeCount] = useState('100');
  const [mcSimulations, setMcSimulations] = useState('100');
  const [mcRiskMode, setMcRiskMode] = useState<'percent' | 'risk'>('percent');
  const [mcResults, setMcResults] = useState<MonteCarloResults | null>(null);

  // --- FILTRAGEM DE TRADES ---
  const filteredTrades = useMemo(() => {
    return trades.filter((t) => {
      if (t.workspaceId !== selectedWorkspaceId) return false;
      if (startDate && t.date < startDate) return false;
      if (endDate && t.date > endDate) return false;
      if (selectedSetup !== 'ALL' && t.setup !== selectedSetup) return false;
      return true;
    });
  }, [trades, selectedWorkspaceId, startDate, endDate, selectedSetup]);

  const paginatedTrades = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredTrades.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredTrades, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredTrades.length / itemsPerPage) || 1;

  // --- CÁLCULO DE MÉTRICAS ---
  const stats = useMemo(() => {
    const totalTrades = filteredTrades.length;
    if (totalTrades === 0) {
      return { totalTrades: 0, winRate: 0, totalPnl: 0, totalR: 0, profitFactor: 0, avgR: 0 };
    }

    const wins = filteredTrades.filter((t) => t.pnl > 0);
    const losses = filteredTrades.filter((t) => t.pnl < 0);
    const winRate = (wins.length / totalTrades) * 100;
    const totalPnl = filteredTrades.reduce((acc, t) => acc + t.pnl, 0);
    const totalR = filteredTrades.reduce((acc, t) => acc + t.resultR, 0);

    const grossProfit = wins.reduce((acc, t) => acc + t.pnl, 0);
    const grossLoss = Math.abs(losses.reduce((acc, t) => acc + t.pnl, 0));
    const profitFactor = grossLoss === 0 ? grossProfit : grossProfit / grossLoss;

    return {
      totalTrades,
      winRate,
      totalPnl,
      totalR,
      profitFactor,
      avgR: totalR / totalTrades,
    };
  }, [filteredTrades]);

  const availableSetups = useMemo(() => {
    const set = new Set(trades.map((t) => t.setup));
    return Array.from(set);
  }, [trades]);

  // --- ADICIONAR TRADE ---
  const handleAddTrade = (e: React.FormEvent) => {
    e.preventDefault();
    const trade: Trade = {
      id: `t-${Date.now()}`,
      workspaceId: selectedWorkspaceId,
      date: new Date().toISOString().split('T')[0],
      asset: newAsset,
      type: newType,
      entryPrice: parseFloat(newEntry) || 0,
      stopLoss: parseFloat(newSL) || 0,
      takeProfit: parseFloat(newTP) || 0,
      pnl: parseFloat(newPnl) || 0,
      resultR: parseFloat(newResultR) || 0,
      setup: newSetup,
      compliant: newCompliant,
      chartUrl: newChartUrl.trim() || undefined,
    };

    setTrades([trade, ...trades]);
    setNewPnl('');
    setNewResultR('');
    setNewChartUrl('');
  };

  // --- SIMULAÇÃO MONTE CARLO ---
  const runMonteCarloSimulation = () => {
    const initialCap = parseFloat(mcInitialCapital) || 5000;
    const riskPct = parseFloat(mcRiskPercent) || 0.25;
    const numTrades = parseInt(mcTradeCount, 10) || 100;
    const numSims = parseInt(mcSimulations, 10) || 100;

    if (filteredTrades.length === 0) {
      alert('Nenhuma operação registrada no filtro atual para realizar a simulação.');
      return;
    }

    const returnsR = filteredTrades.map((t) => t.resultR || 0);
    const paths: number[][] = [];
    let maxDDGlobal = 0;
    let totalMaxDD = 0;
    let totalReturnPct = 0;

    for (let s = 0; s < numSims; s++) {
      const path: number[] = [initialCap];
      let currentCap = initialCap;
      let peakCap = initialCap;
      let maxDDSim = 0;

      for (let t = 0; t < numTrades; t++) {
        const randomR = returnsR[Math.floor(Math.random() * returnsR.length)];

        const riskAmount =
          mcRiskMode === 'percent'
            ? currentCap * (riskPct / 100)
            : initialCap * (riskPct / 100);

        const pnl = randomR * riskAmount;
        currentCap += pnl;
        path.push(currentCap);

        if (currentCap > peakCap) {
          peakCap = currentCap;
        }

        const drawDown = peakCap > 0 ? ((peakCap - currentCap) / peakCap) * 100 : 0;
        if (drawDown > maxDDSim) {
          maxDDSim = drawDown;
        }
      }

      if (maxDDSim > maxDDGlobal) {
        maxDDGlobal = maxDDSim;
      }

      totalMaxDD += maxDDSim;
      totalReturnPct += ((currentCap - initialCap) / initialCap) * 100;
      paths.push(path);
    }

    const avgMaxDrawdown = totalMaxDD / numSims;

    setMcResults({
      paths,
      maxDrawdown: maxDDGlobal,
      avgMaxDrawdown,
      expectedReturn: totalReturnPct / numSims,
    });
  };

  // --- EXPORTAR E IMPORTAR DATA ---
  const exportData = () => {
    const data = JSON.stringify({ workspaces, trades }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trading_journal_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
  };

  const importData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileReader = new FileReader();
    if (e.target.files && e.target.files[0]) {
      fileReader.readAsText(e.target.files[0], 'UTF-8');
      fileReader.onload = (event) => {
        try {
          const parsed = JSON.parse(event.target?.result as string);
          if (parsed.workspaces && parsed.trades) {
            setWorkspaces(parsed.workspaces);
            setTrades(parsed.trades);
            alert('Dados importados com sucesso!');
          }
        } catch (err) {
          alert('Erro ao importar arquivo JSON.');
        }
      };
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* HEADER */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">Dashboard & Diário de Trade</h1>
            <p className="text-sm text-slate-400">Análise de Desempenho e Simulação de Monte Carlo</p>
          </div>

          <div className="flex items-center gap-3">
            <select
              value={selectedWorkspaceId}
              onChange={(e) => setSelectedWorkspaceId(e.target.value)}
              className="bg-slate-900 border border-slate-700 text-slate-200 text-sm rounded-lg p-2.5 focus:ring-emerald-500 focus:border-emerald-500"
            >
              {workspaces.map((ws) => (
                <option key={ws.id} value={ws.id}>
                  {ws.name}
                </option>
              ))}
            </select>

            <button
              onClick={exportData}
              className="bg-slate-800 hover:bg-slate-700 text-xs px-3 py-2.5 rounded-lg border border-slate-700 transition"
            >
              Exportar JSON
            </button>
            <label className="bg-slate-800 hover:bg-slate-700 text-xs px-3 py-2.5 rounded-lg border border-slate-700 cursor-pointer transition">
              Importar JSON
              <input type="file" accept=".json" onChange={importData} className="hidden" />
            </label>
          </div>
        </div>

        {/* MÉTRICAS */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <span className="text-xs text-slate-400 block">Total de Trades</span>
            <span className="text-2xl font-bold text-white">{stats.totalTrades}</span>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <span className="text-xs text-slate-400 block">Taxa de Acerto</span>
            <span className="text-2xl font-bold text-emerald-400">{stats.winRate.toFixed(1)}%</span>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <span className="text-xs text-slate-400 block">Resultado Financeiro</span>
            <span className={`text-2xl font-bold ${stats.totalPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              ${stats.totalPnl.toFixed(2)}
            </span>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <span className="text-xs text-slate-400 block">Retorno Acumulado em R</span>
            <span className={`text-2xl font-bold ${stats.totalR >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {stats.totalR >= 0 ? `+${stats.totalR.toFixed(2)}R` : `${stats.totalR.toFixed(2)}R`}
            </span>
          </div>
        </div>

        {/* MONTE CARLO */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-white">Simulador de Monte Carlo</h2>
              <p className="text-xs text-slate-400">
                Projeta trajetórias de equidade com amostragem aleatória do seu histórico.
              </p>
            </div>
            <button
              onClick={runMonteCarloSimulation}
              className="bg-emerald-600 hover:bg-emerald-500 font-medium text-xs px-5 py-2.5 rounded-lg text-white transition"
            >
              Simular Projeções
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-xs">
            <div>
              <label className="text-slate-400 block mb-1">Capital Inicial ($)</label>
              <input
                type="number"
                value={mcInitialCapital}
                onChange={(e) => setMcInitialCapital(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-slate-200"
              />
            </div>

            <div>
              <label className="text-slate-400 block mb-1">Risco por Trade (%)</label>
              <input
                type="number"
                step="0.01"
                value={mcRiskPercent}
                onChange={(e) => setMcRiskPercent(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-slate-200"
              />
            </div>

            <div>
              <label className="text-slate-400 block mb-1">Nº de Trades</label>
              <input
                type="number"
                value={mcTradeCount}
                onChange={(e) => setMcTradeCount(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-slate-200"
              />
            </div>

            <div>
              <label className="text-slate-400 block mb-1">Nº de Simulações</label>
              <input
                type="number"
                value={mcSimulations}
                onChange={(e) => setMcSimulations(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-slate-200"
              />
            </div>

            <div>
              <label className="text-slate-400 block mb-1">Cálculo de Risco</label>
              <div className="flex gap-1 bg-slate-950 p-1 rounded border border-slate-800">
                <button
                  type="button"
                  onClick={() => setMcRiskMode('percent')}
                  className={`flex-1 py-1 rounded text-[10px] ${
                    mcRiskMode === 'percent' ? 'bg-emerald-600 text-white' : 'text-slate-400'
                  }`}
                >
                  Composto
                </button>
                <button
                  type="button"
                  onClick={() => setMcRiskMode('risk')}
                  className={`flex-1 py-1 rounded text-[10px] ${
                    mcRiskMode === 'risk' ? 'bg-emerald-600 text-white' : 'text-slate-400'
                  }`}
                >
                  Fixo
                </button>
              </div>
            </div>
          </div>

          {mcResults && (
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-slate-950 p-4 rounded-lg border border-slate-800">
                  <span className="text-xs text-slate-400 block">Drawdown Máximo Global</span>
                  <span className="text-xl font-bold text-rose-400">{mcResults.maxDrawdown.toFixed(2)}%</span>
                </div>

                <div className="bg-slate-950 p-4 rounded-lg border border-slate-800">
                  <span className="text-xs text-slate-400 block">Média Máxima de Drawdown</span>
                  <span className="text-xl font-bold text-amber-400">{mcResults.avgMaxDrawdown.toFixed(2)}%</span>
                </div>

                <div className="bg-slate-950 p-4 rounded-lg border border-slate-800">
                  <span className="text-xs text-slate-400 block">Retorno Médio Esperado</span>
                  <span className="text-xl font-bold text-emerald-400">{mcResults.expectedReturn.toFixed(2)}%</span>
                </div>
              </div>

              <div className="h-48 w-full bg-slate-950 rounded-lg p-2 border border-slate-800 flex items-center justify-center relative overflow-hidden">
                <svg className="w-full h-full" viewBox="0 0 1000 300" preserveAspectRatio="none">
                  {mcResults.paths.slice(0, 30).map((path, idx) => {
                    const minVal = Math.min(...path);
                    const maxVal = Math.max(...path);
                    const range = maxVal - minVal || 1;

                    const points = path
                      .map((val, tIdx) => {
                        const x = (tIdx / (path.length - 1)) * 1000;
                        const y = 300 - ((val - minVal) / range) * 280 - 10;
                        return `${x},${y}`;
                      })
                      .join(' ');

                    return (
                      <polyline
                        key={idx}
                        fill="none"
                        stroke={idx === 0 ? '#10b981' : '#334155'}
                        strokeWidth={idx === 0 ? '2' : '0.8'}
                        opacity={idx === 0 ? '1' : '0.4'}
                        points={points}
                      />
                    );
                  })}
                </svg>
              </div>
            </div>
          )}
        </div>

        {/* REGISTRO DE TRADE */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Registrar Nova Operação</h2>
          <form onSubmit={handleAddTrade} className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
            <div>
              <label className="text-slate-400 block mb-1">Ativo</label>
              <input
                type="text"
                value={newAsset}
                onChange={(e) => setNewAsset(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-slate-200 uppercase"
                required
              />
            </div>

            <div>
              <label className="text-slate-400 block mb-1">Tipo</label>
              <select
                value={newType}
                onChange={(e) => setNewType(e.target.value as 'LONG' | 'SHORT')}
                className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-slate-200"
              >
                <option value="LONG">LONG (Compra)</option>
                <option value="SHORT">SHORT (Venda)</option>
              </select>
            </div>

            <div>
              <label className="text-slate-400 block mb-1">Resultado Financeiro ($)</label>
              <input
                type="number"
                step="0.01"
                placeholder="Ex: 150 ou -50"
                value={newPnl}
                onChange={(e) => setNewPnl(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-slate-200"
                required
              />
            </div>

            <div>
              <label className="text-slate-400 block mb-1">Resultado em R</label>
              <input
                type="number"
                step="0.01"
                placeholder="Ex: 3.0 ou -1.0"
                value={newResultR}
                onChange={(e) => setNewResultR(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-slate-200"
                required
              />
            </div>

            <div>
              <label className="text-slate-400 block mb-1">Setup / Estratégia</label>
              <input
                type="text"
                value={newSetup}
                onChange={(e) => setNewSetup(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-slate-200"
              />
            </div>

            <div>
              <label className="text-slate-400 block mb-1">Link do Gráfico (TradingView)</label>
              <input
                type="url"
                placeholder="https://www.tradingview.com/x/..."
                value={newChartUrl}
                onChange={(e) => setNewChartUrl(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-slate-200"
              />
            </div>

            <div className="flex items-center gap-2 pt-5">
              <input
                type="checkbox"
                id="compliantCheck"
                checked={newCompliant}
                onChange={(e) => setNewCompliant(e.target.checked)}
                className="rounded bg-slate-950 border-slate-800 text-emerald-600 focus:ring-emerald-500"
              />
              <label htmlFor="compliantCheck" className="text-slate-300 cursor-pointer">
                Seguiu o Plano?
              </label>
            </div>

            <div className="pt-4">
              <button
                type="submit"
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-medium py-2 rounded transition"
              >
                Salvar Operação
              </button>
            </div>
          </form>
        </div>

        {/* TABELA DE HISTÓRICO */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <h2 className="text-lg font-semibold text-white">Histórico de Operações</h2>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded p-2 text-slate-300"
              />
              <span className="text-slate-600">até</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded p-2 text-slate-300"
              />

              <select
                value={selectedSetup}
                onChange={(e) => setSelectedSetup(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded p-2 text-slate-300"
              >
                <option value="ALL">Todos os Setups</option>
                {availableSetups.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300 border-collapse">
              <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="p-3">Data</th>
                  <th className="p-3">Ativo</th>
                  <th className="p-3">Tipo</th>
                  <th className="p-3">Setup</th>
                  <th className="p-3">Resultado (R)</th>
                  <th className="p-3">PnL ($)</th>
                  <th className="p-3">Plano</th>
                  <th className="p-3">Gráfico</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {paginatedTrades.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-4 text-center text-slate-500">
                      Nenhuma operação registrada para os filtros aplicados.
                    </td>
                  </tr>
                ) : (
                  paginatedTrades.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-800/50">
                      <td className="p-3">{t.date}</td>
                      <td className="p-3 font-semibold text-white">{t.asset}</td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            t.type === 'LONG' ? 'bg-emerald-950 text-emerald-400' : 'bg-rose-950 text-rose-400'
                          }`}
                        >
                          {t.type}
                        </span>
                      </td>
                      <td className="p-3">{t.setup}</td>
                      <td className={`p-3 font-bold ${t.resultR >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {t.resultR >= 0 ? `+${t.resultR}R` : `${t.resultR}R`}
                      </td>
                      <td className={`p-3 font-bold ${t.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        ${t.pnl.toFixed(2)}
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] ${
                            t.compliant ? 'bg-emerald-950 text-emerald-400' : 'bg-rose-950 text-rose-400'
                          }`}
                        >
                          {t.compliant ? 'OK' : 'Fora do Plano'}
                        </span>
                      </td>
                      <td className="p-3">
                        {t.chartUrl ? (
                          <div className="space-y-1">
                            <a
                              href={t.chartUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-emerald-400 hover:underline block"
                            >
                              Ver Link
                            </a>
                            {imageErrors[t.id] ? (
                              <div className="text-[10px] text-rose-400 font-medium">
                                Link indisponível
                              </div>
                            ) : (
                              <img
                                src={t.chartUrl}
                                alt="Gráfico"
                                className="w-12 h-8 object-cover rounded border border-slate-700 hidden"
                                onError={() => handleImageError(t.id)}
                              />
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-600">-</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between pt-2 text-xs text-slate-400">
            <span>
              Página {currentPage} de {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                className="px-3 py-1 bg-slate-950 border border-slate-800 rounded disabled:opacity-50 hover:bg-slate-800 transition"
              >
                Anterior
              </button>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                className="px-3 py-1 bg-slate-950 border border-slate-800 rounded disabled:opacity-50 hover:bg-slate-800 transition"
              >
                Próxima
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

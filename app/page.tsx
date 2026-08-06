export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 text-center">
      <div className="max-w-2xl bg-slate-900 border border-slate-800 rounded-xl p-8 shadow-2xl">
        <h1 className="text-3xl font-bold text-emerald-400 mb-2">
          Dashboard Trader Universal 🚀
        </h1>
        <p className="text-slate-400 mb-6">
          Sua plataforma de gestão de risco, diário operacional e análise estatística está online!
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
          <div className="bg-slate-950 p-4 rounded-lg border border-slate-800">
            <span className="text-xs text-slate-500 uppercase">Status do Banco</span>
            <p className="text-sm font-semibold text-emerald-400">Conectado ao Supabase</p>
          </div>
          <div className="bg-slate-950 p-4 rounded-lg border border-slate-800">
            <span className="text-xs text-slate-500 uppercase">Hospedagem</span>
            <p className="text-sm font-semibold text-blue-400">Vercel Cloud</p>
          </div>
          <div className="bg-slate-950 p-4 rounded-lg border border-slate-800">
            <span className="text-xs text-slate-500 uppercase">Versão</span>
            <p className="text-sm font-semibold text-purple-400">1.0.0 MVP</p>
          </div>
        </div>
      </div>
    </main>
  )
}
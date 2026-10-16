import { Database, KeyRound, RefreshCw, SquareTerminal } from 'lucide-react'
import Logo from '../components/common/Logo.jsx'

const steps = [
  {
    icon: KeyRound,
    title: '1. Configure as variáveis de ambiente',
    code: 'VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co\nVITE_SUPABASE_ANON_KEY=sua-chave-anon',
    description: 'Crie um arquivo .env na raiz do projeto com as chaves do seu projeto Supabase.',
  },
  {
    icon: Database,
    title: '2. Crie as tabelas',
    code: 'supabase/schema.sql',
    description:
      'Abra o SQL Editor do Supabase e execute o conteúdo de supabase/schema.sql (tabelas, índices, triggers e RLS).',
  },
  {
    icon: RefreshCw,
    title: '3. Reinicie o servidor',
    code: 'npm run dev',
    description: 'As variáveis VITE_ são lidas na inicialização, então reinicie o servidor de desenvolvimento.',
  },
]

export default function SetupPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="card w-full max-w-2xl p-6 sm:p-8">
        <Logo className="mb-6" />
        <div className="flex items-center gap-2 text-amber-300">
          <SquareTerminal size={18} />
          <h1 className="text-lg font-bold text-white">Configuração necessária</h1>
        </div>
        <p className="mt-2 text-sm text-slate-400">
          O Terada Finance usa o Supabase como banco de dados. Configure o projeto para começar.
        </p>

        <div className="mt-6 space-y-4">
          {steps.map((step) => (
            <div key={step.title} className="rounded-xl border border-brand-border bg-brand-elevated/40 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <step.icon size={16} className="text-brand-redBright" />
                {step.title}
              </div>
              <p className="mt-1.5 text-xs text-slate-400">{step.description}</p>
              <pre className="mt-2 overflow-x-auto rounded-lg bg-black/40 px-3 py-2 text-xs text-emerald-300">
                {step.code}
              </pre>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

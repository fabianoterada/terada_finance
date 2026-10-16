import { useState } from 'react'
import { LogIn, Mail, Lock, UserPlus } from 'lucide-react'
import clsx from 'clsx'
import Logo from '../components/common/Logo.jsx'
import Spinner from '../components/common/Spinner.jsx'
import { useAuth } from '../context/AuthContext.jsx'

function translateAuthError(error) {
  const message = error?.message ?? 'Não foi possível concluir a operação.'
  if (message.includes('Invalid login credentials')) return 'E-mail ou senha inválidos.'
  if (message.includes('Email not confirmed')) return 'E-mail ainda não confirmado. Verifique sua caixa de entrada.'
  if (message.includes('User already registered')) return 'Este e-mail já está cadastrado.'
  if (message.includes('Password should be at least')) return 'A senha deve ter ao menos 6 caracteres.'
  if (message.includes('Unable to validate email')) return 'Endereço de e-mail inválido.'
  if (message.includes('rate limit') || message.includes('too many')) return 'Muitas tentativas. Aguarde alguns instantes.'
  return message
}

export default function LoginPage() {
  const { signIn, signUp } = useAuth()
  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState('')
  const [info, setInfo] = useState('')

  async function handleSubmit(event) {
    event.preventDefault()
    if (!email.trim() || !password) {
      setFormError('Informe e-mail e senha.')
      return
    }
    setBusy(true)
    setFormError('')
    setInfo('')
    try {
      if (mode === 'signin') {
        await signIn(email.trim(), password)
      } else {
        const data = await signUp(email.trim(), password)
        if (!data.session) {
          setInfo(
            'Cadastro realizado! Confirme seu e-mail (se a confirmação estiver ativa) e faça login.',
          )
          setMode('signin')
        }
      }
    } catch (error) {
      setFormError(translateAuthError(error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen items-stretch">
      <div className="hidden flex-1 flex-col justify-between border-r border-brand-border bg-brand-surface/50 p-10 lg:flex">
        <Logo />
        <div>
          <h1 className="text-4xl font-extrabold leading-tight text-white">
            Controle total das suas <span className="text-brand-redBright">despesas</span>.
          </h1>
          <p className="mt-4 max-w-md text-slate-400">
            Cadastre categorias, lance despesas fixas e variáveis, acompanhe indicadores e compare a
            evolução mês a mês — tudo sincronizado com o Supabase.
          </p>
        </div>
        <p className="text-xs text-slate-600">Terada Finance · Gestão de gastos pessoais</p>
      </div>

      <div className="flex w-full flex-col items-center justify-center px-5 py-10 lg:max-w-xl">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <Logo />
          </div>

          <h2 className="text-2xl font-bold text-white">
            {mode === 'signin' ? 'Entrar na sua conta' : 'Criar uma conta'}
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            {mode === 'signin'
              ? 'Acesse para gerenciar seus lançamentos.'
              : 'Cadastre-se para começar a organizar seus gastos.'}
          </p>

          <div className="mt-6 grid grid-cols-2 rounded-xl border border-brand-border bg-brand-elevated/40 p-1">
            <button
              type="button"
              onClick={() => {
                setMode('signin')
                setFormError('')
                setInfo('')
              }}
              className={clsx(
                'rounded-lg py-2 text-sm font-semibold transition',
                mode === 'signin' ? 'bg-brand-red text-white' : 'text-slate-400 hover:text-white',
              )}
            >
              Entrar
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('signup')
                setFormError('')
                setInfo('')
              }}
              className={clsx(
                'rounded-lg py-2 text-sm font-semibold transition',
                mode === 'signup' ? 'bg-brand-red text-white' : 'text-slate-400 hover:text-white',
              )}
            >
              Criar conta
            </button>
          </div>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label className="label" htmlFor="login-email">
                E-mail
              </label>
              <div className="relative">
                <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  className="input pl-10"
                  placeholder="voce@email.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </div>
            </div>
            <div>
              <label className="label" htmlFor="login-password">
                Senha
              </label>
              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  id="login-password"
                  type="password"
                  autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                  className="input pl-10"
                  placeholder="••••••••"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </div>
            </div>

            {formError && (
              <p className="rounded-lg border border-brand-redDark/50 bg-brand-redDark/20 px-3 py-2 text-sm text-brand-redBright">
                {formError}
              </p>
            )}
            {info && (
              <p className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-400">
                {info}
              </p>
            )}

            <button type="submit" className="btn-primary w-full" disabled={busy}>
              {busy ? (
                <Spinner size={18} className="border-white/40 border-t-white" />
              ) : mode === 'signin' ? (
                <LogIn size={16} />
              ) : (
                <UserPlus size={16} />
              )}
              {mode === 'signin' ? 'Entrar' : 'Criar conta'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

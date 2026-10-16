import { useState } from 'react'
import { LogIn, Mail, Lock, Eye, EyeOff } from 'lucide-react'
import Spinner from '../components/common/Spinner.jsx'
import { useAuth } from '../context/AuthContext.jsx'

function translateAuthError(error) {
  const message = error?.message ?? 'Não foi possível concluir a operação.'
  if (message.includes('Invalid login credentials')) return 'E-mail ou senha inválidos.'
  if (message.includes('Email not confirmed')) return 'E-mail ainda não confirmado. Verifique sua caixa de entrada.'
  if (message.includes('Unable to validate email')) return 'Endereço de e-mail inválido.'
  if (message.includes('rate limit') || message.includes('too many')) return 'Muitas tentativas. Aguarde alguns instantes.'
  return message
}

export default function LoginPage() {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState('')
  const [info, setInfo] = useState('')

  async function handleSubmit(event) {
    event.preventDefault()
    setInfo('')
    if (!email.trim() || !password) {
      setFormError('Informe e-mail e senha.')
      return
    }
    setBusy(true)
    setFormError('')
    try {
      await signIn(email.trim(), password)
    } catch (error) {
      setFormError(translateAuthError(error))
    } finally {
      setBusy(false)
    }
  }

  function handleForgot() {
    setFormError('')
    setInfo('Para redefinir sua senha, solicite ao administrador do sistema.')
  }

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-slate-900">
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: "url('/fundo_terada.jpg')",
          backgroundSize: 'cover',
          backgroundPosition: 'right center',
          backgroundRepeat: 'no-repeat',
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-r from-slate-950/60 via-slate-950/20 to-transparent" />

      <div className="relative z-10 flex min-h-screen items-center justify-center px-5 py-10 lg:justify-start lg:pl-24">
        <div className="w-full max-w-md animate-scale-in rounded-3xl border border-white/60 bg-white/85 p-7 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.6)] backdrop-blur-xl sm:p-9">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-brand-red/30 bg-white shadow-glow">
              <img
                src="/logo_transparente.jpeg"
                alt="Terada Finance"
                className="h-full w-full object-contain p-1"
                onError={(event) => {
                  event.currentTarget.style.display = 'none'
                }}
              />
            </span>
            <div className="leading-tight">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-brand-red">
                Terada Finance
              </p>
              <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Acessar Sistema</h1>
            </div>
          </div>

          <p className="mt-5 text-sm text-slate-600">
            Bem-vindo! Informe seu e-mail ou usuário e a senha para entrar.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-5">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="login-email">
                E-mail ou Usuário
              </label>
              <div className="relative">
                <Mail size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  id="login-email"
                  type="text"
                  autoComplete="username"
                  className="input-light pl-10"
                  placeholder="voce@email.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="login-password">
                Senha
              </label>
              <div className="relative">
                <Lock size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  className="input-light pl-10 pr-10"
                  placeholder="••••••••"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-600"
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <div className="mt-2 flex justify-end">
                <button
                  type="button"
                  onClick={handleForgot}
                  className="text-xs font-medium text-slate-500 transition hover:text-brand-red"
                >
                  Esqueci minha senha
                </button>
              </div>
            </div>

            {formError && (
              <p className="rounded-xl border border-brand-red/30 bg-brand-red/10 px-3 py-2 text-sm text-brand-red">
                {formError}
              </p>
            )}
            {info && (
              <p className="rounded-xl border border-slate-300 bg-slate-100/70 px-3 py-2 text-sm text-slate-600">
                {info}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-red py-3 text-sm font-semibold text-white shadow-glow transition hover:bg-brand-redBright active:scale-[0.99] disabled:opacity-60"
            >
              {busy ? (
                <Spinner size={18} className="border-white/40 border-t-white" />
              ) : (
                <LogIn size={16} />
              )}
              Entrar
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-slate-400">
            Acesso restrito. O cadastro de novos usuários é feito pelo administrador.
          </p>
        </div>
      </div>
    </div>
  )
}

import { useEffect, useState } from 'react'
import { LogIn, UserPlus, Wallet } from 'lucide-react'
import Spinner from '../components/common/Spinner.jsx'
import { useAuth } from '../context/AuthContext.jsx'

const REMEMBER_KEY = 'terada_fi…mail'

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

function LogoMark() {
  const [failed, setFailed] = useState(false)

  return (
    <div className="flex flex-col items-center text-center">
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-md border border-login-borderSoft bg-login-primarySoft">
          {failed ? (
            <Wallet size={17} className="text-login-primary" aria-hidden="true" />
          ) : (
            <img
              src="/logo_transparente.jpeg"
              alt=""
              onError={() => setFailed(true)}
              className="h-full w-full object-contain p-0.5"
            />
          )}
        </span>
        <p className="text-lg font-bold leading-none tracking-tight">
          <span className="text-login-heading">TERADA</span>{' '}
          <span className="text-login-primary">FINANCE</span>
        </p>
      </div>
      <p className="mt-1.5 text-xs uppercase tracking-wide text-login-muted">Controle de Despesas</p>
    </div>
  )
}

export default function LoginPage() {
  const { signIn, signUp, resetPassword } = useAuth()
  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(false)
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState('')
  const [info, setInfo] = useState('')

  useEffect(() => {
    const saved = window.localStorage.getItem(REMEMBER_KEY)
    if (saved) {
      setEmail(saved)
      setRemember(true)
    }
  }, [])

  function switchMode(nextMode) {
    setMode(nextMode)
    setFormError('')
    setInfo('')
  }

  function persistRememberChoice() {
    if (remember) {
      window.localStorage.setItem(REMEMBER_KEY, email.trim())
    } else {
      window.localStorage.removeItem(REMEMBER_KEY)
    }
  }

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
        persistRememberChoice()
      } else {
        const data = await signUp(email.trim(), password)
        if (!data.session) {
          setInfo(
            'Cadastro realizado! Confirme seu e-mail (se a confirmação estiver ativa) e faça login.',
          )
          switchMode('signin')
        }
      }
    } catch (error) {
      setFormError(translateAuthError(error))
    } finally {
      setBusy(false)
    }
  }

  async function handleForgotPassword() {
    setFormError('')
    setInfo('')
    if (!email.trim()) {
      setFormError('Digite seu e-mail para receber o link de recuperação.')
      return
    }
    setBusy(true)
    try {
      await resetPassword(email.trim())
      setInfo('Se o e-mail estiver cadastrado, enviaremos um link de recuperação.')
    } catch (error) {
      setFormError(translateAuthError(error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-login-bg px-4 py-10">
      <main className="w-full max-w-md rounded-xl bg-login-card p-8 shadow-lg">
        <header className="flex flex-col items-center text-center">
          <LogoMark />
        </header>

        <h1 className="mt-6 text-2xl font-bold text-login-heading">
          {mode === 'signin' ? 'Acesse sua conta' : 'Crie sua conta'}
        </h1>
        <p className="mt-1 text-sm text-login-muted">
          {mode === 'signin'
            ? 'Insira suas credenciais para gerenciar suas finanças'
            : 'Comece agora a organizar seus gastos'}
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-login-heading" htmlFor="login-email">
              E-mail
            </label>
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              className="input-light"
              placeholder="exemplo@email.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-sm font-medium text-login-heading" htmlFor="login-password">
                Senha
              </label>
              {mode === 'signin' && (
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  className="link-primary text-sm"
                >
                  Esqueceu a senha?
                </button>
              )}
            </div>
            <input
              id="login-password"
              type="password"
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              className="input-light"
              placeholder="Digite sua senha"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>

          <label className="flex select-none items-center gap-2 text-sm text-login-subtle">
            <input
              type="checkbox"
              checked={remember}
              onChange={(event) => setRemember(event.target.checked)}
              className="h-4 w-4 rounded border-login-border accent-login-primary"
            />
            Lembrar-me
          </label>

          {formError && <p className="alert-error">{formError}</p>}
          {info && <p className="alert-success">{info}</p>}

          <button type="submit" className="btn-cta" disabled={busy}>
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

        <p className="mt-6 text-center text-sm text-login-muted">
          {mode === 'signin' ? 'Não tem uma conta? ' : 'Já tem uma conta? '}
          <button
            type="button"
            onClick={() => switchMode(mode === 'signin' ? 'signup' : 'signin')}
            className="link-primary"
          >
            {mode === 'signin' ? 'Cadastre-se' : 'Entrar'}
          </button>
        </p>
      </main>
    </div>
  )
}

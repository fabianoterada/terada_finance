import { useEffect, useState } from 'react'
import Modal from '../common/Modal.jsx'
import Switch from '../common/Switch.jsx'
import Spinner from '../common/Spinner.jsx'
import { supabase } from '../../lib/supabase.js'

function translateRpcError(message) {
  if (!message) return 'Não foi possível criar o usuário.'
  if (message.includes('ja esta cadastrado')) return 'Este e-mail já está cadastrado.'
  if (message.includes('senha deve ter')) return 'A senha deve ter ao menos 6 caracteres.'
  if (message.includes('e-mail valido')) return 'Informe um e-mail válido.'
  if (message.includes('Acesso negado')) return 'Você não tem permissão para criar usuários.'
  return message
}

export default function UserModal({ open, onClose, onCreated }) {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    setFullName('')
    setEmail('')
    setPassword('')
    setIsActive(true)
    setIsAdmin(false)
    setError('')
    setBusy(false)
  }, [open])

  async function handleSubmit(event) {
    event.preventDefault()
    if (!email.trim()) {
      setError('Informe o e-mail.')
      return
    }
    if (password.length < 6) {
      setError('A senha deve ter ao menos 6 caracteres.')
      return
    }
    setBusy(true)
    setError('')
    const { error: rpcError } = await supabase.rpc('admin_create_user', {
      p_email: email.trim(),
      p_password: password,
      p_full_name: fullName.trim(),
      p_is_active: isActive,
      p_is_admin: isAdmin,
    })
    setBusy(false)
    if (rpcError) {
      setError(translateRpcError(rpcError.message))
      return
    }
    onCreated?.()
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Novo usuário"
      subtitle="Crie uma conta de acesso ao sistema."
      footer={
        <>
          <button type="button" className="btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" form="user-form" className="btn-primary" disabled={busy}>
            {busy && <Spinner size={16} className="border-white/40 border-t-white" />}
            Criar usuário
          </button>
        </>
      }
    >
      <form id="user-form" onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label" htmlFor="user-name">
            Nome
          </label>
          <input
            id="user-name"
            className="input"
            autoFocus
            placeholder="Nome completo"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
          />
        </div>

        <div>
          <label className="label" htmlFor="user-email">
            E-mail
          </label>
          <input
            id="user-email"
            type="email"
            autoComplete="off"
            className="input"
            placeholder="usuario@email.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>

        <div>
          <label className="label" htmlFor="user-password">
            Senha
          </label>
          <input
            id="user-password"
            type="text"
            autoComplete="new-password"
            className="input"
            placeholder="mínimo de 6 caracteres"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <p className="mt-1.5 text-xs text-slate-500">
            Compartilhe a senha com o usuário; ele poderá alterá-la depois.
          </p>
        </div>

        <div className="flex items-center justify-between rounded-xl border border-brand-border bg-brand-elevated/40 px-3.5 py-3">
          <span className="text-sm text-slate-300">Usuário ativo</span>
          <Switch checked={isActive} onChange={setIsActive} />
        </div>

        <div className="flex items-center justify-between rounded-xl border border-brand-border bg-brand-elevated/40 px-3.5 py-3">
          <span className="text-sm text-slate-300">Administrador</span>
          <Switch checked={isAdmin} onChange={setIsAdmin} />
        </div>

        {error && (
          <p className="rounded-lg border border-brand-redDark/50 bg-brand-redDark/20 px-3 py-2 text-sm text-brand-redBright">
            {error}
          </p>
        )}
      </form>
    </Modal>
  )
}

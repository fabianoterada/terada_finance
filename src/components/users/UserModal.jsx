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

export default function UserModal({ open, profile, onClose, onSaved }) {
  const isEditing = Boolean(profile)

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    setFullName(profile?.full_name ?? '')
    setEmail(profile?.email ?? '')
    setPassword('')
    setIsActive(profile ? profile.is_active !== false : true)
    setIsAdmin(profile ? profile.is_admin === true : false)
    setError('')
    setBusy(false)
  }, [open, profile])

  async function handleSubmit(event) {
    event.preventDefault()
    if (!email.trim()) {
      setError('Informe o e-mail.')
      return
    }
    if (!isEditing && password.length < 6) {
      setError('A senha deve ter ao menos 6 caracteres.')
      return
    }
    if (isEditing && password && password.length < 6) {
      setError('A nova senha deve ter ao menos 6 caracteres.')
      return
    }
    if (!supabase) {
      setError('Supabase não configurado. Verifique as variáveis de ambiente.')
      return
    }

    setBusy(true)
    setError('')
    try {
      if (isEditing) {
        const { error: rpcError } = await supabase.rpc('admin_update_user', {
          p_id: profile.id,
          p_email: email.trim(),
          p_full_name: fullName.trim(),
          p_password: password || null,
          p_is_active: isActive,
          p_is_admin: isAdmin,
        })
        if (rpcError) {
          console.error('[UserModal] Falha ao atualizar usuário:', rpcError)
          setError(translateRpcError(rpcError.message))
          return
        }
      } else {
        const { error: rpcError } = await supabase.rpc('admin_create_user', {
          p_email: email.trim(),
          p_password: password,
          p_full_name: fullName.trim(),
          p_is_active: isActive,
          p_is_admin: isAdmin,
        })
        if (rpcError) {
          console.error('[UserModal] Falha ao criar usuário:', rpcError)
          setError(translateRpcError(rpcError.message))
          return
        }
      }
      onSaved?.()
      onClose()
    } catch (err) {
      console.error('[UserModal] Erro inesperado ao salvar usuário:', err)
      setError(err instanceof Error && err.message ? err.message : 'Erro ao salvar o usuário.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEditing ? 'Editar usuário' : 'Novo usuário'}
      subtitle={
        isEditing
          ? 'Atualize nome, e-mail, senha e permissões do usuário.'
          : 'Crie uma conta de acesso ao sistema.'
      }
      footer={
        <>
          <button type="button" className="btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" form="user-form" className="btn-primary" disabled={busy}>
            {busy && <Spinner size={16} className="border-white/40 border-t-white" />}
            {isEditing ? 'Salvar alterações' : 'Criar usuário'}
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
            {isEditing ? 'Nova senha (opcional)' : 'Senha'}
          </label>
          <input
            id="user-password"
            type="text"
            autoComplete="new-password"
            className="input"
            placeholder={isEditing ? 'Deixe em branco para manter a senha atual' : 'mínimo de 6 caracteres'}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <p className="mt-1.5 text-xs text-slate-500">
            {isEditing
              ? 'Preencha apenas se quiser substituir a senha do usuário.'
              : 'Compartilhe a senha com o usuário; ele poderá alterá-la depois.'}
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

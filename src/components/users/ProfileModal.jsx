import { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext.jsx'
import { supabase } from '../../lib/supabase.js'
import Modal from '../common/Modal.jsx'
import Spinner from '../common/Spinner.jsx'
import { useToast } from '../common/Toast.jsx'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function ProfileModal({ open, onClose }) {
  const { user, profile } = useAuth()
  const toast = useToast()

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [novaSenha, setNovaSenha] = useState('')
  const [confirmarSenha, setConfirmarSenha] = useState('')
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    if (!open) return
    setFullName(profile?.full_name ?? '')
    setEmail(user?.email ?? '')
    setNovaSenha('')
    setConfirmarSenha('')
    setErro('')
  }, [open, profile, user])

  async function handleSubmit(event) {
    event.preventDefault()
    setErro('')

    const emailFinal = email.trim().toLowerCase()
    if (!EMAIL_REGEX.test(emailFinal)) {
      setErro('Informe um e-mail válido.')
      return
    }
    if (novaSenha || confirmarSenha) {
      if (novaSenha !== confirmarSenha) {
        setErro('A confirmação não confere com a nova senha.')
        return
      }
      if (novaSenha.length < 6) {
        setErro('A nova senha deve ter ao menos 6 caracteres.')
        return
      }
    }
    if (!supabase || !user) {
      setErro('Supabase não configurado. Verifique as variáveis de ambiente.')
      return
    }

    const emailChanged = emailFinal !== (user.email ?? '').toLowerCase()
    const nomeChanged = fullName.trim() !== (profile?.full_name ?? '')
    if (!emailChanged && !nomeChanged && !novaSenha) {
      toast.info('Nenhuma alteração para salvar.')
      onClose?.()
      return
    }

    setSalvando(true)
    try {
      const authPayload = {}
      if (emailChanged) authPayload.email = emailFinal
      if (novaSenha) authPayload.password = novaSenha
      if (Object.keys(authPayload).length > 0) {
        const { error: authError } = await supabase.auth.updateUser(authPayload)
        if (authError) throw new Error(authError.message)
      }

      const { error: profileError } = await supabase
        .from('profiles')
        .update({ full_name: fullName.trim(), email: emailFinal })
        .eq('id', user.id)
      if (profileError) throw new Error(profileError.message)

      toast.success('Perfil atualizado com sucesso.')
      onClose?.()
    } catch (err) {
      const message =
        err instanceof Error && err.message ? err.message : 'Erro ao atualizar o perfil.'
      setErro(message)
      toast.error(message)
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Meu perfil"
      subtitle="Atualize seus dados de acesso. A troca de e-mail pode exigir reconfirmação."
      footer={
        <>
          <button type="button" className="btn-ghost" onClick={onClose} disabled={salvando}>
            Cancelar
          </button>
          <button type="submit" form="profile-form" className="btn-primary" disabled={salvando}>
            {salvando ? (
              <>
                <Spinner size={15} /> Salvando...
              </>
            ) : (
              'Salvar alterações'
            )}
          </button>
        </>
      }
    >
      <form id="profile-form" onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label" htmlFor="profile-name">
            Nome completo
          </label>
          <input
            id="profile-name"
            className="input"
            value={fullName}
            autoFocus
            placeholder="Seu nome"
            onChange={(event) => {
              setFullName(event.target.value)
              setErro('')
            }}
          />
        </div>

        <div>
          <label className="label" htmlFor="profile-email">
            E-mail
          </label>
          <input
            id="profile-email"
            type="email"
            className="input"
            value={email}
            placeholder="voce@exemplo.com"
            onChange={(event) => {
              setEmail(event.target.value)
              setErro('')
            }}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="profile-password">
              Nova senha
            </label>
            <input
              id="profile-password"
              type="password"
              className="input"
              value={novaSenha}
              minLength={6}
              placeholder="Deixe em branco para manter"
              onChange={(event) => {
                setNovaSenha(event.target.value)
                setErro('')
              }}
            />
          </div>
          <div>
            <label className="label" htmlFor="profile-password-confirm">
              Confirmar nova senha
            </label>
            <input
              id="profile-password-confirm"
              type="password"
              className="input"
              value={confirmarSenha}
              minLength={6}
              placeholder="Repita a nova senha"
              onChange={(event) => {
                setConfirmarSenha(event.target.value)
                setErro('')
              }}
            />
          </div>
        </div>

        {erro && (
          <p className="rounded-lg border border-brand-redDark/50 bg-brand-redDark/20 px-3 py-2 text-sm font-medium text-brand-redBright">
            {erro}
          </p>
        )}
      </form>
    </Modal>
  )
}

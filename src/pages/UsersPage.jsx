import { useCallback, useEffect, useState } from 'react'
import { Users, RefreshCw, ShieldCheck, ShieldOff, Plus, Pencil, Trash2 } from 'lucide-react'
import clsx from 'clsx'
import { supabase } from '../lib/supabase.js'
import { useAuth } from '../context/AuthContext.jsx'
import ConfirmDialog from '../components/common/ConfirmDialog.jsx'
import EmptyState from '../components/common/EmptyState.jsx'
import ErrorBanner from '../components/common/ErrorBanner.jsx'
import LoadingBlock from '../components/common/LoadingBlock.jsx'
import PageHeader from '../components/common/PageHeader.jsx'
import Spinner from '../components/common/Spinner.jsx'
import Switch from '../components/common/Switch.jsx'
import { useToast } from '../components/common/Toast.jsx'
import UserModal from '../components/users/UserModal.jsx'

function formatDate(value) {
  if (!value) return '-'
  return new Date(value).toLocaleDateString('pt-BR')
}

export default function UsersPage() {
  const { isAdmin, user } = useAuth()
  const toast = useToast()
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState(null)
  const [error, setError] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingProfile, setEditingProfile] = useState(null)
  const [pendingDelete, setPendingDelete] = useState(null)

  function openCreate() {
    setEditingProfile(null)
    setModalOpen(true)
  }

  function openEdit(profile) {
    setEditingProfile(profile)
    setModalOpen(true)
  }

  function closeModal() {
    setModalOpen(false)
    setEditingProfile(null)
  }

  async function deleteUser(profile) {
    if (!profile) return
    setBusyId(profile.id)
    setError('')
    try {
      const { error: rpcError } = await supabase.rpc('admin_delete_user', { p_id: profile.id })
      if (rpcError) {
        console.error('[UsersPage] Falha ao excluir usuário:', rpcError, { id: profile.id })
        setError(rpcError.message)
        toast.error(rpcError.message)
        return
      }
      setProfiles((prev) => prev.filter((item) => item.id !== profile.id))
      toast.success('Usuário excluído com sucesso.')
    } catch (err) {
      console.error('[UsersPage] Erro inesperado ao excluir usuário:', err, { id: profile.id })
      const message = err instanceof Error && err.message ? err.message : 'Erro ao excluir o usuário.'
      setError(message)
      toast.error(message)
    } finally {
      setBusyId(null)
    }
  }

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const { data, error: loadError } = await supabase
        .from('profiles')
        .select('id, email, full_name, is_active, is_admin, created_at')
        .order('created_at', { ascending: true })
      if (loadError) setError(loadError.message)
      else setProfiles(data ?? [])
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : 'Erro ao carregar usuários.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isAdmin) load()
    else setLoading(false)
  }, [isAdmin, load])

  async function updateProfile(id, patch) {
    setBusyId(id)
    setError('')
    try {
      const { data: updatedRows, error: updateError } = await supabase
        .from('profiles')
        .update(patch)
        .eq('id', id)
        .select('id')

      if (updateError) {
        console.error('[UsersPage] Falha ao atualizar usuário em profiles:', updateError, { id, patch })
        setError(updateError.message)
        return
      }
      if (!updatedRows || updatedRows.length === 0) {
        setError(
          'Nenhum registro foi alterado. Verifique se o seu usuário é administrador e se a política de UPDATE da tabela profiles está aplicada no Supabase.',
        )
        return
      }
      await load()
    } catch (err) {
      console.error('[UsersPage] Erro inesperado ao atualizar usuário:', err, { id, patch })
      setError(err instanceof Error && err.message ? err.message : 'Erro ao atualizar o usuário.')
    } finally {
      setBusyId(null)
    }
  }

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <PageHeader
          icon={Users}
          title="Gerenciar Usuários"
          description="Área restrita ao administrador."
        />
        <EmptyState
          icon={ShieldOff}
          title="Acesso restrito"
          description="Somente administradores podem gerenciar os usuários do sistema."
        />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        icon={Users}
        title="Gerenciar Usuários"
        description="Cadastre contas e ative, desative ou torne usuários administradores."
        actions={
          <>
            <button type="button" className="btn-ghost" onClick={load} disabled={loading}>
              <RefreshCw size={16} /> Recarregar
            </button>
            <button type="button" className="btn-primary" onClick={openCreate}>
              <Plus size={16} /> Novo usuário
            </button>
          </>
        }
      />

      <ErrorBanner message={error} onClose={() => setError('')} />

      {loading ? (
        <LoadingBlock label="Carregando usuários..." />
      ) : profiles.length === 0 ? (
        <EmptyState icon={Users} title="Nenhum usuário encontrado" />
      ) : (
        <div className="card overflow-hidden p-0">
          <div className="hidden grid-cols-[1fr_auto_auto_auto] items-center gap-4 border-b border-brand-border px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 sm:grid">
            <span>Usuário</span>
            <span className="text-center">Ativo</span>
            <span className="text-center">Admin</span>
            <span className="text-center">Ações</span>
          </div>

          <ul className="divide-y divide-brand-border">
            {profiles.map((profile) => {
              const isSelf = profile.id === user?.id
              const busy = busyId === profile.id
              return (
                <li
                  key={profile.id}
                  className="flex flex-col gap-4 px-5 py-4 sm:grid sm:grid-cols-[1fr_auto_auto_auto] sm:items-center"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-red/15 text-sm font-bold text-brand-redBright">
                      {(profile.full_name?.trim()?.[0] || profile.email?.[0] || '?').toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-white">
                        {profile.full_name?.trim() || 'Sem nome'}
                        {isSelf && <span className="ml-2 text-xs font-normal text-slate-500">(você)</span>}
                      </p>
                      <p className="truncate text-sm text-slate-400">{profile.email || '—'}</p>
                      <p className="text-xs text-slate-600">Desde {formatDate(profile.created_at)}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3 sm:justify-center">
                    <span className="text-xs font-medium text-slate-400 sm:hidden">Ativo</span>
                    <div className="flex items-center gap-2">
                      {busy && <Spinner size={14} />}
                      <Switch
                        checked={profile.is_active !== false}
                        disabled={busy || isSelf}
                        onChange={(value) => updateProfile(profile.id, { is_active: value })}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3 sm:justify-center">
                    <span className="text-xs font-medium text-slate-400 sm:hidden">Admin</span>
                    <button
                      type="button"
                      disabled={busy || isSelf}
                      onClick={() => updateProfile(profile.id, { is_admin: !profile.is_admin })}
                      className={clsx(
                        'flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-40',
                        profile.is_admin
                          ? 'border-brand-red/50 bg-brand-red/10 text-brand-redBright'
                          : 'border-brand-border text-slate-400 hover:text-white',
                      )}
                    >
                      {profile.is_admin ? <ShieldCheck size={14} /> : <ShieldOff size={14} />}
                      {profile.is_admin ? 'Admin' : 'Comum'}
                    </button>
                  </div>

                  <div className="flex items-center justify-between gap-3 sm:justify-center">
                    <span className="text-xs font-medium text-slate-400 sm:hidden">Ações</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => openEdit(profile)}
                        title="Editar usuário"
                        aria-label="Editar usuário"
                        className="rounded-lg border border-brand-border p-1.5 text-slate-400 transition hover:border-brand-red/50 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        disabled={busy || isSelf}
                        onClick={() => setPendingDelete(profile)}
                        title={isSelf ? 'Você não pode excluir a si mesmo' : 'Excluir usuário'}
                        aria-label="Excluir usuário"
                        className="rounded-lg border border-brand-border p-1.5 text-slate-400 transition hover:border-brand-red/50 hover:text-brand-redBright disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      <p className="text-xs text-slate-500">
        Usuários inativos não conseguem fazer login. Você não pode alterar o seu próprio acesso.
      </p>

      <UserModal
        key={editingProfile?.id ?? 'novo'}
        open={modalOpen}
        profile={editingProfile}
        onClose={closeModal}
        onSaved={load}
      />

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => deleteUser(pendingDelete)}
        title="Excluir usuário"
        message={`Tem certeza que deseja excluir ${
          pendingDelete?.full_name?.trim() || pendingDelete?.email || 'este usuário'
        }? Esta ação é permanente e remove também o acesso dele.`}
        confirmLabel="Excluir"
      />
    </div>
  )
}

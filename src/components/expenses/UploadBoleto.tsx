import { useEffect, useRef, useState } from 'react'
import type { DragEvent } from 'react'
import clsx from 'clsx'
import { CheckCircle2, ScanLine } from 'lucide-react'
import type { SupabaseClient } from '@supabase/supabase-js'
import Spinner from '../common/Spinner.jsx'
import { supabase } from '../../lib/supabase.js'
import { BUCKET_COMPROVANTES, comTempoLimpo, extrairLinhaDigitavel } from '../../lib/ocr'

const MIME_ACEITOS = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg']
const TIMEOUT_UPLOAD_MS = 60000

/** Metadados do arquivo enviado, gravados em contas_anexos (formato v3). */
export interface ArquivoEnviado {
  storagePath: string
  nomeArquivo: string
  tipoConteudo: string
  tamanhoBytes: number
}

export interface UploadBoletoProps {
  onUploadSuccess: (arquivo: ArquivoEnviado) => void
  onLinhaDigitavelEncontrada: (linha: string) => void
  onError: (msg: string) => void
}

function extensaoDoMime(mime: string): string {
  if (mime === 'application/pdf') return 'pdf'
  if (mime === 'image/png') return 'png'
  return 'jpg'
}

function mensagemDeErro(err: unknown): string {
  if (err instanceof Error && err.message) return err.message
  return 'Erro inesperado ao enviar o arquivo. Tente novamente.'
}

async function enviarArquivo(client: SupabaseClient, file: File): Promise<ArquivoEnviado> {
  const { data: userData, error: userError } = await client.auth.getUser()
  if (userError) throw new Error(userError.message)
  if (!userData.user) throw new Error('Sessão expirada. Faça login novamente.')

  const nomeArquivo = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}.${extensaoDoMime(file.type)}`
  const path = `${userData.user.id}/${nomeArquivo}`

  const { error } = await client.storage
    .from(BUCKET_COMPROVANTES)
    .upload(path, file, { contentType: file.type, upsert: false })
  if (error) throw new Error(error.message)

  return {
    storagePath: path,
    nomeArquivo: file.name || nomeArquivo,
    tipoConteudo: file.type,
    tamanhoBytes: file.size,
  }
}

export default function UploadBoleto({
  onUploadSuccess,
  onLinhaDigitavelEncontrada,
  onError,
}: UploadBoletoProps) {
  const [processando, setProcessando] = useState(false)
  const [arrastando, setArrastando] = useState(false)
  const [nomeArquivo, setNomeArquivo] = useState('')
  const [enviadoComSucesso, setEnviadoComSucesso] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const profundidadeDragRef = useRef(0)
  const montadoRef = useRef(false)

  useEffect(() => {
    montadoRef.current = true
    return () => {
      montadoRef.current = false
    }
  }, [])

  async function processarArquivo(file: File | null | undefined): Promise<void> {
    if (!file || processando) return
    if (!MIME_ACEITOS.includes(file.type)) {
      onError('Formato não suportado. Envie um arquivo PDF, JPG ou PNG.')
      return
    }
    if (!supabase) {
      onError('Supabase não configurado. Verifique as variáveis de ambiente.')
      return
    }

    setProcessando(true)
    setEnviadoComSucesso(false)
    setNomeArquivo(file.name)

    try {
      // Upload e OCR rodam em paralelo; a falha de um não cancela o outro.
      const [resultadoUpload, resultadoOcr] = await Promise.allSettled([
        comTempoLimpo(
          enviarArquivo(supabase, file),
          TIMEOUT_UPLOAD_MS,
          'Tempo esgotado no upload do arquivo.',
        ),
        extrairLinhaDigitavel(file),
      ])

      if (!montadoRef.current) return

      if (resultadoUpload.status === 'rejected') {
        onError(mensagemDeErro(resultadoUpload.reason))
      } else {
        setEnviadoComSucesso(true)
        onUploadSuccess(resultadoUpload.value)
      }

      // OCR falha de forma silenciosa: so preenche quando encontra a linha.
      if (resultadoOcr.status === 'fulfilled' && resultadoOcr.value) {
        onLinhaDigitavelEncontrada(resultadoOcr.value)
      }
    } catch (err) {
      if (montadoRef.current) onError(mensagemDeErro(err))
    } finally {
      if (montadoRef.current) {
        setProcessando(false)
        if (inputRef.current) inputRef.current.value = ''
      }
    }
  }

  function abrirSeletor(): void {
    if (!processando) inputRef.current?.click()
  }

  function handleDragEnter(event: DragEvent<HTMLDivElement>): void {
    event.preventDefault()
    profundidadeDragRef.current += 1
    setArrastando(true)
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>): void {
    event.preventDefault()
  }

  function handleDragLeave(event: DragEvent<HTMLDivElement>): void {
    event.preventDefault()
    profundidadeDragRef.current = Math.max(0, profundidadeDragRef.current - 1)
    if (profundidadeDragRef.current === 0) setArrastando(false)
  }

  function handleDrop(event: DragEvent<HTMLDivElement>): void {
    event.preventDefault()
    profundidadeDragRef.current = 0
    setArrastando(false)
    void processarArquivo(event.dataTransfer.files?.[0])
  }

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        aria-label="Enviar boleto ou comprovante"
        onClick={abrirSeletor}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            abrirSeletor()
          }
        }}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={clsx(
          'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-4 py-8 text-center transition',
          arrastando
            ? 'border-brand-redBright bg-brand-red/10'
            : 'border-brand-border bg-brand-elevated/30 hover:border-brand-red/60',
          processando && 'pointer-events-none opacity-70',
        )}
      >
        {processando ? (
          <>
            <Spinner size={22} />
            <p className="text-sm font-semibold text-white">Enviando e lendo o arquivo...</p>
            {nomeArquivo && (
              <p className="max-w-full truncate text-xs text-slate-400">{nomeArquivo}</p>
            )}
          </>
        ) : (
          <>
            <ScanLine size={26} className={arrastando ? 'text-brand-redBright' : 'text-slate-500'} />
            <p className="text-sm font-semibold text-white">
              Arraste o boleto aqui ou clique para selecionar
            </p>
            <p className="text-xs text-slate-500">
              PDF, JPG ou PNG — a linha digitável é lida automaticamente
            </p>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,image/jpeg,image/png,image/jpg"
          className="hidden"
          onChange={(event) => {
            void processarArquivo(event.target.files?.[0])
          }}
        />
      </div>
      {enviadoComSucesso && nomeArquivo && !processando && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-emerald-300">
          <CheckCircle2 size={14} /> Arquivo enviado: {nomeArquivo}
        </p>
      )}
    </div>
  )
}

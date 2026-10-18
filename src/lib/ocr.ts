/**
 * Leitura inteligente de boletos/comprovantes:
 * - PDF: renderiza a primeira pagina em um canvas em memoria (pdfjs-dist).
 * - Imagem (JPG/PNG): OCR com Tesseract.js em portugues.
 * - A extracao da linha digitavel e feita por regex sobre o texto reconhecido.
 * Falhas de leitura retornam null silenciosamente (o OCR nunca lanca erro).
 * As bibliotecas pesadas (pdfjs/tesseract) sao carregadas sob demanda.
 */

const TIMEOUT_OCR_MS = 45000
const TIMEOUT_PDF_MS = 20000

/** Envia o arquivo para o bucket e retorna o path armazenado. */
export const BUCKET_COMPROVANTES = 'comprovantes_contas'

/**
 * Corre uma promessa com limite de tempo. O timer e sempre limpo,
 * mesmo quando a promessa original vence ou falha.
 */
export async function comTempoLimpo<T>(
  promessa: Promise<T>,
  tempoLimpoMs: number,
  mensagemTimeout: string,
): Promise<T> {
  let timerId = 0
  const expiracao = new Promise<never>((_resolve, reject) => {
    timerId = window.setTimeout(() => reject(new Error(mensagemTimeout)), tempoLimpoMs)
  })
  try {
    return await Promise.race([promessa, expiracao])
  } finally {
    window.clearTimeout(timerId)
  }
}

/** Padrão da linha digitável brasileira: 47 ou 48 dígitos (com separadores). */
const PADRAO_LINHA_DIGITAVEL = /(?:\d[\.\s-]*){47,48}/g

/**
 * Percorre os candidatos encontrados no texto e retorna o primeiro
 * que, limpo de separadores, tenha exatamente 47 ou 48 dígitos.
 */
export function localizarLinhaDigitavel(texto: string): string | null {
  const candidatos = texto.match(PADRAO_LINHA_DIGITAVEL) ?? []
  for (const candidato of candidatos) {
    const digitos = candidato.replace(/\D/g, '')
    if (digitos.length === 47 || digitos.length === 48) {
      return digitos
    }
  }
  return null
}

/** OCR de imagem (JPG/PNG) em portugues usando Tesseract.js. */
async function textoDeImagem(file: File): Promise<string> {
  const { default: Tesseract } = await import('tesseract.js')
  const resultado = await Tesseract.recognize(file, 'por')
  return resultado.data.text
}

/** Renderiza a primeira pagina do PDF em canvas e devolve dataURL para OCR. */
async function imagemDePdf(file: File): Promise<string> {
  const pdfjs = await import('pdfjs-dist')
  pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`

  const dados = await file.arrayBuffer()
  const tarefa = pdfjs.getDocument({ data: dados })
  const documento = await tarefa.promise
  try {
    const pagina = await documento.getPage(1)
    const viewport = pagina.getViewport({ scale: 2.5 })
    const canvas = document.createElement('canvas')
    canvas.width = Math.ceil(viewport.width)
    canvas.height = Math.ceil(viewport.height)
    await pagina.render({ canvas, viewport }).promise
    return canvas.toDataURL('image/png')
  } finally {
    try {
      await tarefa.destroy()
    } catch {
      // Falha ao liberar o documento não deve mascarar o resultado do OCR.
    }
  }
}

/**
 * Extrai a linha digitável de um arquivo PDF ou imagem.
 * Retorna os dígitos (sem separadores) ou null quando não encontrar /
 * quando qualquer etapa falhar (falha silenciosa, sem exceção).
 */
export async function extrairLinhaDigitavel(file: File): Promise<string | null> {
  try {
    const texto =
      file.type === 'application/pdf'
        ? await comTempoLimpo(imagemDePdf(file), TIMEOUT_PDF_MS, 'Tempo esgotado ao ler o PDF.')
        : await comTempoLimpo(textoDeImagem(file), TIMEOUT_OCR_MS, 'Tempo esgotado no OCR da imagem.')
    return localizarLinhaDigitavel(texto)
  } catch {
    return null
  }
}

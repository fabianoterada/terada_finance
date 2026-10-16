import { Component } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
    this.handleReload = this.handleReload.bind(this)
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('Erro capturado na tela:', error, info?.componentStack)
  }

  handleReload() {
    window.location.reload()
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-login-bg px-4 py-10">
        <main className="w-full max-w-md rounded-xl bg-login-card p-8 text-center shadow-lg">
          <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-md border border-state-errorBorder bg-state-errorBg">
            <AlertTriangle size={20} className="text-state-error" aria-hidden="true" />
          </span>
          <h1 className="mt-5 text-xl font-bold text-login-heading">Algo saiu do lugar</h1>
          <p className="mt-2 text-sm text-login-muted">
            Esta versão da tela ficou desatualizada. Recarregue para abrir a versão mais recente do
            Terada Finance.
          </p>
          <button type="button" onClick={this.handleReload} className="btn-cta mt-6">
            <RefreshCw size={16} />
            Recarregar a tela
          </button>
        </main>
      </div>
    )
  }
}

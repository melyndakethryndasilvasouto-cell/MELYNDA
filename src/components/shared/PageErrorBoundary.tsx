import { Component, type ReactNode } from 'react'
import { Link } from 'react-router-dom'

/** Recover lazy-load failures after deployments without discarding local progress. */
export default class PageErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() { return { failed: true } }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <section role="alert" className="glass-card p-6 text-center space-y-4">
        <h1 className="font-title text-2xl text-purple-900">N?o conseguimos abrir esta aventura</h1>
        <p className="text-gray-700">Confira sua conex?o e tente atualizar a p?gina. Seus dados salvos neste aparelho n?o ser?o apagados.</p>
        <div className="flex flex-wrap justify-center gap-3">
          <button type="button" className="btn-primary" onClick={() => window.location.reload()}>Tentar novamente</button>
          <Link className="btn-secondary" to="/">Voltar aos jogos</Link>
        </div>
      </section>
    )
  }
}

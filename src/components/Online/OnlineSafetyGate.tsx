import { ShieldCheck } from 'lucide-react'

interface Props {
  onAccept: () => void
  notice?: string
}

export default function OnlineSafetyGate({ onAccept, notice = '' }: Props) {
  return (
    <section className="glass-card mx-auto mt-8 max-w-md p-6 text-center">
      <ShieldCheck className="mx-auto" size={48} aria-hidden="true" style={{ color: '#047857' }} />
      <h1 className="mt-3 font-title text-3xl" style={{ color: '#5B3A8A' }}>Jogar com segurança</h1>
      <p className="mt-3 text-sm font-bold leading-relaxed" style={{ color: '#4B5563' }}>
        Use um apelido e aceite convites somente de amigos conhecidos. Se você é criança, peça para um adulto acompanhar o chat, os grupos e o áudio.
      </p>
      <p className="mt-3 rounded-2xl bg-blue-50 p-3 text-sm" style={{ color: '#1D4E89' }}>
        Nunca compartilhe nome completo, escola, endereço, telefone, senha ou fotos.
      </p>
      <p className="mt-3 text-xs font-bold" style={{ color: '#4B5563' }}>
        Seu apelido e sua atividade aparecerão enquanto esta aba estiver no modo Online. Você poderá ficar offline quando quiser.
      </p>
      {notice && <p className="mt-3 rounded-2xl bg-amber-50 p-3 text-sm font-bold" style={{ color: '#92400E' }} role="status">{notice}</p>}
      <button type="button" className="btn-primary mt-5 w-full" onClick={onAccept}>Entendi, entrar no Online</button>
    </section>
  )
}

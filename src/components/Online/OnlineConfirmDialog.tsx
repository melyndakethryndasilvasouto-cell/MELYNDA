import { useRef, useState } from 'react'
import { useAccessibleDialog } from '../../online/useAccessibleDialog'

type Props = {
  open: boolean
  title: string
  message: string
  confirmLabel: string
  danger?: boolean
  onCancel: () => void
  onConfirm: () => void | Promise<void>
}

export default function OnlineConfirmDialog({ open, title, message, confirmLabel, danger = false, onCancel, onConfirm }: Props) {
  const [busy, setBusy] = useState(false)
  const firstRef = useRef<HTMLButtonElement>(null)
  useAccessibleDialog(open, onCancel, firstRef)

  if (!open) return null

  const confirm = async () => {
    setBusy(true)
    try { await onConfirm() } finally { setBusy(false) }
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-end bg-slate-950/60 p-3 sm:items-center sm:justify-center" onMouseDown={event => { if (event.target === event.currentTarget && !busy) onCancel() }}>
      <section role="dialog" aria-modal="true" aria-labelledby="online-confirm-title" aria-describedby="online-confirm-message" aria-busy={busy} className="w-full max-w-md rounded-3xl bg-white p-5 shadow-2xl">
        <h2 id="online-confirm-title" className="font-title text-2xl" style={{ color: '#5B3A8A' }}>{title}</h2>
        <p id="online-confirm-message" className="mt-2 text-sm font-bold" style={{ color: '#4B5563' }}>{message}</p>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <button ref={firstRef} type="button" className="btn-secondary min-h-11" disabled={busy} onClick={onCancel}>Agora não</button>
          <button type="button" className={`min-h-11 rounded-2xl px-3 text-sm font-black text-white ${danger ? 'bg-red-600' : 'bg-blue-700'}`} disabled={busy} onClick={() => void confirm()}>{busy ? 'Aguarde…' : confirmLabel}</button>
        </div>
      </section>
    </div>
  )
}

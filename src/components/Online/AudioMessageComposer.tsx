import { Mic, Send, Square, Trash2 } from 'lucide-react'
import { EphemeralAudioBroadcastPayload, useEphemeralAudioMessage } from '../../online/useEphemeralAudioMessage'

interface Props {
  disabled?: boolean
  onSend: (payload: EphemeralAudioBroadcastPayload) => Promise<void>
}

function seconds(value: number) {
  return `${Math.max(0, Math.ceil(value / 1000))}s`
}

export default function AudioMessageComposer({ disabled = false, onSend }: Props) {
  const audio = useEphemeralAudioMessage(onSend)

  return (
    <div className="mt-2 rounded-2xl border border-blue-100 bg-blue-50/70 p-3" aria-label="Enviar mensagem de áudio" aria-busy={audio.status === 'requesting' || audio.status === 'sending'}>
      {audio.status === 'idle' || audio.status === 'error' ? (
        <button type="button" className="btn-secondary min-h-11 w-full text-sm" disabled={disabled} onClick={() => void audio.startRecording()}>
          <Mic size={17} aria-hidden="true" /> Gravar áudio curto
        </button>
      ) : audio.status === 'requesting' ? (
        <p className="text-center text-sm font-bold" style={{ color: '#1D4E89' }}>Aguardando permissão do microfone…</p>
      ) : audio.status === 'recording' ? (
        <button type="button" className="btn-danger flex min-h-11 w-full items-center justify-center gap-2" onClick={audio.stopRecording}>
          <Square size={16} fill="currentColor" /> Gravando {seconds(audio.elapsedMs)} de 10s — parar
        </button>
      ) : audio.preview ? (
        <div>
          <p className="mb-2 text-sm font-black" style={{ color: '#1D4E89' }}>Ouça antes de enviar ({seconds(audio.preview.durationMs)})</p>
          <audio controls preload="metadata" src={audio.preview.url} className="w-full" aria-label="Prévia da mensagem de áudio" />
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button type="button" className="btn-secondary min-h-11 px-3 text-sm" disabled={audio.status === 'sending'} onClick={audio.discard}><Trash2 size={16} /> Apagar</button>
            <button type="button" className="btn-primary min-h-11 px-3 text-sm" disabled={audio.status === 'sending'} onClick={() => void audio.send()}><Send size={16} /> {audio.status === 'sending' ? 'Enviando…' : 'Enviar áudio'}</button>
          </div>
        </div>
      ) : null}
      {audio.error && <p role="alert" className="mt-2 text-xs font-bold" style={{ color: '#9A3412' }}>{audio.error}</p>}
      <p className="sr-only" role="status" aria-live="polite">{audio.status === 'requesting' ? 'Aguardando permissão do microfone.' : audio.status === 'recording' ? `Gravando áudio, ${seconds(audio.elapsedMs)}.` : audio.status === 'preview' ? 'Áudio pronto para ouvir antes de enviar.' : audio.status === 'sending' ? 'Enviando áudio.' : ''}</p>
      <p className="mt-2 text-xs" style={{ color: '#4B5563' }}>Máximo de 10 segundos. O áudio não toca sozinho e deixa de ficar disponível após 24 horas.</p>
    </div>
  )
}

import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase, onlineConfigured } from '../services/supabase'
import { LOBBY_QUICK_MESSAGES, OnlineInvite, OnlinePlayer, OnlineStatus } from '../online/types'
import { usePlayer } from './PlayerContext'

interface LobbyMessage {
  id: string
  senderId: string
  name: string
  avatar: string
  text: string
}

interface OnlineContextValue {
  configured: boolean
  status: OnlineStatus
  userId: string
  players: OnlinePlayer[]
  invites: OnlineInvite[]
  lobbyMessages: LobbyMessage[]
  error: string
  connect: () => Promise<void>
  sendLobbyMessage: (messageIndex: number) => Promise<void>
  invitePlayer: (guestId: string) => Promise<string>
  respondInvite: (inviteId: string, accept: boolean) => Promise<string>
}

const OnlineContext = createContext<OnlineContextValue | null>(null)

function friendlyError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || '')
  if (message.includes('Anonymous sign-ins are disabled')) return 'O acesso de jogadores ainda precisa ser ativado no Supabase.'
  if (message.includes('INVITE_RATE_LIMIT')) return 'Espere alguns segundos antes de enviar outro convite.'
  if (message.includes('PLAYER_OFFLINE')) return 'Esse jogador acabou de sair do saguão.'
  if (message.includes('PLAYER_BUSY')) return 'Um dos jogadores já está em outra partida ou convite.'
  if (message.includes('INVITE_EXPIRED')) return 'Esse convite expirou. Peça um novo convite.'
  return 'Não foi possível conectar ao modo online agora. Tente novamente.'
}

export function OnlineProvider({ children }: { children: ReactNode }) {
  const { playerName, playerAvatar } = usePlayer()
  const [status, setStatus] = useState<OnlineStatus>('idle')
  const [userId, setUserId] = useState('')
  const [players, setPlayers] = useState<OnlinePlayer[]>([])
  const [invites, setInvites] = useState<OnlineInvite[]>([])
  const [lobbyMessages, setLobbyMessages] = useState<LobbyMessage[]>([])
  const [error, setError] = useState('')
  const channelsRef = useRef<RealtimeChannel[]>([])
  const lobbyRef = useRef<RealtimeChannel | null>(null)
  const connectionRef = useRef<Promise<void> | null>(null)
  const connectedUserRef = useRef('')

  const disconnect = useCallback(() => {
    if (!supabase) return
    for (const channel of channelsRef.current) void supabase.removeChannel(channel)
    channelsRef.current = []
    lobbyRef.current = null
    connectedUserRef.current = ''
  }, [])

  useEffect(() => disconnect, [disconnect])

  const connect = useCallback(async () => {
    if (lobbyRef.current && connectedUserRef.current) return
    if (connectionRef.current) return connectionRef.current
    const task = (async () => {
      if (!supabase) {
        setStatus('error')
        setError('O modo online ainda não foi configurado neste site.')
        return
      }
      setStatus('connecting')
      setError('')
      try {
        let session = (await supabase.auth.getSession()).data.session
        if (!session) {
          const signedIn = await supabase.auth.signInAnonymously({
            options: { data: { display_name: playerName, avatar: playerAvatar } },
          })
          if (signedIn.error) throw signedIn.error
          session = signedIn.data.session
        }
        if (!session) throw new Error('AUTH_REQUIRED')

        const currentUserId = session.user.id
        setUserId(currentUserId)
        const profile = {
          user_id: currentUserId,
          display_name: playerName.slice(0, 16),
          avatar: playerAvatar.slice(0, 12),
          updated_at: new Date().toISOString(),
        }
        let profileResult = await supabase.from('online_profiles').upsert(profile, { onConflict: 'user_id' })
        if (profileResult.error?.code === 'PGRST303') {
          await new Promise(resolve => window.setTimeout(resolve, 3_000))
          profileResult = await supabase.from('online_profiles').upsert(profile, { onConflict: 'user_id' })
        }
        if (profileResult.error) throw profileResult.error

        await supabase.realtime.setAuth(session.access_token)
        const lobby = supabase.channel('online:lobby', {
          config: { private: true, presence: { key: currentUserId } },
        })
        lobby
          .on('presence', { event: 'sync' }, () => {
            const state = lobby.presenceState<Record<string, string>>()
            const unique = new Map<string, OnlinePlayer>()
            for (const entries of Object.values(state)) {
              for (const entry of entries) {
                const candidate = entry as unknown as { userId?: string; name?: string; avatar?: string }
                if (!candidate.userId || !candidate.name || !candidate.avatar) continue
                unique.set(candidate.userId, {
                  userId: candidate.userId,
                  name: candidate.name.slice(0, 16),
                  avatar: candidate.avatar.slice(0, 12),
                })
              }
            }
            setPlayers([...unique.values()].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')))
          })
          .on('broadcast', { event: 'lobby-message' }, ({ payload }) => {
            const value = payload as { id?: string; senderId?: string; name?: string; avatar?: string; messageIndex?: number }
            const messageIndex = Number(value.messageIndex)
            if (!value.id || !value.senderId || !value.name || !value.avatar || !Number.isInteger(messageIndex)) return
            const text = LOBBY_QUICK_MESSAGES[messageIndex]
            if (!text) return
            setLobbyMessages(previous => [...previous.slice(-19), {
              id: value.id,
              senderId: value.senderId,
              name: value.name.slice(0, 16),
              avatar: value.avatar.slice(0, 12),
              text,
            }])
          })

        const invitesChannel = supabase.channel(`online-invites:${currentUserId}`)
          .on('postgres_changes', {
            event: '*', schema: 'public', table: 'online_invites', filter: `to_user=eq.${currentUserId}`,
          }, ({ eventType, new: next, old }) => {
            const invite = next as unknown as OnlineInvite
            const oldInvite = old as unknown as Partial<OnlineInvite>
            setInvites(previous => {
              const without = previous.filter(item => item.id !== (invite.id || oldInvite.id))
              return eventType !== 'DELETE' && invite.status === 'pending' && new Date(invite.expires_at).getTime() > Date.now()
                ? [invite, ...without].slice(0, 5)
                : without
            })
          })

        channelsRef.current = [lobby, invitesChannel]

        await new Promise<void>((resolve, reject) => {
          lobby.subscribe(async (subscriptionStatus, subscriptionError) => {
            if (subscriptionStatus === 'SUBSCRIBED') {
              await lobby.track({ userId: currentUserId, name: playerName.slice(0, 16), avatar: playerAvatar.slice(0, 12) })
              resolve()
            } else if (subscriptionStatus === 'CHANNEL_ERROR' || subscriptionStatus === 'TIMED_OUT') {
              reject(subscriptionError || new Error(subscriptionStatus))
            }
          })
        })
        await new Promise<void>((resolve, reject) => {
          invitesChannel.subscribe((subscriptionStatus, subscriptionError) => {
            if (subscriptionStatus === 'SUBSCRIBED') resolve()
            else if (subscriptionStatus === 'CHANNEL_ERROR' || subscriptionStatus === 'TIMED_OUT') {
              reject(subscriptionError || new Error(subscriptionStatus))
            }
          })
        })
        lobbyRef.current = lobby
        connectedUserRef.current = currentUserId

        const pending = await supabase.from('online_invites').select('*')
          .eq('to_user', currentUserId).eq('status', 'pending').gt('expires_at', new Date().toISOString())
          .order('created_at', { ascending: false }).limit(5)
        if (pending.error) throw pending.error
        setInvites((pending.data || []) as OnlineInvite[])
        setStatus('connected')
      } catch (connectionError) {
        disconnect()
        setStatus('error')
        setError(friendlyError(connectionError))
      }
    })()
    connectionRef.current = task.finally(() => { connectionRef.current = null })
    return connectionRef.current
  }, [disconnect, playerAvatar, playerName])

  const sendLobbyMessage = useCallback(async (messageIndex: number) => {
    const lobby = lobbyRef.current
    if (!lobby || !userId || !LOBBY_QUICK_MESSAGES[messageIndex]) return
    const id = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${messageIndex}`
    const payload = { id, senderId: userId, name: playerName, avatar: playerAvatar, messageIndex }
    await lobby.send({ type: 'broadcast', event: 'lobby-message', payload })
    setLobbyMessages(previous => [...previous.slice(-19), { ...payload, text: LOBBY_QUICK_MESSAGES[messageIndex] }])
  }, [playerAvatar, playerName, userId])

  const invitePlayer = useCallback(async (guestId: string) => {
    if (!supabase) throw new Error('NOT_CONFIGURED')
    setError('')
    const result = await supabase.rpc('create_online_invite', { guest: guestId })
    if (result.error) {
      const translated = friendlyError(result.error)
      setError(translated)
      throw new Error(translated)
    }
    return String(result.data)
  }, [])

  const respondInvite = useCallback(async (inviteId: string, accept: boolean) => {
    if (!supabase) throw new Error('NOT_CONFIGURED')
    const result = await supabase.rpc('respond_online_invite', { invite: inviteId, accept_invite: accept })
    if (result.error) {
      const translated = friendlyError(result.error)
      setError(translated)
      throw new Error(translated)
    }
    if (!result.data) {
      const translated = 'Esse convite expirou. Peça um novo convite.'
      setError(translated)
      setInvites(previous => previous.filter(item => item.id !== inviteId))
      throw new Error(translated)
    }
    setInvites(previous => previous.filter(item => item.id !== inviteId))
    return String(result.data)
  }, [])

  return (
    <OnlineContext.Provider value={{
      configured: onlineConfigured, status, userId, players, invites, lobbyMessages, error,
      connect, sendLobbyMessage, invitePlayer, respondInvite,
    }}>
      {children}
    </OnlineContext.Provider>
  )
}

export function useOnline() {
  const context = useContext(OnlineContext)
  if (!context) throw new Error('useOnline must be used within OnlineProvider')
  return context
}

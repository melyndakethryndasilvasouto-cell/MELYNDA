import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase, onlineConfigured } from '../services/supabase'
import { activityForPath } from '../online/gameRegistry'
import {
  LOBBY_QUICK_MESSAGES,
  OnlineGroup,
  OnlineGroupInvite,
  OnlineInvite,
  OnlineLobbyMessage,
  OnlinePlayer,
  OnlineStatus,
} from '../online/types'
import { usePlayer } from './PlayerContext'

interface OnlineContextValue {
  configured: boolean
  safetyAccepted: boolean
  status: OnlineStatus
  userId: string
  players: OnlinePlayer[]
  invites: OnlineInvite[]
  groupInvites: OnlineGroupInvite[]
  groups: OnlineGroup[]
  lobbyMessages: OnlineLobbyMessage[]
  error: string
  acceptSafety: () => void
  goOffline: () => Promise<void>
  connect: () => Promise<void>
  refreshOnline: () => Promise<void>
  sendLobbyMessage: (messageIndex: number) => Promise<void>
  invitePlayer: (guestId: string, gameType?: string) => Promise<string>
  respondInvite: (inviteId: string, accept: boolean) => Promise<string>
  createGroup: (name: string) => Promise<string>
  inviteToGroup: (groupId: string, guestId: string) => Promise<void>
  respondGroupInvite: (inviteId: string, accept: boolean) => Promise<string>
  blockPlayer: (targetId: string) => Promise<void>
  reportPlayer: (targetId: string, reason: string, context: 'lobby' | 'room' | 'group', evidence?: string) => Promise<void>
}

const OnlineContext = createContext<OnlineContextValue | null>(null)

function friendlyError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || '')
  if (message.includes('Anonymous sign-ins are disabled')) return 'O acesso de jogadores ainda precisa ser ativado no Supabase.'
  if (message.includes('INVITE_RATE_LIMIT')) return 'Espere alguns segundos antes de enviar outro convite.'
  if (message.includes('MESSAGE_RATE_LIMIT')) return 'Espere um pouquinho antes de enviar outra mensagem.'
  if (message.includes('REPORT_RATE_LIMIT')) return 'A denúncia anterior já foi recebida. Espere um pouco antes de enviar outra.'
  if (message.includes('PLAYER_OFFLINE')) return 'Esse jogador acabou de sair do Online.'
  if (message.includes('PLAYER_BUSY')) return 'Termine ou saia da sua sala atual antes de criar outro convite.'
  if (message.includes('PLAYER_BLOCKED')) return 'Essa interação não está disponível.'
  if (message.includes('GROUP_FULL')) return 'Esse grupo já está cheio.'
  if (message.includes('GROUP_LIMIT')) return 'Você já criou o máximo de cinco grupos.'
  if (message.includes('ALREADY_MEMBER')) return 'Esse jogador já participa do grupo.'
  if (message.includes('INVITE_EXPIRED') || message.includes('INVITE_UNAVAILABLE')) return 'Esse convite expirou ou já foi respondido.'
  return 'Não foi possível atualizar o modo Online agora. Tente novamente.'
}

function pendingInvite<T extends { status: string; expires_at: string }>(invite: T) {
  return invite.status === 'pending' && new Date(invite.expires_at).getTime() > Date.now()
}

export function OnlineProvider({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  const { playerName, playerAvatar } = usePlayer()
  const [status, setStatus] = useState<OnlineStatus>('idle')
  const [userId, setUserId] = useState('')
  const [players, setPlayers] = useState<OnlinePlayer[]>([])
  const [invites, setInvites] = useState<OnlineInvite[]>([])
  const [groupInvites, setGroupInvites] = useState<OnlineGroupInvite[]>([])
  const [groups, setGroups] = useState<OnlineGroup[]>([])
  const [lobbyMessages, setLobbyMessages] = useState<OnlineLobbyMessage[]>([])
  const [error, setError] = useState('')
  const [safetyAccepted, setSafetyAccepted] = useState(() => sessionStorage.getItem('mel-online-consent') === 'yes')
  const safetyAcceptedRef = useRef(safetyAccepted)
  const channelRef = useRef<RealtimeChannel | null>(null)
  const heartbeatRef = useRef<number | null>(null)
  const connectionRef = useRef<Promise<void> | null>(null)
  const connectedUserRef = useRef('')
  const activityRef = useRef(activityForPath(pathname))

  const acceptSafety = useCallback(() => {
    sessionStorage.setItem('mel-online-consent', 'yes')
    localStorage.removeItem('mel-online-consent')
    safetyAcceptedRef.current = true
    setSafetyAccepted(true)
  }, [])

  const clearHeartbeat = useCallback(() => {
    if (heartbeatRef.current !== null) window.clearInterval(heartbeatRef.current)
    heartbeatRef.current = null
  }, [])

  const disconnect = useCallback(() => {
    clearHeartbeat()
    if (supabase && channelRef.current) void supabase.removeChannel(channelRef.current)
    channelRef.current = null
    connectedUserRef.current = ''
  }, [clearHeartbeat])

  useEffect(() => disconnect, [disconnect])

  const heartbeat = useCallback(async () => {
    if (!supabase || !connectedUserRef.current) return
    const activity = activityRef.current
    const result = await supabase.rpc('heartbeat_online_presence', {
      next_activity: activity.activity,
      next_game_key: activity.gameKey,
    })
    if (result.error) throw result.error
  }, [])

  const loadPlayers = useCallback(async () => {
    if (!supabase) return
    const result = await supabase.from('online_presence').select('*')
      .gt('updated_at', new Date(Date.now() - 90_000).toISOString())
      .order('display_name', { ascending: true })
    if (result.error) throw result.error
    setPlayers((result.data || []).map(row => ({
      userId: row.user_id,
      name: String(row.display_name).slice(0, 16),
      avatar: String(row.avatar).slice(0, 12),
      activity: row.activity,
      gameKey: row.game_key,
      updatedAt: row.updated_at,
    })) as OnlinePlayer[])
  }, [])

  const loadGroups = useCallback(async () => {
    if (!supabase) return
    const result = await supabase.from('online_groups').select('*').eq('status', 'active').order('updated_at', { ascending: false })
    if (result.error) throw result.error
    setGroups((result.data || []) as OnlineGroup[])
  }, [])

  const loadMessages = useCallback(async () => {
    if (!supabase) return
    const result = await supabase.from('online_lobby_messages').select('*')
      .gt('expires_at', new Date().toISOString()).order('created_at', { ascending: false }).limit(20)
    if (result.error) throw result.error
    setLobbyMessages((result.data || []).reverse().map(row => ({
      id: row.id,
      senderId: row.sender_id,
      name: row.sender_name,
      avatar: row.sender_avatar,
      text: LOBBY_QUICK_MESSAGES[row.message_index] || '',
    })).filter(message => message.text))
  }, [])

  const loadInvites = useCallback(async (currentUserId: string) => {
    if (!supabase) return
    const [playResult, groupResult] = await Promise.all([
      supabase.from('online_invites').select('*').eq('to_user', currentUserId).eq('status', 'pending')
        .gt('expires_at', new Date().toISOString()).order('created_at', { ascending: false }).limit(5),
      supabase.from('online_group_invites').select('*').eq('to_user', currentUserId).eq('status', 'pending')
        .gt('expires_at', new Date().toISOString()).order('created_at', { ascending: false }).limit(10),
    ])
    if (playResult.error) throw playResult.error
    if (groupResult.error) throw groupResult.error
    setInvites((playResult.data || []) as OnlineInvite[])
    setGroupInvites((groupResult.data || []) as OnlineGroupInvite[])
  }, [])

  const refreshOnline = useCallback(async () => {
    if (!connectedUserRef.current) return
    try {
      await Promise.all([loadPlayers(), loadGroups(), loadMessages(), loadInvites(connectedUserRef.current)])
    } catch (refreshError) {
      setError(friendlyError(refreshError))
    }
  }, [loadGroups, loadInvites, loadMessages, loadPlayers])

  const connect = useCallback(async () => {
    if (!safetyAcceptedRef.current) {
      setStatus('idle')
      setError('Confirme as orientações de segurança antes de entrar no Online.')
      return
    }
    if (connectedUserRef.current) return
    if (connectionRef.current) return connectionRef.current
    const task = (async () => {
      if (!supabase) {
        setStatus('error')
        setError('O modo Online ainda não foi configurado neste site.')
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
        let profileResult = await supabase.rpc('upsert_online_profile', {
          next_display_name: playerName.slice(0, 16),
          next_avatar: playerAvatar.slice(0, 12),
        })
        if (profileResult.error?.code === 'PGRST303') {
          await new Promise(resolve => window.setTimeout(resolve, 3_000))
          profileResult = await supabase.rpc('upsert_online_profile', {
            next_display_name: playerName.slice(0, 16),
            next_avatar: playerAvatar.slice(0, 12),
          })
        }
        if (profileResult.error) throw profileResult.error

        await supabase.realtime.setAuth(session.access_token)
        connectedUserRef.current = currentUserId
        setUserId(currentUserId)
        await heartbeat()

        const channel = supabase.channel(`online-events:${currentUserId}`)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'online_presence' }, () => { void loadPlayers() })
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'online_lobby_messages' }, () => { void loadMessages() })
          .on('postgres_changes', { event: '*', schema: 'public', table: 'online_invites', filter: `to_user=eq.${currentUserId}` }, () => { void loadInvites(currentUserId) })
          .on('postgres_changes', { event: '*', schema: 'public', table: 'online_group_invites', filter: `to_user=eq.${currentUserId}` }, () => { void loadInvites(currentUserId) })
          .on('postgres_changes', { event: '*', schema: 'public', table: 'online_group_members', filter: `user_id=eq.${currentUserId}` }, () => { void loadGroups() })

        await new Promise<void>((resolve, reject) => {
          channel.subscribe((subscriptionStatus, subscriptionError) => {
            if (subscriptionStatus === 'SUBSCRIBED') resolve()
            else if (subscriptionStatus === 'CHANNEL_ERROR' || subscriptionStatus === 'TIMED_OUT') reject(subscriptionError || new Error(subscriptionStatus))
          })
        })
        channelRef.current = channel
        await Promise.all([loadPlayers(), loadGroups(), loadMessages(), loadInvites(currentUserId)])
        clearHeartbeat()
        heartbeatRef.current = window.setInterval(() => {
          void heartbeat().then(loadPlayers).catch(heartbeatError => setError(friendlyError(heartbeatError)))
        }, 25_000)
        setStatus('connected')
      } catch (connectionError) {
        disconnect()
        setStatus('error')
        setError(friendlyError(connectionError))
      }
    })()
    connectionRef.current = task.finally(() => { connectionRef.current = null })
    return connectionRef.current
  }, [clearHeartbeat, disconnect, heartbeat, loadGroups, loadInvites, loadMessages, loadPlayers, playerAvatar, playerName])

  useEffect(() => {
    activityRef.current = activityForPath(pathname)
    if (connectedUserRef.current) void heartbeat().then(loadPlayers).catch(activityError => setError(friendlyError(activityError)))
  }, [heartbeat, loadPlayers, pathname])

  useEffect(() => {
    localStorage.removeItem('mel-online-consent')
    if (safetyAccepted) void connect()
  }, [connect, safetyAccepted])

    const goOffline = useCallback(() => {
    clearHeartbeat()
    const lastUser = connectedUserRef.current;
    
    // Disconnect locally IMMEDIATELY for snappy UX
    disconnect()
    sessionStorage.removeItem('mel-online-consent')
    localStorage.removeItem('mel-online-consent')
    safetyAcceptedRef.current = false
    setSafetyAccepted(false)
    setStatus('idle')
    setUserId('')
    setPlayers([])
    setInvites([])
    setGroupInvites([])
    setGroups([])
    setLobbyMessages([])
    setError('')

    // Notify server asynchronously
    if (supabase && lastUser) {
      supabase.rpc('go_offline').then(result => {
        if (result.error) {
          window.setTimeout(() => supabase.rpc('go_offline'), 500)
        }
      }).catch(err => {
        console.error('Background offline rpc failed', err)
      })
    }
  }, [clearHeartbeat, disconnect])

  const sendLobbyMessage = useCallback(async (messageIndex: number) => {
    if (!supabase || !LOBBY_QUICK_MESSAGES[messageIndex]) return
    const result = await supabase.rpc('send_online_lobby_message', { next_message_index: messageIndex })
    if (result.error) throw new Error(friendlyError(result.error))
    await loadMessages()
  }, [loadMessages])

  const invitePlayer = useCallback(async (guestId: string, gameType?: string) => {
    if (!supabase) throw new Error('NOT_CONFIGURED')
    setError('')
    const result = await supabase.rpc('create_online_invite', {
      guest: guestId,
      game_type: gameType ?? 'tic-tac-toe',
    })
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
    setInvites(previous => previous.filter(item => item.id !== inviteId))
    if (!result.data) throw new Error('Esse convite expirou. Peça um novo convite.')
    return String(result.data)
  }, [])

  const createGroup = useCallback(async (name: string) => {
    if (!supabase) throw new Error('NOT_CONFIGURED')
    const result = await supabase.rpc('create_online_group', { group_name: name })
    if (result.error) throw new Error(friendlyError(result.error))
    await loadGroups()
    return String(result.data)
  }, [loadGroups])

  const inviteToGroup = useCallback(async (groupId: string, guestId: string) => {
    if (!supabase) throw new Error('NOT_CONFIGURED')
    const result = await supabase.rpc('invite_online_group', { target_group: groupId, guest: guestId })
    if (result.error) throw new Error(friendlyError(result.error))
  }, [])

  const respondGroupInvite = useCallback(async (inviteId: string, accept: boolean) => {
    if (!supabase) throw new Error('NOT_CONFIGURED')
    const result = await supabase.rpc('respond_online_group_invite', { invite: inviteId, accept_invite: accept })
    if (result.error) throw new Error(friendlyError(result.error))
    setGroupInvites(previous => previous.filter(item => item.id !== inviteId))
    if (!result.data) throw new Error('Esse convite de grupo expirou.')
    await loadGroups()
    return String(result.data)
  }, [loadGroups])

  const blockPlayer = useCallback(async (targetId: string) => {
    if (!supabase) return
    const result = await supabase.rpc('block_online_player', { target: targetId })
    if (result.error) throw new Error(friendlyError(result.error))
    await refreshOnline()
  }, [refreshOnline])

  const reportPlayer = useCallback(async (targetId: string, reason: string, context: 'lobby' | 'room' | 'group', evidence = '') => {
    if (!supabase) return
    const result = await supabase.rpc('report_online_player', {
      target: targetId,
      report_reason: reason,
      report_context: context,
      report_evidence: evidence,
    })
    if (result.error) throw new Error(friendlyError(result.error))
  }, [])

  return (
    <OnlineContext.Provider value={{
      configured: onlineConfigured,
      safetyAccepted,
      status,
      userId,
      players,
      invites: invites.filter(pendingInvite),
      groupInvites: groupInvites.filter(pendingInvite),
      groups,
      lobbyMessages,
      error,
      acceptSafety,
      goOffline,
      connect,
      refreshOnline,
      sendLobbyMessage,
      invitePlayer,
      respondInvite,
      createGroup,
      inviteToGroup,
      respondGroupInvite,
      blockPlayer,
      reportPlayer,
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

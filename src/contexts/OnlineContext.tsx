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
import type { OnlineGameKey } from '../online/types'
import { usePlayer } from './PlayerContext'

interface OnlineContextValue {
  configured: boolean
  safetyAccepted: boolean
  status: OnlineStatus
  userId: string
  friendCode: string
  players: OnlinePlayer[]
  invites: OnlineInvite[]
  groupInvites: OnlineGroupInvite[]
  groups: OnlineGroup[]
  lobbyMessages: OnlineLobbyMessage[]
  error: string
  acceptSafety: () => void
  connect: () => Promise<void>
  refreshOnline: () => Promise<void>
  sendLobbyMessage: (messageIndex: number) => Promise<void>
  invitePlayer: (guestId: string, gameType?: string) => Promise<string>
  invitePlayerByCode: (friendCode: string, gameType?: string) => Promise<string>
  respondInvite: (inviteId: string, accept: boolean) => Promise<string>
  createGroup: (name: string) => Promise<string>
  inviteToGroup: (groupId: string, guestId: string) => Promise<void>
  respondGroupInvite: (inviteId: string, accept: boolean) => Promise<string>
  blockPlayer: (targetId: string) => Promise<void>
  reportPlayer: (targetId: string, reason: string, context: 'lobby' | 'room' | 'group', evidence?: string) => Promise<void>
  setPlayingGame: (gameKey: OnlineGameKey | null) => void
}

const OnlineContext = createContext<OnlineContextValue | null>(null)

function readOnlineConsent() {
  try { return window.sessionStorage.getItem('mel-online-consent') === 'yes' } catch { return false }
}
function clearLegacyOnlineConsent() {
  try { window.localStorage.removeItem('mel-online-consent') } catch { /* Storage can be blocked by the browser. */ }
}

function saveOnlineConsent() {
  try { window.sessionStorage.setItem('mel-online-consent', 'yes') } catch { /* The safety gate still works for this session. */ }
  clearLegacyOnlineConsent()
}

function friendlyError(error: unknown) {
  const message = error instanceof Error ? error.message : (error && typeof error === 'object' && 'message' in error) ? String((error as any).message) : String(error || '')
  if (message.includes('Anonymous sign-ins are disabled')) return 'O acesso de jogadores ainda precisa ser ativado no Supabase.'
  if (message.includes('AUTH_REQUIRED') || message.includes('JWT')) return 'A conexão segura ainda não ficou pronta. Tente novamente.'
  if (message.includes('CANNOT_INVITE_SELF')) return 'Você não pode convidar a si mesmo.'
  if (message.includes('INVITE_RATE_LIMIT')) return 'Espere alguns segundos antes de enviar outro convite.'
  if (message.includes('MESSAGE_RATE_LIMIT')) return 'Espere um pouquinho antes de enviar outra mensagem.'
  if (message.includes('REPORT_RATE_LIMIT')) return 'A denúncia anterior já foi recebida. Espere um pouco antes de enviar outra.'
  if (message.includes('PLAYER_OFFLINE')) return 'Esse jogador acabou de sair do Online.'
  if (message.includes('PLAYER_BUSY')) return 'Você já está em uma partida. Termine ou saia dela antes de continuar.'
  if (message.includes('PLAYER_BLOCKED')) return 'Essa interação não está disponível.'
  if (message.includes('FRIEND_CODE_INVALID') || message.includes('FRIEND_CODE_NOT_FOUND')) return 'Esse código não foi encontrado. Confira as 6 letras e números.'
  if (message.includes('GROUP_FULL')) return 'Esse grupo já está cheio.'
  if (message.includes('GROUP_LIMIT')) return 'Você já criou o máximo de cinco grupos.'
  if (message.includes('ALREADY_MEMBER')) return 'Esse jogador já participa do grupo.'
  if (message.includes('INVITE_EXPIRED') || message.includes('INVITE_UNAVAILABLE')) return 'Esse convite expirou ou já foi respondido.'
  if (message.includes('INVALID_AVATAR')) return 'Seu avatar antigo não é mais aceito. Usamos uma estrela segura para você entrar.'
  if (message.includes('INVALID_GAME')) return 'Esse jogo ainda não está disponível no Online.'
  if (/failed to fetch|network|fetch/i.test(message)) return 'A internet demorou para responder. Tente novamente em instantes.'
  return 'Não foi possível conectar agora. Tente novamente em instantes.'
}

const ONLINE_AVATARS = new Set(['⭐', '🕊️', '🐑', '🌈', '🦁', '🐟', '📖', '🌿'])

function pendingInvite<T extends { status: string; expires_at: string }>(invite: T) {
  return invite.status === 'pending' && new Date(invite.expires_at).getTime() > Date.now()
}

export function OnlineProvider({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  const { playerName, playerAvatar } = usePlayer()
  const [status, setStatus] = useState<OnlineStatus>('idle')
  const [userId, setUserId] = useState('')
  const [friendCode, setFriendCode] = useState('')
  const [players, setPlayers] = useState<OnlinePlayer[]>([])
  const [invites, setInvites] = useState<OnlineInvite[]>([])
  const [groupInvites, setGroupInvites] = useState<OnlineGroupInvite[]>([])
  const [groups, setGroups] = useState<OnlineGroup[]>([])
  const [lobbyMessages, setLobbyMessages] = useState<OnlineLobbyMessage[]>([])
  const [error, setError] = useState('')
  const [safetyAccepted, setSafetyAccepted] = useState(readOnlineConsent)
  const channelRef = useRef<RealtimeChannel | null>(null)
  const heartbeatRef = useRef<number | null>(null)
  const invitesRefreshRef = useRef<number | null>(null)
  const connectionRef = useRef<Promise<void> | null>(null)
  const presenceAutoStartedRef = useRef(false)
  const pausedRef = useRef(false)
  const connectedUserRef = useRef('')
  const activityRef = useRef(activityForPath(pathname))

  const acceptSafety = useCallback(() => {
    saveOnlineConsent()
    setSafetyAccepted(true)
  }, [])

  const clearHeartbeat = useCallback(() => {
    if (heartbeatRef.current !== null) window.clearInterval(heartbeatRef.current)
    heartbeatRef.current = null
  }, [])

  const clearInvitesRefresh = useCallback(() => {
    if (invitesRefreshRef.current !== null) window.clearInterval(invitesRefreshRef.current)
    invitesRefreshRef.current = null
  }, [])

  const disconnect = useCallback(() => {
    clearHeartbeat()
    clearInvitesRefresh()
    if (supabase && channelRef.current) void supabase.removeChannel(channelRef.current)
    channelRef.current = null
    connectedUserRef.current = ''
  }, [clearHeartbeat, clearInvitesRefresh])

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
    if (!supabase || !connectedUserRef.current) return
    const result = await supabase.rpc('list_online_players')
    if (result.error) throw result.error
    setPlayers((result.data || []).map((row: any) => ({
      userId: String(row.user_id), name: String(row.display_name || '').slice(0, 16),
      avatar: String(row.avatar || '?').slice(0, 12), activity: row.activity,
      gameKey: row.game_key, updatedAt: row.updated_at,
    })) as OnlinePlayer[])
  }, [])

  const setPlayingGame = useCallback((gameKey: OnlineGameKey | null) => {
    activityRef.current = gameKey
      ? { activity: 'playing', gameKey }
      : pathname.startsWith('/online/sala/') ? { activity: 'lobby', gameKey: null } : activityForPath(pathname)
    if (connectedUserRef.current) {
      void heartbeat().then(loadPlayers).catch(activityError => setError(friendlyError(activityError)))
    }
  }, [heartbeat, loadPlayers, pathname])

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
      // A secure RPC joins the pending room server-side and returns only
      // invitations addressed to this anonymous user, including the game.
      supabase.rpc('list_my_online_invites'),
      supabase.from('online_group_invites').select('*').eq('to_user', currentUserId).eq('status', 'pending')
        .gt('expires_at', new Date().toISOString()).order('created_at', { ascending: false }).limit(10),
    ])
    if (playResult.error) throw playResult.error
    if (groupResult.error) throw groupResult.error
    setInvites((playResult.data || []).map((row: any) => ({ ...row, game: row.game })) as OnlineInvite[])
    setGroupInvites((groupResult.data || []) as OnlineGroupInvite[])
  }, [])

  const refreshOnline = useCallback(async () => {
    if (!connectedUserRef.current) return
    try {
      await Promise.all([loadPlayers(), loadGroups(), loadMessages(), loadInvites(connectedUserRef.current)])
      setError('')
    } catch (refreshError) {
      setError(friendlyError(refreshError))
    }
  }, [loadGroups, loadInvites, loadMessages, loadPlayers])

  const connect = useCallback(async () => {
    if (pausedRef.current || connectedUserRef.current) return
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
        const safeAvatar = ONLINE_AVATARS.has(playerAvatar) ? playerAvatar : '⭐'
        let profileResult = await supabase.rpc('upsert_online_profile', {
          next_display_name: playerName.slice(0, 16),
          next_avatar: safeAvatar,
        })
        if (profileResult.error?.code === 'PGRST303') {
          await new Promise(resolve => window.setTimeout(resolve, 3_000))
          profileResult = await supabase.rpc('upsert_online_profile', {
            next_display_name: playerName.slice(0, 16),
            next_avatar: safeAvatar,
          })
        }
        if (profileResult.error) throw profileResult.error

        await supabase.realtime.setAuth(session.access_token)
        connectedUserRef.current = currentUserId
        setUserId(currentUserId)
        setFriendCode(String((profileResult.data as { friend_code?: string } | null)?.friend_code || ''))
        await heartbeat()

        const channel = supabase.channel(`online-events:${currentUserId}`)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'online_presence' }, () => { void loadPlayers().catch(refreshError => setError(friendlyError(refreshError))) })
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'online_lobby_messages' }, () => { void loadMessages().catch(refreshError => setError(friendlyError(refreshError))) })
          .on('postgres_changes', { event: '*', schema: 'public', table: 'online_invites', filter: `to_user=eq.${currentUserId}` }, () => { void loadInvites(currentUserId).catch(refreshError => setError(friendlyError(refreshError))) })
          .on('postgres_changes', { event: '*', schema: 'public', table: 'online_group_invites', filter: `to_user=eq.${currentUserId}` }, () => { void loadInvites(currentUserId).catch(refreshError => setError(friendlyError(refreshError))) })
          .on('postgres_changes', { event: '*', schema: 'public', table: 'online_group_members', filter: `user_id=eq.${currentUserId}` }, () => { void loadGroups().catch(refreshError => setError(friendlyError(refreshError))) })

        channelRef.current = channel
        // Realtime is an optimization here. It can be suspended or blocked on
        // mobile networks, so it must not keep the player stuck in "connecting".
        channel.subscribe(subscriptionStatus => {
          if (subscriptionStatus === 'CHANNEL_ERROR' || subscriptionStatus === 'TIMED_OUT') {
            void loadInvites(currentUserId).catch(refreshError => setError(friendlyError(refreshError)))
          }
        })
        const initialLoads = await Promise.allSettled([loadPlayers(), loadGroups(), loadMessages(), loadInvites(currentUserId)])
        const initialLoadError = initialLoads.find(result => result.status === 'rejected')
        if (initialLoadError?.status === 'rejected') setError(friendlyError(initialLoadError.reason))
        clearHeartbeat()
        clearInvitesRefresh()
        heartbeatRef.current = window.setInterval(() => {
          void heartbeat().then(loadPlayers).catch(heartbeatError => setError(friendlyError(heartbeatError)))
        }, 25_000)
        invitesRefreshRef.current = window.setInterval(() => {
          const currentUser = connectedUserRef.current
          if (currentUser) {
            void Promise.all([loadInvites(currentUser), loadPlayers()]).catch(refreshError => setError(friendlyError(refreshError)))
          }
        }, 3_000)
        setStatus('connected')
        if (!initialLoadError) setError('')
      } catch (connectionError) {
        disconnect()
        setStatus('error')
        setError(friendlyError(connectionError))
      }
    })()
    connectionRef.current = task.finally(() => { connectionRef.current = null })
    return connectionRef.current
  }, [clearHeartbeat, clearInvitesRefresh, disconnect, heartbeat, loadGroups, loadInvites, loadMessages, loadPlayers, playerAvatar, playerName])

  useEffect(() => {
    activityRef.current = activityForPath(pathname)
    if (connectedUserRef.current) void heartbeat().then(loadPlayers).catch(activityError => setError(friendlyError(activityError)))
  }, [heartbeat, loadPlayers, pathname])

  useEffect(() => {
    const refreshWhenVisible = () => {
      if (document.visibilityState !== 'visible' || !connectedUserRef.current) return
      void heartbeat().then(refreshOnline).catch(refreshError => setError(friendlyError(refreshError)))
    }
    document.addEventListener('visibilitychange', refreshWhenVisible)
    return () => document.removeEventListener('visibilitychange', refreshWhenVisible)
  }, [heartbeat, refreshOnline])

  useEffect(() => { clearLegacyOnlineConsent() }, [])

  useEffect(() => {
    if (pausedRef.current || presenceAutoStartedRef.current) return
    presenceAutoStartedRef.current = true
    void connect()
  }, [connect])

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

  const invitePlayerByCode = useCallback(async (code: string, gameType?: string) => {
    if (!supabase) throw new Error('NOT_CONFIGURED')
    setError('')
    const result = await supabase.rpc('create_online_invite_by_code', {
      friend_code: code.replace(/\s+/g, '').toUpperCase(),
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
      friendCode,
      players,
      invites: invites.filter(pendingInvite),
      groupInvites: groupInvites.filter(pendingInvite),
      groups,
      lobbyMessages,
      error,
      acceptSafety,
      connect,
      refreshOnline,
      sendLobbyMessage,
      invitePlayer,
      invitePlayerByCode,
      respondInvite,
      createGroup,
      inviteToGroup,
      respondGroupInvite,
      blockPlayer,
      reportPlayer,
      setPlayingGame,
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

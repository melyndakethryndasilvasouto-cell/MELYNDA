import { createClient } from '@supabase/supabase-js'

const url = process.env.VITE_SUPABASE_URL || ''
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || ''
if (!url || !key) throw new Error('Defina VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY para o teste online.')

function client() {
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } })
}

function waitForSubscription(channel, label) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Tempo esgotado no canal ${label}`)), 12_000)
    channel.subscribe((status, error) => {
      if (status === 'SUBSCRIBED') {
        clearTimeout(timer)
        resolve()
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        clearTimeout(timer)
        reject(error || new Error(`${label}: ${status}`))
      }
    })
  })
}

async function upsertProfile(owner, profile) {
  let result = await owner.from('online_profiles').upsert(profile)
  if (result.error?.code === 'PGRST303') {
    await new Promise(resolve => setTimeout(resolve, 3_500))
    result = await owner.from('online_profiles').upsert(profile)
  }
  return result
}

const first = client()
const second = client()
const channels = []
let roomId = ''

try {
  const [firstAuth, secondAuth] = await Promise.all([
    first.auth.signInAnonymously(),
    second.auth.signInAnonymously(),
  ])
  if (firstAuth.error) throw firstAuth.error
  if (secondAuth.error) throw secondAuth.error
  const firstSession = firstAuth.data.session
  const secondSession = secondAuth.data.session
  if (!firstSession || !secondSession) throw new Error('Sessões anônimas não foram criadas.')

  const firstId = firstSession.user.id
  const secondId = secondSession.user.id
  const profileResults = await Promise.all([
    upsertProfile(first, { user_id: firstId, display_name: 'Teste Kairos A', avatar: '⭐' }),
    upsertProfile(second, { user_id: secondId, display_name: 'Teste Kairos B', avatar: '🕊️' }),
  ])
  for (const result of profileResults) if (result.error) throw result.error

  await Promise.all([
    first.realtime.setAuth(firstSession.access_token),
    second.realtime.setAuth(secondSession.access_token),
  ])
  const firstLobby = first.channel('online:lobby', { config: { private: true, presence: { key: firstId } } })
  const secondLobby = second.channel('online:lobby', { config: { private: true, presence: { key: secondId } } })
  channels.push([first, firstLobby], [second, secondLobby])
  await Promise.all([
    waitForSubscription(firstLobby, 'saguão A'),
    waitForSubscription(secondLobby, 'saguão B'),
  ])
  await Promise.all([
    firstLobby.track({ userId: firstId, name: 'Teste Kairos A', avatar: '⭐' }),
    secondLobby.track({ userId: secondId, name: 'Teste Kairos B', avatar: '🕊️' }),
  ])

  const invitation = await first.rpc('create_online_invite', { guest: secondId })
  if (invitation.error) throw invitation.error
  roomId = String(invitation.data)
  const pending = await second.from('online_invites').select('*').eq('room_id', roomId).single()
  if (pending.error || pending.data?.to_user !== secondId) throw pending.error || new Error('Convite não ficou isolado para o destinatário.')
  const accepted = await second.rpc('respond_online_invite', { invite: pending.data.id, accept_invite: true })
  if (accepted.error || String(accepted.data) !== roomId) throw accepted.error || new Error('Convite não foi aceito.')

  const [firstRoomResult, secondRoomResult] = await Promise.all([
    first.from('online_rooms').select('*').eq('id', roomId).single(),
    second.from('online_rooms').select('*').eq('id', roomId).single(),
  ])
  if (firstRoomResult.error || secondRoomResult.error) throw firstRoomResult.error || secondRoomResult.error
  if (firstRoomResult.data.status !== 'active' || secondRoomResult.data.guest_id !== secondId) throw new Error('Sala não ativou com os dois participantes.')

  const moves = [
    [first, 0], [second, 3], [first, 1], [second, 4], [first, 2],
  ]
  for (const [participant, cell] of moves) {
    const move = await participant.rpc('play_online_ttt', { room: roomId, cell })
    if (move.error) throw move.error
  }
  const finalRoom = await first.from('online_rooms').select('*').eq('id', roomId).single()
  if (finalRoom.error || finalRoom.data.state.result !== 'X' || finalRoom.data.status !== 'finished') {
    throw finalRoom.error || new Error('Resultado da partida não foi validado no servidor.')
  }
  const invalidMove = await second.rpc('play_online_ttt', { room: roomId, cell: 8 })
  if (!invalidMove.error) throw new Error('Servidor aceitou jogada após a partida terminar.')

  let receivedText = ''
  const firstRoomChannel = first.channel(`online:room:${roomId}`, { config: { private: true, broadcast: { ack: true } } })
  const secondRoomChannel = second.channel(`online:room:${roomId}`, { config: { private: true, broadcast: { ack: true } } })
    .on('broadcast', { event: 'room-chat' }, ({ payload }) => { receivedText = payload?.text || '' })
  channels.push([first, firstRoomChannel], [second, secondRoomChannel])
  await Promise.all([
    waitForSubscription(firstRoomChannel, 'sala A'),
    waitForSubscription(secondRoomChannel, 'sala B'),
  ])
  await new Promise(resolve => setTimeout(resolve, 400))
  const broadcastStatus = await firstRoomChannel.send({ type: 'broadcast', event: 'room-chat', payload: { senderId: firstId, text: 'Paz e bom jogo!' } })
  if (broadcastStatus !== 'ok') throw new Error(`Envio privado recusado pelo Realtime: ${broadcastStatus}`)
  const deadline = Date.now() + 4_000
  while (!receivedText && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 80))
  if (receivedText !== 'Paz e bom jogo!') throw new Error('Mensagem privada não chegou ao segundo jogador.')

  console.log('ONLINE_VERIFY_OK anonymous_users=2 presence=ok invite=ok room_rls=ok server_moves=5 invalid_move=blocked private_chat=ok')
} finally {
  if (roomId) await Promise.resolve(first.rpc('leave_online_room', { room: roomId })).catch(() => {})
  for (const [owner, channel] of channels) await Promise.resolve(owner.removeChannel(channel)).catch(() => {})
  await Promise.allSettled([first.auth.signOut(), second.auth.signOut()])
}

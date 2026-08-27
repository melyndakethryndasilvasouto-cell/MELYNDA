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

async function requireOk(resultPromise, label) {
  const result = await resultPromise
  if (result.error) throw new Error(`${label}: ${result.error.message}`)
  return result.data
}

async function upsertProfile(owner, displayName, avatar) {
  let result = await owner.rpc('upsert_online_profile', { next_display_name: displayName, next_avatar: avatar })
  if (result.error?.code === 'PGRST303' || result.error?.message?.includes('JWT issued at future')) {
    await new Promise(resolve => setTimeout(resolve, 3_500))
    result = await owner.rpc('upsert_online_profile', { next_display_name: displayName, next_avatar: avatar })
  }
  if (result.error) throw new Error(`perfil: ${result.error.message}`)
  return result.data
}

const first = client()
const second = client()
const third = client()
const participants = [first, second, third]
const channels = []
let roomId = ''
let competingRoomId = ''
let groupId = ''

try {
  const authResults = await Promise.all(participants.map(owner => owner.auth.signInAnonymously()))
  for (const result of authResults) if (result.error) throw result.error
  const sessions = authResults.map(result => result.data.session)
  if (sessions.some(session => !session)) throw new Error('As três sessões anônimas não foram criadas.')
  const [firstSession, secondSession, thirdSession] = sessions
  const [firstId, secondId, thirdId] = sessions.map(session => session.user.id)

  await Promise.all([
    upsertProfile(first, 'Amigo Estrela', '⭐'),
    upsertProfile(second, 'Amigo Pomba', '🕊️'),
    upsertProfile(third, 'Amigo Leao', '🦁'),
  ])
  await Promise.all([
    first.realtime.setAuth(firstSession.access_token),
    second.realtime.setAuth(secondSession.access_token),
    third.realtime.setAuth(thirdSession.access_token),
  ])
  await Promise.all(participants.map(owner => requireOk(owner.rpc('heartbeat_online_presence', {
    next_activity: 'lobby', next_game_key: null,
  }), 'presença')))

  const visible = await requireOk(first.from('online_presence').select('user_id'), 'lista de presença')
  if (![firstId, secondId, thirdId].every(id => visible.some(row => row.user_id === id))) {
    throw new Error('A presença não mostrou os três apelidos de teste.')
  }
  await requireOk(first.rpc('send_online_lobby_message', { next_message_index: 0 }), 'frase segura no saguão')
  const lobby = await requireOk(second.from('online_lobby_messages').select('sender_id,message_index').eq('sender_id', firstId), 'leitura do saguão')
  if (!lobby.some(message => message.message_index === 0)) throw new Error('A frase aprovada do saguão não foi recebida.')

  groupId = String(await requireOk(first.rpc('create_online_group', { group_name: 'Turma da Paz' }), 'criação do grupo'))
  const groupInviteId = String(await requireOk(first.rpc('invite_online_group', { target_group: groupId, guest: secondId }), 'convite do grupo'))
  const forbiddenInvite = await third.rpc('invite_online_group', { target_group: groupId, guest: secondId })
  if (!forbiddenInvite.error) throw new Error('Um jogador que não é dono conseguiu convidar para o grupo.')
  await requireOk(second.rpc('respond_online_group_invite', { invite: groupInviteId, accept_invite: true }), 'entrada no grupo')

  const strangerGroup = await third.from('online_groups').select('id').eq('id', groupId)
  if (strangerGroup.error || strangerGroup.data.length !== 0) throw strangerGroup.error || new Error('Pessoa sem convite conseguiu ver o grupo.')
  await requireOk(first.rpc('send_online_group_message', { target_group: groupId, message_text: 'Vamos jogar juntos' }), 'texto do grupo')
  await requireOk(second.rpc('send_online_group_audio', {
    target_group: groupId,
    audio_value: 'data:audio/webm;base64,GkXfo0AgQoaBAULygQRC84EIQoKEd2VibQ==',
    mime_value: 'audio/webm',
    duration_value: 500,
  }), 'áudio curto do grupo')
  const groupMessages = await requireOk(first.from('online_group_messages').select('kind,body').eq('group_id', groupId), 'mensagens do grupo')
  if (!groupMessages.some(message => message.kind === 'text') || !groupMessages.some(message => message.kind === 'audio')) {
    throw new Error('Texto e áudio não ficaram disponíveis apenas no grupo.')
  }
  const personalData = await second.rpc('send_online_group_message', { target_group: groupId, message_text: 'meu telefone 11999999999' })
  if (!personalData.error) throw new Error('O servidor aceitou telefone em mensagem infantil.')

  roomId = String(await requireOk(first.rpc('create_online_invite', { guest: secondId }), 'convite da partida'))
  competingRoomId = String(await requireOk(third.rpc('create_online_invite', { guest: secondId }), 'convite concorrente'))
  const pending = await requireOk(second.from('online_invites').select('*').eq('room_id', roomId).single(), 'leitura do convite')
  await requireOk(second.rpc('respond_online_invite', { invite: pending.id, accept_invite: true }), 'aceite da partida')
  const competing = await requireOk(third.from('online_rooms').select('status').eq('id', competingRoomId).single(), 'sala concorrente')
  if (competing.status !== 'cancelled') throw new Error('A sala concorrente não foi encerrada após o aceite.')

  const [firstRoom, secondRoom] = await Promise.all([
    requireOk(first.from('online_rooms').select('*').eq('id', roomId).single(), 'sala A'),
    requireOk(second.from('online_rooms').select('*').eq('id', roomId).single(), 'sala B'),
  ])
  if (firstRoom.status !== 'active' || secondRoom.guest_id !== secondId) throw new Error('Sala não ativou com os dois participantes.')

  await requireOk(first.rpc('send_online_room_message', { target_room: roomId, message_text: 'Paz e bom jogo' }), 'texto da sala')
  await requireOk(second.rpc('send_online_room_audio', {
    target_room: roomId,
    audio_value: 'data:audio/webm;base64,GkXfo0AgQoaBAULygQRC84EIQoKEd2VibQ==',
    mime_value: 'audio/webm',
    duration_value: 500,
  }), 'áudio curto da sala')
  const roomMessages = await requireOk(second.from('online_room_messages').select('kind,body').eq('room_id', roomId), 'mensagens da sala')
  if (!roomMessages.some(message => message.kind === 'text') || !roomMessages.some(message => message.kind === 'audio')) {
    throw new Error('Texto e áudio privados da partida não foram recebidos.')
  }

  const moves = [[first, 0], [second, 3], [first, 1], [second, 4], [first, 2]]
  for (const [participant, cell] of moves) await requireOk(participant.rpc('play_online_ttt', { room: roomId, cell }), `jogada ${cell}`)
  const finalRoom = await requireOk(first.from('online_rooms').select('*').eq('id', roomId).single(), 'resultado da sala')
  if (finalRoom.state.result !== 'X' || finalRoom.status !== 'finished') throw new Error('Resultado da partida não foi validado no servidor.')
  const invalidMove = await second.rpc('play_online_ttt', { room: roomId, cell: 8 })
  if (!invalidMove.error) throw new Error('Servidor aceitou jogada após a partida terminar.')

  let signalReceived = false
  const firstRoomChannel = first.channel(`online:room:${roomId}`, { config: { private: true, broadcast: { ack: true } } })
  const secondRoomChannel = second.channel(`online:room:${roomId}`, { config: { private: true, broadcast: { ack: true } } })
    .on('broadcast', { event: 'voice-signal' }, () => { signalReceived = true })
  channels.push([first, firstRoomChannel], [second, secondRoomChannel])
  await Promise.all([waitForSubscription(firstRoomChannel, 'sinalização A'), waitForSubscription(secondRoomChannel, 'sinalização B')])
  await new Promise(resolve => setTimeout(resolve, 300))
  const broadcastStatus = await firstRoomChannel.send({ type: 'broadcast', event: 'voice-signal', payload: { type: 'test' } })
  if (broadcastStatus !== 'ok') throw new Error(`Sinalização privada recusada: ${broadcastStatus}`)
  const deadline = Date.now() + 4_000
  while (!signalReceived && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 80))
  if (!signalReceived) throw new Error('A sinalização privada do microfone não chegou.')

  await requireOk(first.rpc('report_online_player', { target: secondId, report_reason: 'other', report_context: 'room', report_evidence: 'teste automatizado' }), 'denúncia')
  await requireOk(first.rpc('block_online_player', { target: secondId }), 'bloqueio')
  const blockedPresence = await requireOk(first.from('online_presence').select('user_id').eq('user_id', secondId), 'presença após bloqueio')
  if (blockedPresence.length !== 0) throw new Error('Jogador bloqueado continuou visível.')
  const membersAfterBlock = await requireOk(first.from('online_group_members').select('user_id').eq('group_id', groupId), 'grupo após bloqueio')
  if (membersAfterBlock.some(member => member.user_id === secondId)) throw new Error('Jogador bloqueado permaneceu no grupo compartilhado.')
  const formerMemberMessages = await requireOk(second.from('online_group_messages').select('id').eq('group_id', groupId), 'privacidade após bloqueio')
  if (formerMemberMessages.length !== 0) throw new Error('Ex-participante continuou lendo o grupo após o bloqueio.')

  console.log('ONLINE_VERIFY_OK anonymous_users=3 server_presence=ok lobby_presets=ok groups_owner_only=ok group_rls=ok text_filter=ok short_audio=ok competing_invite=closed room_rls=ok server_moves=5 invalid_move=blocked voice_signal=private block_report=ok shared_group_removed=ok')
} finally {
  if (roomId) await Promise.resolve(first.rpc('leave_online_room', { room: roomId })).catch(() => {})
  if (competingRoomId) await Promise.resolve(third.rpc('leave_online_room', { room: competingRoomId })).catch(() => {})
  if (groupId) await Promise.resolve(first.rpc('close_online_group', { target_group: groupId })).catch(() => {})
  for (const [owner, channel] of channels) await Promise.resolve(owner.removeChannel(channel)).catch(() => {})
  await Promise.allSettled(participants.map(owner => owner.auth.signOut()))
}

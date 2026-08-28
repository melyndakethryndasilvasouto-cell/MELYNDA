import { readFile } from 'node:fs/promises'
import { createClient } from '@supabase/supabase-js'

function parseEnvFile(text) {
  return Object.fromEntries(text.split(/\r?\n/).flatMap(line => {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)\s*$/)
    return match ? [[match[1], match[2].trim()]] : []
  }))
}

const localEnv = parseEnvFile(await readFile(new URL('../.env.local', import.meta.url), 'utf8').catch(() => ''))
const url = process.env.VITE_SUPABASE_URL || localEnv.VITE_SUPABASE_URL || ''
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || localEnv.VITE_SUPABASE_PUBLISHABLE_KEY || ''
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
let raceRoomId = ''
let pendingBlockRoomId = ''
let arcadeRoomId = ''
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

  await new Promise(resolve => setTimeout(resolve, 8_200))
  arcadeRoomId = String(await requireOk(first.rpc('create_online_invite', { guest: secondId, game_type: 'coloring' }), 'convite Colorir online'))
  const arcadeInvite = await requireOk(second.from('online_invites').select('id').eq('room_id', arcadeRoomId).single(), 'convite Colorir online recebido')
  await requireOk(second.rpc('respond_online_invite', { invite: arcadeInvite.id, accept_invite: true }), 'aceite Colorir online')
  await requireOk(first.rpc('record_online_game_action', { room: arcadeRoomId, action: { type: 'color', index: 0, color: '#EF4444' } }), 'ação Colorir validada')
  const arcadeRoom = await requireOk(first.from('online_rooms').select('status,state').eq('id', arcadeRoomId).single(), 'estado Colorir online')
  if (arcadeRoom.status !== 'active' || arcadeRoom.state.last_action?.type !== 'color') throw new Error('A ação do jogo online compartilhado não foi registrada.')
  const invalidArcadeAction = await second.rpc('record_online_game_action', { room: arcadeRoomId, action: { type: 'invalid' } })
  if (!invalidArcadeAction.error) throw new Error('Servidor aceitou ação inválida do jogo online compartilhado.')
  await requireOk(first.rpc('leave_online_room', { room: arcadeRoomId }), 'limpeza da sala Colorir online')

  raceRoomId = String(await requireOk(third.rpc('create_online_invite', { guest: secondId }), 'convite para teste concorrente'))
  const raceInvite = await requireOk(second.from('online_invites').select('id').eq('room_id', raceRoomId).single(), 'convite concorrente para bloqueio')
  const [raceBlock, raceAccept] = await Promise.all([
    third.rpc('block_online_player', { target: secondId }),
    second.rpc('respond_online_invite', { invite: raceInvite.id, accept_invite: true }),
  ])
  if (raceBlock.error) throw new Error(`bloqueio concorrente: ${raceBlock.error.message}`)
  if ([raceBlock.error, raceAccept.error].some(error => error?.code === '40P01' || /deadlock/i.test(error?.message || ''))) {
    throw new Error('Aceite e bloqueio simultaneos causaram deadlock.')
  }
  const [raceRoom, raceStoredBlock] = await Promise.all([
    requireOk(third.from('online_rooms').select('status').eq('id', raceRoomId).single(), 'sala apos corrida de bloqueio'),
    requireOk(third.from('online_blocks').select('blocked_id').eq('blocked_id', secondId), 'bloqueio apos corrida'),
  ])
  if (raceRoom.status !== 'cancelled' || !raceStoredBlock.length) {
    throw new Error('Bloqueio simultaneo ao aceite nao encerrou a sala com seguranca.')
  }

  await new Promise(resolve => setTimeout(resolve, 8_200))
  pendingBlockRoomId = String(await requireOk(first.rpc('create_online_invite', { guest: secondId }), 'convite pendente antes do bloqueio'))
  await requireOk(first.rpc('report_online_player', { target: secondId, report_reason: 'other', report_context: 'room', report_evidence: 'teste automatizado' }), 'denúncia')
  await requireOk(first.rpc('block_online_player', { target: secondId }), 'bloqueio')
  const [pendingAfterBlock, pendingRoomAfterBlock, storedBlock] = await Promise.all([
    requireOk(first.from('online_invites').select('status').eq('room_id', pendingBlockRoomId).single(), 'convite após bloqueio'),
    requireOk(first.from('online_rooms').select('status').eq('id', pendingBlockRoomId).single(), 'sala pendente após bloqueio'),
    requireOk(first.from('online_blocks').select('blocked_id').eq('blocked_id', secondId), 'registro do bloqueio'),
  ])
  if (pendingAfterBlock.status !== 'expired' || pendingRoomAfterBlock.status !== 'cancelled' || !storedBlock.length) {
    throw new Error('Bloqueio com convite pendente não foi concluído atomicamente.')
  }
  const blockedPresence = await requireOk(first.from('online_presence').select('user_id').eq('user_id', secondId), 'presença após bloqueio')
  if (blockedPresence.length !== 0) throw new Error('Jogador bloqueado continuou visível.')
  const membersAfterBlock = await requireOk(first.from('online_group_members').select('user_id').eq('group_id', groupId), 'grupo após bloqueio')
  if (membersAfterBlock.some(member => member.user_id === secondId)) throw new Error('Jogador bloqueado permaneceu no grupo compartilhado.')
  const formerMemberMessages = await requireOk(second.from('online_group_messages').select('id').eq('group_id', groupId), 'privacidade após bloqueio')
  if (formerMemberMessages.length !== 0) throw new Error('Ex-participante continuou lendo o grupo após o bloqueio.')

  await requireOk(third.rpc('go_offline'), 'saida online atomica')
  const presenceAfterOffline = await requireOk(first.from('online_presence').select('user_id').eq('user_id', thirdId), 'presenca apos ficar offline')
  if (presenceAfterOffline.length !== 0) throw new Error('Jogador continuou visivel depois de ficar offline.')

  console.log('ONLINE_VERIFY_OK anonymous_users=3 server_presence=ok lobby_presets=ok groups_owner_only=ok group_rls=ok text_filter=ok short_audio=ok competing_invite=closed invite_race=serialized room_rls=ok server_moves=5 invalid_move=blocked shared_game=coloring_action_validated voice_signal=private pending_block=ok block_report=ok shared_group_removed=ok go_offline=ok')
} finally {
  if (roomId) await Promise.resolve(first.rpc('leave_online_room', { room: roomId })).catch(() => {})
  if (competingRoomId) await Promise.resolve(third.rpc('leave_online_room', { room: competingRoomId })).catch(() => {})
  if (raceRoomId) await Promise.resolve(third.rpc('leave_online_room', { room: raceRoomId })).catch(() => {})
  if (pendingBlockRoomId) await Promise.resolve(first.rpc('leave_online_room', { room: pendingBlockRoomId })).catch(() => {})
  if (arcadeRoomId) await Promise.resolve(first.rpc('leave_online_room', { room: arcadeRoomId })).catch(() => {})
  if (groupId) await Promise.resolve(first.rpc('close_online_group', { target_group: groupId })).catch(() => {})
  for (const [owner, channel] of channels) await Promise.resolve(owner.removeChannel(channel)).catch(() => {})
  await Promise.allSettled(participants.map(owner => owner.auth.signOut()))
}

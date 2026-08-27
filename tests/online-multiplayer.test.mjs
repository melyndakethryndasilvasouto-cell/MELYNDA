import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { cleanRoomMessage } from '../src/online/messageRules.mjs'

const root = new URL('../', import.meta.url)

test('chat privado remove controles, normaliza espaços e limita mensagens', () => {
  assert.equal(cleanRoomMessage('  Olá\n\t amigo!  '), 'Olá amigo!')
  assert.equal(cleanRoomMessage('a'.repeat(250)).length, 180)
  assert.equal(cleanRoomMessage(null), '')
})

test('migração online protege salas, convites e jogadas no servidor', async () => {
  const sql = await readFile(new URL('supabase/migrations/20260826213000_online_multiplayer.sql', root), 'utf8')
  const expiryFix = await readFile(new URL('supabase/migrations/20260826232500_expire_online_invites.sql', root), 'utf8')
  const social = await readFile(new URL('supabase/migrations/20260827013000_safe_social_groups.sql', root), 'utf8')
  const blockCleanup = await readFile(new URL('supabase/migrations/20260827023000_block_cleanup_and_group_privacy.sql', root), 'utf8')
  const pendingBlockFix = await readFile(new URL('supabase/migrations/20260827070000_fix_pending_invite_block.sql', root), 'utf8')

  for (const table of ['online_profiles', 'online_rooms', 'online_invites']) {
    assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`, 'i'))
  }
  assert.match(sql, /create policy "room participants read"/i)
  assert.match(sql, /create policy "invite participants read"/i)
  assert.match(sql, /realtime\.topic\(\) = 'online:room:' \|\| room\.id::text/i)
  assert.match(sql, /create or replace function public\.play_online_ttt[\s\S]*for update/i)
  assert.match(sql, /current_room\.state->>'turn' <> symbol/i)
  assert.match(sql, /board->cell <> 'null'::jsonb/i)
  assert.match(sql, /revoke all on function public\.play_online_ttt/i)
  assert.doesNotMatch(sql, /service_role|secret key|password/i)
  assert.match(expiryFix, /status = 'expired'/i)
  assert.match(expiryFix, /return null/i)
  assert.match(expiryFix, /status = 'cancelled'/i)
  assert.match(expiryFix, /extension in \('broadcast', 'presence'\)/i)
  assert.doesNotMatch(expiryFix, /payload\s*->>\s*'senderId'/i)
  for (const table of ['online_presence', 'online_groups', 'online_group_members', 'online_group_invites', 'online_group_messages', 'online_room_messages', 'online_blocks', 'online_reports']) {
    assert.match(social, new RegExp(`create table if not exists public\\.${table}`, 'i'))
    assert.match(social, new RegExp(`alter table public\\.${table} enable row level security`, 'i'))
  }
  assert.match(social, /create policy "groups read by members"/i)
  assert.match(social, /create policy "group messages read after joining"/i)
  assert.match(social, /create or replace function public\.upsert_online_profile[\s\S]*private\.clean_online_nickname/i)
  assert.match(social, /revoke insert, update on table public\.online_profiles from authenticated/i)
  assert.match(social, /create or replace function public\.heartbeat_online_presence[\s\S]*auth\.uid\(\)/i)
  assert.match(social, /create or replace function public\.send_online_group_message[\s\S]*private\.clean_online_child_text/i)
  assert.match(social, /create or replace function public\.send_online_room_audio[\s\S]*private\.validate_online_audio/i)
  assert.match(social, /create or replace function public\.block_online_player/i)
  assert.match(social, /create or replace function public\.report_online_player/i)
  assert.match(social, /update public\.online_invites set status = 'expired' where to_user = caller/i)
  assert.match(social, /private\.online_group_topic_member\(realtime\.topic\(\)/i)
  assert.doesNotMatch(social, /service_role|secret key|password/i)
  assert.match(blockCleanup, /update public\.online_rooms set status = 'cancelled'/i)
  assert.match(blockCleanup, /delete from public\.online_group_members member/i)
  assert.match(blockCleanup, /private\.online_group_member\(group_id/i)
  assert.match(pendingBlockFix, /update public\.online_invites[\s\S]*set status = 'expired'/i)
  assert.doesNotMatch(pendingBlockFix, /update public\.online_invites set status = 'cancelled'/i)
  assert.match(pendingBlockFix, /pg_advisory_xact_lock[\s\S]*with expired as \([\s\S]*update public\.online_invites[\s\S]*update public\.online_rooms/i)
  assert.match(pendingBlockFix, /create or replace function public\.respond_online_invite[\s\S]*pg_advisory_xact_lock[\s\S]*for update/i)
  assert.match(pendingBlockFix, /create or replace function public\.go_offline[\s\S]*delete from public\.online_presence[\s\S]*status = 'cancelled'/i)
  assert.match(pendingBlockFix, /revoke all on function public\.block_online_player\(uuid\) from public, anon/i)
})

test('cliente usa identidade server-side, grupos privados, proteção infantil e voz sob consentimento', async () => {
  const [context, safetyGate, dialogHook, lobby, group, notifications, room, voice, headers] = await Promise.all([
    readFile(new URL('src/contexts/OnlineContext.tsx', root), 'utf8'),
    readFile(new URL('src/components/Online/OnlineSafetyGate.tsx', root), 'utf8'),
    readFile(new URL('src/online/useAccessibleDialog.ts', root), 'utf8'),
    readFile(new URL('src/components/Online/OnlineLobbyPage.tsx', root), 'utf8'),
    readFile(new URL('src/components/Online/GroupChatPage.tsx', root), 'utf8'),
    readFile(new URL('src/components/Online/OnlineNotifications.tsx', root), 'utf8'),
    readFile(new URL('src/components/Online/OnlineRoomPage.tsx', root), 'utf8'),
    readFile(new URL('src/online/useRoomVoice.ts', root), 'utf8'),
    readFile(new URL('public/_headers', root), 'utf8'),
  ])

  assert.match(context, /signInAnonymously/)
  assert.match(context, /upsert_online_profile/)
  assert.match(context, /heartbeat_online_presence/)
  assert.match(context, /online_presence/)
  const connectStart = context.indexOf('const connect = useCallback')
  const consentGuard = context.indexOf('if (!safetyAcceptedRef.current)', connectStart)
  const anonymousSignIn = context.indexOf('signInAnonymously', connectStart)
  assert.ok(connectStart >= 0 && consentGuard > connectStart && anonymousSignIn > consentGuard, 'consentimento deve ser validado antes da autenticação anônima')
  assert.match(context, /sessionStorage\.setItem\('mel-online-consent', 'yes'\)/)
  assert.match(context, /clearHeartbeat\(\)[\s\S]*rpc\('go_offline'\)/)
  assert.match(safetyGate, /Seu apelido e sua atividade aparecerão/)
  assert.match(dialogHook, /event\.key === 'Escape'/)
  assert.match(dialogHook, /document\.body\.style\.overflow = 'hidden'/)
  assert.doesNotMatch(context, /lobby\.track\(|presenceState/)
  assert.match(lobby, /activityLabel\(player\)/)
  assert.match(lobby, /Jogadores Online/)
  assert.match(lobby, /Meus grupos privados/)
  assert.match(lobby, /Frases aprovadas para proteger as crianças/)
  assert.match(lobby, /Bloquear/)
  assert.match(lobby, /Denunciar/)
  assert.match(lobby, /Ficar offline/)
  assert.doesNotMatch(lobby, /disponívelis/)
  assert.match(group, /send_online_group_message/)
  assert.match(group, /send_online_group_audio/)
  assert.match(group, /!safetyAccepted/)
  assert.match(group, /Somente você, como dono/)
  assert.match(group, /Novas mensagens/)
  assert.match(group, /window\.confirm/)
  assert.match(notifications, /Nada será fechado sem você escolher/)
  assert.match(notifications, /Sair e jogar/)
  assert.match(notifications, /Conversar/)
  assert.match(room, /channel\(`online:room:\$\{roomId\}`,[\s\S]*private: true/)
  assert.match(room, /Não compartilhe nome completo, endereço, escola, telefone, senha ou fotos/)
  assert.match(room, /Entendi, ligar microfone/)
  assert.match(room, /send_online_room_message/)
  assert.match(room, /send_online_room_audio/)
  assert.match(room, /!safetyAccepted/)
  assert.match(room, /deixam de ficar disponíveis após 24 horas/)
  assert.match(room, /remoteParticipantId/)
  assert.match(room, /Mensagens privadas da partida/)
  assert.match(room, /window\.confirm/)
  assert.match(voice, /getUserMedia\(\{ audio: true, video: false \}\)/)
  assert.match(voice, /stun:stun\.cloudflare\.com:3478/)
  assert.match(voice, /if \(\['failed', 'disconnected'\]\.includes\(peer\.connectionState\)\) \{[\s\S]*stopMedia\(\)/)
  assert.match(headers, /camera=\(\), microphone=\(self\)/)
  assert.doesNotMatch(`${context}\n${lobby}\n${group}\n${room}\n${voice}`, /dangerouslySetInnerHTML|innerHTML\s*=/)
})

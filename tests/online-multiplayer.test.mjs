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
})

test('cliente usa canal privado, autenticação anônima e voz sob consentimento', async () => {
  const [context, room, voice, headers] = await Promise.all([
    readFile(new URL('src/contexts/OnlineContext.tsx', root), 'utf8'),
    readFile(new URL('src/components/Online/OnlineRoomPage.tsx', root), 'utf8'),
    readFile(new URL('src/online/useRoomVoice.ts', root), 'utf8'),
    readFile(new URL('public/_headers', root), 'utf8'),
  ])

  assert.match(context, /signInAnonymously/)
  assert.match(context, /channel\('online:lobby',[\s\S]*private: true/)
  assert.match(room, /channel\(`online:room:\$\{roomId\}`,[\s\S]*private: true/)
  assert.match(room, /Não compartilhe nome completo, endereço, escola, telefone ou senha/)
  assert.match(room, /Entendi, ligar microfone/)
  assert.match(room, /não grava o áudio/)
  assert.match(room, /remoteParticipantId/)
  assert.match(voice, /getUserMedia\(\{ audio: true, video: false \}\)/)
  assert.match(voice, /stun:stun\.cloudflare\.com:3478/)
  assert.match(headers, /camera=\(\), microphone=\(self\)/)
  assert.doesNotMatch(`${context}\n${room}\n${voice}`, /dangerouslySetInnerHTML|innerHTML\s*=/)
})

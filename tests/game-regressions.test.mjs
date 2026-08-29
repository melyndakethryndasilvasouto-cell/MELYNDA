import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const root = new URL('../', import.meta.url)

test('Cobrinha não exibe escapes Unicode literais na interface', async () => {
  const snake = await readFile(new URL('src/games/Snake/index.tsx', root), 'utf8')

  assert.doesNotMatch(snake, />\\u[0-9A-Fa-f]{4,}/)
  assert.doesNotMatch(snake, /label="\\u[0-9A-Fa-f]{4,}/)
})

test('áudio retoma o AudioContext antes de criar tons', async () => {
  const [sound, simon] = await Promise.all([
    readFile(new URL('src/contexts/SoundContext.tsx', root), 'utf8'),
    readFile(new URL('src/games/SimonSays/index.tsx', root), 'utf8'),
  ])

  assert.match(sound, /ctx\.resume\(\)/)
  assert.match(sound, /ctx\.state !== 'running'/)
  assert.match(simon, /resumeSimonCtx\(ctx\)/)
  assert.match(simon, /unlockSimonAudio\(isMutedRef\.current\)/)
})

test('convites não dependem exclusivamente do Realtime', async () => {
  const context = await readFile(new URL('src/contexts/OnlineContext.tsx', root), 'utf8')

  assert.match(context, /invitesRefreshRef/)
  assert.match(context, /setInterval\(\(\) => \{[\s\S]*loadInvites\(currentUser\)/)
  assert.match(context, /visibilitychange/)
  assert.doesNotMatch(context, /await new Promise<void>\(\(resolve, reject\) => \{[\s\S]*channel\.subscribe/)
})

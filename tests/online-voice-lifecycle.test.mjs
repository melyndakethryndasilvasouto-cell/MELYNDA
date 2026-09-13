import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'

const root = new URL('../', import.meta.url)

test('voz usa confirmação ready-ack sem responder ack com outro ack', async () => {
  const source = await readFile(new URL('src/online/useRoomVoice.ts', root), 'utf8')
  const readyBranch = source.slice(source.indexOf("signal.kind === 'ready'"), source.indexOf("signal.kind === 'hangup'"))
  const ackBranch = readyBranch.slice(readyBranch.indexOf("signal.kind === 'ready-ack'"))

  assert.match(readyBranch, /if \(streamRef\.current\) \{[\s\S]*broadcast\(\{ kind: 'ready-ack', targetId: signal\.senderId \}\)/)
  assert.match(ackBranch, /otherReadyRef\.current = true[\s\S]*await createOffer\(\)/)
  assert.doesNotMatch(ackBranch, /broadcast\(\{ kind: 'ready-ack'/)
})

test('hangup remoto encerra peer e trilhas sem ecoar outro hangup', async () => {
  const source = await readFile(new URL('src/online/useRoomVoice.ts', root), 'utf8')
  const branch = source.slice(source.indexOf("signal.kind === 'hangup'"), source.indexOf('if (!streamRef.current) return'))

  assert.match(branch, /closePeer\(\)[\s\S]*stopMedia\(\)[\s\S]*setStatus\('off'\)/)
  assert.doesNotMatch(branch, /broadcast\(/)
})

test('voz tolera desconexão transitória e impede inicialização duplicada', async () => {
  const source = await readFile(new URL('src/online/useRoomVoice.ts', root), 'utf8')

  assert.match(source, /const DISCONNECTED_GRACE_MS = 5_000/)
  assert.match(source, /connectionState === 'connected'[\s\S]*clearDisconnectedTimer\(\)/)
  assert.match(source, /connectionState === 'disconnected'[\s\S]*window\.setTimeout\([\s\S]*DISCONNECTED_GRACE_MS/)
  assert.match(source, /if \(startPromiseRef\.current\) return startPromiseRef\.current/)
  assert.match(source, /voiceSession !== voiceSessionRef\.current[\s\S]*track\.stop\(\)/)
  assert.match(source, /if \(peerRef\.current !== peer\) return/)
})

test('composer descarta captura quando fica desabilitado e CSP permite áudio local', async () => {
  const [composer, headers] = await Promise.all([
    readFile(new URL('src/components/Online/AudioMessageComposer.tsx', root), 'utf8'),
    readFile(new URL('public/_headers', root), 'utf8'),
  ])

  assert.match(composer, /useEffect\(\(\) => \{[\s\S]*if \(disabled\) audio\.discard\(\)/)
  assert.match(headers, /media-src 'self' data: blob:/)
})

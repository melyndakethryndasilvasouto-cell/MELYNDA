import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { access } from 'node:fs/promises'

const root = fileURLToPath(new URL('../', import.meta.url))
const viteCli = fileURLToPath(new URL('../node_modules/vite/bin/vite.js', import.meta.url))
const distIndex = fileURLToPath(new URL('../dist/index.html', import.meta.url))
const port = 4176
const url = `http://127.0.0.1:${port}/`

await access(distIndex)

const child = spawn(process.execPath, [viteCli, 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
  cwd: root,
  stdio: ['ignore', 'pipe', 'pipe'],
  windowsHide: true,
})

let logs = ''
child.stdout.on('data', chunk => { logs += chunk.toString() })
child.stderr.on('data', chunk => { logs += chunk.toString() })

const deadline = Date.now() + 15_000
let response

try {
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Servidor encerrou antes da validação.\n${logs}`)
    try {
      response = await fetch(url)
      if (response.ok) break
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 200))
  }

  if (!response?.ok) throw new Error(`Servidor não respondeu em ${url}.\n${logs}`)
  const html = await response.text()
  if (!html.includes('<div id="root"></div>')) throw new Error('HTML inicial não contém o ponto de montagem React.')
  const guideResponse = await fetch(`${url}api/bible-guide/status`)
  const guideStatus = await guideResponse.json()
  if (!guideResponse.ok || typeof guideStatus.enabled !== 'boolean') throw new Error('Endpoint de status do Guia Bíblico inválido.')
  console.log(`STARTUP_OK status=${response.status} url=${url} pid=${child.pid} groq_configured=${guideStatus.enabled}`)
} finally {
  if (child.exitCode === null) {
    child.kill()
    await Promise.race([
      new Promise(resolve => child.once('exit', resolve)),
      new Promise(resolve => setTimeout(resolve, 2_000)),
    ])
  }
}

import { spawn } from 'node:child_process'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, isAbsolute, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const viteCli = fileURLToPath(new URL('../node_modules/vite/bin/vite.js', import.meta.url))
const artifacts = fileURLToPath(new URL('../artifacts/', import.meta.url))
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const appPort = 4178
const debugPort = 9224
const baseUrl = `http://127.0.0.1:${appPort}`
const tempBase = resolve(tmpdir())
const profile = await mkdtemp(`${tempBase}${sep}mel-ui-check-`)

await mkdir(artifacts, { recursive: true })

class CdpClient {
  constructor(url) {
    this.socket = new WebSocket(url)
    this.sequence = 0
    this.pending = new Map()
    this.exceptions = []
  }

  async open() {
    await new Promise((resolveOpen, reject) => {
      this.socket.addEventListener('open', resolveOpen, { once: true })
      this.socket.addEventListener('error', reject, { once: true })
    })
    this.socket.addEventListener('message', event => {
      const message = JSON.parse(event.data)
      if (message.method === 'Runtime.exceptionThrown') this.exceptions.push(message.params.exceptionDetails.text)
      if (!message.id) return
      const waiter = this.pending.get(message.id)
      if (!waiter) return
      this.pending.delete(message.id)
      if (message.error) waiter.reject(new Error(message.error.message))
      else waiter.resolve(message.result)
    })
  }

  send(method, params = {}) {
    const id = ++this.sequence
    return new Promise((resolveSend, reject) => {
      this.pending.set(id, { resolve: resolveSend, reject })
      this.socket.send(JSON.stringify({ id, method, params }))
    })
  }

  close() { this.socket.close() }
}

async function waitFor(url, timeout = 15_000) {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url)
      if (response.ok) return response
    } catch {}
    await new Promise(resolveWait => setTimeout(resolveWait, 200))
  }
  throw new Error(`Tempo esgotado aguardando ${url}`)
}

const vite = spawn(process.execPath, [viteCli, 'preview', '--host', '127.0.0.1', '--port', String(appPort), '--strictPort'], {
  cwd: root,
  stdio: ['ignore', 'pipe', 'pipe'],
  env: { ...process.env, GROQ_API_KEY: '' },
  windowsHide: true,
})
console.log(`PROCESS vite_pid=${vite.pid} entry=${viteCli} port=${appPort}`)

let chrome
let client

try {
  await waitFor(baseUrl)
  chrome = spawn(chromePath, [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    '--no-first-run',
    '--no-default-browser-check',
    '--remote-debugging-address=127.0.0.1',
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${profile}`,
    'about:blank',
  ], { stdio: 'ignore', windowsHide: true })
  console.log(`PROCESS chrome_pid=${chrome.pid} entry=${chromePath} debug_port=${debugPort}`)

  await waitFor(`http://127.0.0.1:${debugPort}/json/version`)
  const page = await (await fetch(`http://127.0.0.1:${debugPort}/json/new?${encodeURIComponent(baseUrl)}`, { method: 'PUT' })).json()
  client = new CdpClient(page.webSocketDebuggerUrl)
  await client.open()
  await client.send('Page.enable')
  await client.send('Runtime.enable')

  async function evaluate(expression) {
    const result = await client.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text)
    return result.result.value
  }

  async function viewport(width, height) {
    await client.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 600 })
  }

  async function navigate(pathname) {
    await client.send('Page.navigate', { url: `${baseUrl}${pathname}` })
    const deadline = Date.now() + 8_000
    while (Date.now() < deadline) {
      const ready = await evaluate('document.readyState')
      if (ready === 'complete') break
      await new Promise(resolveWait => setTimeout(resolveWait, 100))
    }
    await new Promise(resolveWait => setTimeout(resolveWait, 900))
  }

  async function screenshot(name) {
    const result = await client.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
    const target = resolve(artifacts, name)
    if (!isAbsolute(target) || dirname(target) !== resolve(artifacts)) throw new Error('Destino de screenshot inválido')
    await writeFile(target, Buffer.from(result.data, 'base64'))
    return target
  }

  async function metrics(pathname, width, height) {
    await viewport(width, height)
    await navigate(pathname)
    const values = await evaluate(`({
      width: window.innerWidth,
      visualWidth: window.visualViewport?.width || window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      heading: document.querySelector('h1')?.textContent?.trim() || '',
      bodyText: document.body.innerText.slice(0, 300)
    })`)
    if (values.width > width + 1 || values.visualWidth > width + 1) throw new Error(`Viewport expandido em ${pathname}: solicitado ${width}px, layout ${values.width}px, visual ${values.visualWidth}px`)
    if (values.scrollWidth > values.width + 1) throw new Error(`Overflow horizontal em ${pathname} (${width}px): ${values.scrollWidth}px`)
    if (!values.heading) throw new Error(`Tela sem h1 em ${pathname}`)
    console.log(`UI_OK path=${pathname} viewport=${width}x${height} innerWidth=${values.width} heading=${JSON.stringify(values.heading)} scrollWidth=${values.scrollWidth}`)
    return values
  }

  await viewport(1440, 900)
  await navigate('/')
  await evaluate(`localStorage.setItem('mel-player-name','Mel'); localStorage.setItem('mel-player-avatar','🕊️'); location.reload()`)
  await new Promise(resolveWait => setTimeout(resolveWait, 1200))
  await metrics('/', 1440, 900)
  const realGameNames = await evaluate(`['Memória da Bíblia','Jogo da Velha','Dama','UNO','Colorindo a Bíblia','Cobrinha','Sequência de Cores','Quiz da Bíblia','Quebra-Cabeça','Ping Pong'].every(name => document.body.innerText.includes(name))`)
  if (!realGameNames) throw new Error('A página inicial não exibiu todos os nomes reais dos jogos')
  console.log('CONTENT_OK home_real_game_names=10')
  console.log(`SCREENSHOT ${await screenshot('ui-home-desktop.png')}`)

  for (const width of [320, 768, 1024, 1440]) await metrics('/', width, 900)
  const mobilePaths = ['/memoria', '/jogo-da-velha', '/dama', '/uno', '/colorir', '/cobra', '/simon', '/quiz', '/quebra-cabeca', '/pong']
  for (const pathname of mobilePaths) await metrics(pathname, 320, 800)

  await viewport(320, 800)
  await navigate('/memoria')
  const memoryStarted = await evaluate(`(() => {
    const button = [...document.querySelectorAll('button')].find(item => item.textContent?.includes('Jogar!'))
    button?.click()
    return Boolean(button)
  })()`)
  if (!memoryStarted) throw new Error('Botão de início da Memória não foi encontrado')
  await new Promise(resolveWait => setTimeout(resolveWait, 500))
  const memoryInteraction = await evaluate(`(() => {
    const cards = [...document.querySelectorAll('button[aria-label="Carta bíblica virada para baixo"]')]
    cards[0]?.click()
    return { count: cards.length, firstExists: Boolean(cards[0]) }
  })()`)
  await new Promise(resolveWait => setTimeout(resolveWait, 250))
  const revealedMemoryCards = await evaluate(`document.querySelectorAll('button.flip-card:not([aria-label="Carta bíblica virada para baixo"])').length`)
  if (memoryInteraction.count !== 12 || !memoryInteraction.firstExists || revealedMemoryCards < 1) {
    throw new Error(`Interação da Memória falhou: ${JSON.stringify({ memoryInteraction, revealedMemoryCards })}`)
  }
  console.log(`INTERACTION_OK game=memory cards=${memoryInteraction.count} revealed=${revealedMemoryCards}`)

  await navigate('/memoria')
  const memoryAiStarted = await evaluate(`(async () => {
    Math.random = () => 0
    const mode = [...document.querySelectorAll('button')].find(item => item.textContent?.includes('Vs Computador'))
    mode?.click()
    await new Promise(resolve => setTimeout(resolve, 100))
    const start = [...document.querySelectorAll('button')].find(item => item.textContent?.includes('Jogar!'))
    start?.click()
    await new Promise(resolve => setTimeout(resolve, 300))
    const cards = [...document.querySelectorAll('button[aria-label="Carta bíblica virada para baixo"]')]
    cards[0]?.click()
    await new Promise(resolve => setTimeout(resolve, 80))
    cards[1]?.click()
    return Boolean(mode && start && cards.length === 12)
  })()`)
  const memoryAiObserved = await evaluate(`(async () => {
    const deadline = Date.now() + 3500
    while (Date.now() < deadline) {
      if (document.body.innerText.includes('pensando…')) return true
      await new Promise(resolve => setTimeout(resolve, 80))
    }
    return false
  })()`)
  if (!memoryAiStarted || !memoryAiObserved) throw new Error('Modo Vs Computador da Memória não iniciou o turno local da IA')
  console.log('INTERACTION_OK game=memory local_ai_turn=true')

  await viewport(320, 800)
  await navigate('/jogo-da-velha')
  const ticTacToeStarted = await evaluate(`(() => {
    const button = [...document.querySelectorAll('button')].find(item => item.textContent?.includes('IA Fácil'))
    button?.click()
    return Boolean(button)
  })()`)
  if (!ticTacToeStarted) throw new Error('Modo IA Fácil do Jogo da Velha não foi encontrado')
  await new Promise(resolveWait => setTimeout(resolveWait, 350))
  const humanTicTacToeMove = await evaluate(`(() => {
    const cells = [...document.querySelectorAll('.grid.gap-3 > button')]
    cells[0]?.click()
    return cells.length
  })()`)
  await new Promise(resolveWait => setTimeout(resolveWait, 900))
  const occupiedTicTacToeCells = await evaluate(`[...document.querySelectorAll('.grid.gap-3 > button')].filter(cell => cell.textContent?.trim()).length`)
  if (humanTicTacToeMove !== 9 || occupiedTicTacToeCells !== 2) throw new Error(`IA do Jogo da Velha não respondeu: casas=${occupiedTicTacToeCells}`)
  console.log('INTERACTION_OK game=tic-tac-toe local_ai_replied=true')

  await viewport(420, 900)
  await navigate('/dama')
  const checkersStarted = await evaluate(`(() => {
    const ai = [...document.querySelectorAll('button')].find(item => item.textContent?.includes('Vs IA') && item.textContent?.includes('Fácil'))
    ai?.click()
    const play = [...document.querySelectorAll('button')].find(item => item.textContent?.includes('Jogar'))
    play?.click()
    return Boolean(ai && play)
  })()`)
  if (!checkersStarted) throw new Error('Modo Vs IA da Dama não foi encontrado')
  await new Promise(resolveWait => setTimeout(resolveWait, 350))
  const checkersHumanMove = await evaluate(`(async () => {
    const pieces = [...document.querySelectorAll('[data-player="1"]')]
    for (const piece of pieces) {
      piece.click()
      await new Promise(resolve => setTimeout(resolve, 100))
      const target = document.querySelector('[data-player=""] > div')?.parentElement
      if (target) {
        const cell = target.getAttribute('data-cell')
        target.click()
        return { moved: true, cell }
      }
    }
    return { moved: false, cell: '' }
  })()`)
  await new Promise(resolveWait => setTimeout(resolveWait, 1300))
  const checkersState = await evaluate(`({ humanMoved: document.querySelector('[data-cell="${checkersHumanMove.cell}"]')?.getAttribute('data-player'), aiPieces: document.querySelectorAll('[data-player="2"]').length })`)
  if (!checkersHumanMove.moved || checkersState.humanMoved !== '1' || checkersState.aiPieces !== 12) throw new Error(`Turno da Dama falhou: ${JSON.stringify({ checkersHumanMove, checkersState })}`)
  console.log('INTERACTION_OK game=checkers local_ai_replied=true')

  await viewport(420, 900)
  await navigate('/uno')
  const unoStarted = await evaluate(`(() => {
    const button = [...document.querySelectorAll('button')].find(item => item.textContent?.includes('Jogar!'))
    button?.click()
    return Boolean(button)
  })()`)
  if (!unoStarted) throw new Error('Início do UNO não foi encontrado')
  await new Promise(resolveWait => setTimeout(resolveWait, 400))
  const unoAction = await evaluate(`(() => {
    const playable = document.querySelector('[data-uno-card="true"][data-playable="true"]')
    if (playable) { playable.click(); return 'card' }
    const buy = [...document.querySelectorAll('p')].find(item => item.textContent?.trim() === 'Comprar')?.nextElementSibling
    buy?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    return buy ? 'draw' : ''
  })()`)
  if (!unoAction) throw new Error('Nenhuma ação possível foi encontrada no UNO')
  const unoAiObserved = await evaluate(`(async () => {
    await new Promise(resolve => setTimeout(resolve, 100))
    if (document.body.innerText.includes('Escolha a cor')) {
      const color = [...document.querySelectorAll('button')].find(item => item.textContent?.trim() === 'Vermelho')
      color?.click()
    }
    const deadline = Date.now() + 2200
    while (Date.now() < deadline) {
      const text = document.body.innerText
      if (text.includes('pensando...') || text.includes('Aguarde')) return true
      await new Promise(resolve => setTimeout(resolve, 80))
    }
    return false
  })()`)
  await new Promise(resolveWait => setTimeout(resolveWait, 1400))
  const unoStillRunning = await evaluate(`document.body.innerText.includes('UNO') && document.querySelectorAll('[data-uno-card="true"]').length > 0`)
  if (!unoAiObserved || !unoStillRunning) throw new Error(`UNO não completou o ciclo contra robô: observado=${unoAiObserved} operacional=${unoStillRunning}`)
  console.log(`INTERACTION_OK game=uno local_ai_cycle=true human_action=${unoAction}`)

  await viewport(420, 900)
  await navigate('/pong')
  const pongStarted = await evaluate(`(() => {
    const button = [...document.querySelectorAll('button')].find(item => item.textContent?.includes('Vs Computador'))
    button?.click()
    return Boolean(button)
  })()`)
  if (!pongStarted) throw new Error('Modo Vs Computador do Pong não foi encontrado')
  await new Promise(resolveWait => setTimeout(resolveWait, 250))
  const pongFrameA = await evaluate(`document.querySelector('canvas')?.toDataURL() || ''`)
  await new Promise(resolveWait => setTimeout(resolveWait, 500))
  const pongFrameB = await evaluate(`document.querySelector('canvas')?.toDataURL() || ''`)
  if (!pongFrameA || pongFrameA === pongFrameB) throw new Error('Pong não atualizou os quadros contra o computador')
  console.log('INTERACTION_OK game=pong local_ai_frames=true')

  await viewport(320, 800)
  await navigate('/quiz')
  const startedQuiz = await evaluate(`(() => {
    const button = [...document.querySelectorAll('button')].find(item => item.textContent?.includes('Jogar sozinha'))
    button?.click()
    return Boolean(button)
  })()`)
  if (!startedQuiz) throw new Error('Botão de início do Quiz não foi encontrado')
  await new Promise(resolveWait => setTimeout(resolveWait, 800))
  console.log(`SCREENSHOT ${await screenshot('ui-quiz-mobile.png')}`)
  const answeredQuiz = await evaluate(`(() => {
    const button = [...document.querySelectorAll('button')].find(item => item.querySelector('span')?.textContent?.trim() === 'A' && !item.disabled)
    button?.click()
    return Boolean(button)
  })()`)
  if (!answeredQuiz) throw new Error('Primeira opção do Quiz não foi encontrada')
  await new Promise(resolveWait => setTimeout(resolveWait, 400))
  const learnedFromQuiz = await evaluate(`document.body.innerText.includes('Confira em')`)
  if (!learnedFromQuiz) throw new Error('Feedback bíblico do Quiz não apareceu após a resposta')
  await evaluate('window.scrollTo(0, document.body.scrollHeight)')
  console.log(`SCREENSHOT ${await screenshot('ui-quiz-feedback-mobile.png')}`)
  console.log('INTERACTION_OK game=quiz feedback_with_reference=true')

  const guideState = await evaluate(`(async () => {
    const toggle = [...document.querySelectorAll('button')].find(item => item.textContent?.includes('Perguntar ao Guia Bíblico'))
    toggle?.click()
    await new Promise(resolve => setTimeout(resolve, 120))
    const textarea = document.querySelector('#bible-guide-question')
    if (!textarea) return { ok: false, stage: 'textarea' }
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set
    setter.call(textarea, 'Como praticar este ensinamento?')
    textarea.dispatchEvent(new Event('input', { bubbles: true }))
    textarea.dispatchEvent(new Event('change', { bubbles: true }))
    await new Promise(resolve => setTimeout(resolve, 150))
    const submit = [...document.querySelectorAll('button')].find(item => item.textContent?.trim() === 'Perguntar')
    submit?.click()
    await new Promise(resolve => setTimeout(resolve, 700))
    const text = document.body.innerText
    return { ok: text.includes('ainda não foi ativado'), stage: 'response', submitFound: Boolean(submit), submitDisabled: submit?.disabled, excerpt: text.slice(text.indexOf('O que você quer aprender'), text.indexOf('O que você quer aprender') + 500) }
  })()`)
  if (!guideState.ok) throw new Error(`Guia Bíblico não apresentou o estado seguro sem chave: ${JSON.stringify(guideState)}`)
  const guideInPortal = await evaluate(`document.querySelector('[data-guide-backdrop="true"]')?.parentElement === document.body`)
  if (!guideInPortal) throw new Error('Guia Bíblico não foi renderizado fora do layout do jogo')
  console.log(`SCREENSHOT ${await screenshot('ui-guide-modal-mobile.png')}`)
  const guideDismissal = await evaluate(`(async () => {
    const backdrop = document.querySelector('[data-guide-backdrop="true"]')
    backdrop?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    await new Promise(resolve => setTimeout(resolve, 120))
    const closedOutside = !document.querySelector('#bible-guide-dialog')
    const toggle = [...document.querySelectorAll('button')].find(item => item.textContent?.includes('Perguntar ao Guia Bíblico'))
    toggle?.click()
    await new Promise(resolve => setTimeout(resolve, 120))
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await new Promise(resolve => setTimeout(resolve, 120))
    return { closedOutside, closedEscape: !document.querySelector('#bible-guide-dialog'), bodyOverflow: document.body.style.overflow }
  })()`)
  if (!guideDismissal.closedOutside || !guideDismissal.closedEscape || guideDismissal.bodyOverflow === 'hidden') {
    throw new Error(`Guia Bíblico não fechou corretamente: ${JSON.stringify(guideDismissal)}`)
  }
  console.log('INTERACTION_OK feature=bible-guide missing_key_handled=true')

  await viewport(320, 800)
  await navigate('/colorir')
  const coloredRegion = await evaluate(`(() => {
    const region = document.querySelector('#coloring-svg [role="button"]')
    region?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    return Boolean(region)
  })()`)
  await new Promise(resolveWait => setTimeout(resolveWait, 300))
  const coloringProgress = await evaluate(`document.body.innerText.includes('1/12')`)
  if (!coloredRegion || !coloringProgress) throw new Error('Interação de colorir não atualizou o progresso da Arca')
  console.log(`SCREENSHOT ${await screenshot('ui-coloring-mobile.png')}`)
  console.log('INTERACTION_OK game=coloring progress=1/12')

  if (client.exceptions.length) throw new Error(`Exceções no navegador: ${client.exceptions.join('; ')}`)
  console.log('UI_VERIFY_OK breakpoints=4 routes_mobile=10 interactions=9 screenshots=5 console_exceptions=0')
} finally {
  client?.close()
  if (chrome?.exitCode === null) chrome.kill()
  if (vite.exitCode === null) vite.kill()
  if (!resolve(profile).startsWith(`${tempBase}${sep}`)) throw new Error('Perfil temporário fora da pasta temporária esperada')
  try { await rm(profile, { recursive: true, force: true }) } catch {}
}

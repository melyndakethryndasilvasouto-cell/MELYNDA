import { access, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const root = new URL('../', import.meta.url)
const requiredFiles = [
  'index.html',
  'src/main.tsx',
  'src/App.tsx',
  'src/data/gameMissions.json',
  'src/data/quizQuestions.json',
  'src/data/memoryPairs.json',
  'src/data/coloringLessons.json',
  'server/groq-bible-guide.mjs',
]
const requiredDependencies = ['react', 'react-dom', 'react-router-dom', 'framer-motion', 'lucide-react', 'canvas-confetti']
const problems = []

const packageJson = JSON.parse(await readFile(new URL('package.json', root), 'utf8'))
const nodeMajor = Number(process.versions.node.split('.')[0])
if (nodeMajor < 18) problems.push(`Node ${process.versions.node}: esperado 18 ou superior`)

for (const relativePath of requiredFiles) {
  try { await access(new URL(relativePath, root)) }
  catch { problems.push(`arquivo ausente: ${relativePath}`) }
}

for (const dependency of requiredDependencies) {
  if (!packageJson.dependencies?.[dependency]) problems.push(`dependência não declarada: ${dependency}`)
  try { await access(new URL(`node_modules/${dependency}/package.json`, root)) }
  catch { problems.push(`dependência não instalada: ${dependency}`) }
}

console.log(`DIAGNOSE node=${process.versions.node} app=${packageJson.name}@${packageJson.version}`)
console.log(`DIAGNOSE required_files=${requiredFiles.length} dependencies=${requiredDependencies.length}`)
console.log(`DIAGNOSE groq_configured=${Boolean(process.env.GROQ_API_KEY)} model=${process.env.GROQ_MODEL || 'openai/gpt-oss-20b'}`)
if (problems.length) {
  for (const problem of problems) console.error(`PROBLEM ${problem}`)
  process.exitCode = 1
} else {
  console.log('DIAGNOSE_OK nenhum problema operacional detectado')
}

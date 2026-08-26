import { readdir, stat } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const dist = fileURLToPath(new URL('../dist/', import.meta.url))
const assets = []

async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const fullPath = `${directory}/${entry.name}`
    if (entry.isDirectory()) await walk(fullPath)
    else if (/\.(?:js|css|html)$/.test(entry.name)) assets.push({ name: entry.name, bytes: (await stat(fullPath)).size })
  }
}

await walk(dist)
const js = assets.filter(({ name }) => name.endsWith('.js'))
const css = assets.filter(({ name }) => name.endsWith('.css'))
const largest = [...js].sort((a, b) => b.bytes - a.bytes)[0]
const kb = bytes => (bytes / 1024).toFixed(2)

console.log(`BENCHMARK assets=${assets.length} js_chunks=${js.length}`)
console.log(`BENCHMARK js_total_kb=${kb(js.reduce((sum, item) => sum + item.bytes, 0))}`)
console.log(`BENCHMARK css_total_kb=${kb(css.reduce((sum, item) => sum + item.bytes, 0))}`)
console.log(`BENCHMARK largest_js=${largest?.name ?? 'none'} largest_js_kb=${largest ? kb(largest.bytes) : '0.00'}`)

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { groqBibleGuidePlugin } from './server/groq-bible-guide.mjs'

export default defineConfig({
  plugins: [react(), groqBibleGuidePlugin()],
  server: {
    host: true,
    port: 5173,
  },
})

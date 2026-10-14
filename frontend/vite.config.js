import process from 'node:process'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Sub-path hosting (e.g. GitHub Pages at /SmartBank/). Defaults to "/" locally.
  base: process.env.BASE_PATH || '/',
})

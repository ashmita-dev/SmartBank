import process from 'node:process'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Sub-path hosting (e.g. GitHub Pages at /SmartBank/). Defaults to "/" locally.
  base: process.env.BASE_PATH || '/',
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{js,jsx}'],
    // A fixed, fake API address so tests never call a real backend.
    env: { VITE_API_BASE_URL: 'https://api.example.test/ords/sb/api' },
    restoreMocks: true,
  },
})

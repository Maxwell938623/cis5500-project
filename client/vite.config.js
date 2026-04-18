import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Do not proxy the root path; frontend should be served by Vite.
    // If you want to proxy API requests, use a more specific path like '/api'.
  }
})
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'

function normalizeBasePath(value: string | undefined): string {
  const raw = (value || '/').trim()
  if (!raw || raw === '/') {
    return '/'
  }
  return `/${raw.replace(/^\/+|\/+$/g, '')}/`
}

function joinBasePath(basePath: string, suffix: string) {
  if (basePath === '/') {
    return suffix
  }
  return `${basePath}${suffix.replace(/^\/+/, '')}`
}

const useSsl = process.env.SSL === '1' || process.env.SSL === 'true'
const certDir = path.resolve(__dirname, '../certs')

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const basePath = normalizeBasePath(env.VITE_APP_BASE_PATH)

  return {
    base: basePath,
    plugins: [react()],
    server: {
      host: '127.0.0.1',
      port: 5173,
      ...(useSsl && fs.existsSync(path.join(certDir, 'server.crt'))
        ? {
            https: {
              cert: fs.readFileSync(path.join(certDir, 'server.crt')),
              key: fs.readFileSync(path.join(certDir, 'server.key')),
            },
          }
        : {}),
      proxy: {
        [joinBasePath(basePath, '/api')]: {
          target: 'http://127.0.0.1:5000',
          changeOrigin: true,
          ws: true,
        },
        [joinBasePath(basePath, '/v1')]: {
          target: 'http://127.0.0.1:5000',
          changeOrigin: true,
          ws: true,
        },
      },
    },
  }
})

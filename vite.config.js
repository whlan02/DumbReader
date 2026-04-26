import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { Buffer } from 'node:buffer'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

function nowFilename() {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  const stamp = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`
  return `${stamp}.md`
}

function currentDateStamp() {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function sanitizeFilenameBase(input) {
  const raw = String(input || '').trim()
  if (!raw) return 'untitled-note'
  const normalized = raw
    .toLowerCase()
    .replace(/\.md$/i, '')
    .replace(/[^a-z0-9 _-]+/g, ' ')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return normalized || 'untitled-note'
}

async function allocateUniqueFilename(saveDir, preferredBaseName) {
  const base = sanitizeFilenameBase(preferredBaseName)
  const date = currentDateStamp()
  const stem = `${base}-${date}`
  let candidate = `${stem}.md`
  let suffix = 2
  while (true) {
    try {
      await fs.access(path.join(saveDir, candidate))
      candidate = `${stem}-${suffix}.md`
      suffix += 1
    } catch {
      return candidate
    }
  }
}

async function readJsonBody(req) {
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  const raw = Buffer.concat(chunks).toString('utf8')
  return raw ? JSON.parse(raw) : {}
}

function savedMarkdownPlugin() {
  const saveDir = path.join(__dirname, 'saved')

  const isSafeMarkdownFilename = (name) =>
    /^[a-z0-9][a-z0-9-]*\.md$/.test(name) ||
    /^[0-9]{4}-[0-9]{2}-[0-9]{2}_[0-9]{2}-[0-9]{2}-[0-9]{2}\.md$/.test(name)

  const sendJson = (res, statusCode, data) => {
    res.statusCode = statusCode
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.end(JSON.stringify(data))
  }

  const handler = async (req, res) => {
    const host = req.headers.host || 'localhost'
    const url = new URL(req.url || '/', `http://${host}`)

    if (url.pathname === '/api/save-markdown' && req.method === 'POST') {
      try {
        const body = await readJsonBody(req)
        const content = String(body?.content || '').trim()
        const preferredBaseName = String(body?.preferredBaseName || '')
        if (!content) {
          sendJson(res, 400, { ok: false, error: 'content is empty' })
          return true
        }
        await fs.mkdir(saveDir, { recursive: true })
        const fileName = preferredBaseName
          ? await allocateUniqueFilename(saveDir, preferredBaseName)
          : nowFilename()
        const filePath = path.join(saveDir, fileName)
        await fs.writeFile(filePath, `${content}\n`, 'utf8')
        sendJson(res, 200, { ok: true, fileName, relativePath: `saved/${fileName}` })
        return true
      } catch (error) {
        sendJson(res, 500, { ok: false, error: error instanceof Error ? error.message : String(error) })
        return true
      }
    }

    if (url.pathname === '/api/saved-markdown/list' && req.method === 'GET') {
      try {
        await fs.mkdir(saveDir, { recursive: true })
        const entries = await fs.readdir(saveDir, { withFileTypes: true })
        const files = entries
          .filter((e) => e.isFile() && e.name.endsWith('.md'))
          .map((e) => e.name)
          .sort((a, b) => b.localeCompare(a))
        sendJson(res, 200, { ok: true, files })
        return true
      } catch (error) {
        sendJson(res, 500, { ok: false, error: error instanceof Error ? error.message : String(error) })
        return true
      }
    }

    if (url.pathname === '/api/saved-markdown/file' && req.method === 'GET') {
      try {
        const name = String(url.searchParams.get('name') || '')
        if (!isSafeMarkdownFilename(name)) {
          sendJson(res, 400, { ok: false, error: 'invalid file name' })
          return true
        }
        const filePath = path.join(saveDir, name)
        const content = await fs.readFile(filePath, 'utf8')
        sendJson(res, 200, { ok: true, name, content })
        return true
      } catch (error) {
        sendJson(res, 500, { ok: false, error: error instanceof Error ? error.message : String(error) })
        return true
      }
    }

    if (url.pathname === '/api/saved-markdown/delete' && req.method === 'POST') {
      try {
        const body = await readJsonBody(req)
        const name = String(body?.name || '')
        if (!isSafeMarkdownFilename(name)) {
          sendJson(res, 400, { ok: false, error: 'invalid file name' })
          return true
        }
        const filePath = path.join(saveDir, name)
        await fs.rm(filePath, { force: true })
        sendJson(res, 200, { ok: true, name })
        return true
      } catch (error) {
        sendJson(res, 500, { ok: false, error: error instanceof Error ? error.message : String(error) })
        return true
      }
    }

    return false
  }

  return {
    name: 'saved-markdown-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const handled = await handler(req, res)
        if (!handled) next()
      })
    },
    configurePreviewServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const handled = await handler(req, res)
        if (!handled) next()
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), savedMarkdownPlugin()],
})

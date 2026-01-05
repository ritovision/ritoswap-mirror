// dapp/app/api/openapi/__tests__/route.test.ts
import { NextRequest } from 'next/server'

// Hoist the mock function so it's available at mock time
const { readFileMock } = vi.hoisted(() => ({
  readFileMock: vi.fn(),
}))

// Mock fs/promises default export
vi.mock('fs/promises', () => ({
  default: { readFile: readFileMock },
}))

// SUT (import AFTER mocks)
import { GET, OPTIONS } from '../route'

const makeReq = (host: string, method: string = 'GET') =>
  new NextRequest(`http://${host}/api/openapi`, {
    method,
    headers: { host },
  } as any)

let envBackup: NodeJS.ProcessEnv

beforeEach(() => {
  vi.resetAllMocks()
  envBackup = { ...process.env }
})

afterEach(() => {
  process.env = envBackup
})

describe('GET /api/openapi', () => {
  it('returns spec with current server (localhost → http) and dedupes servers', async () => {
    readFileMock.mockResolvedValueOnce(
      JSON.stringify({
        openapi: '3.0.0',
        servers: [{ url: 'https://old.example' }, { url: 'http://localhost:3000' }],
      })
    )

    const req = makeReq('localhost:3000')
    const res = await GET(req as any)

    expect(res.status).toBe(200)
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*')
    expect(res.headers.get('Cache-Control')).toBe('public, max-age=3600')

    const body = await res.json()
    expect(Array.isArray(body.servers)).toBe(true)
    // Derived server first
    expect(body.servers[0].url).toBe('http://localhost:3000')
    // Duplicates removed
    const urls = body.servers.map((s: any) => s.url)
    expect(new Set(urls).size).toBe(urls.length)
    expect(urls).toContain('https://old.example')
  })

  it('uses https for non-local hosts and prepends OPENAPI_SERVER_URL override', async () => {
    process.env.OPENAPI_SERVER_URL = 'https://override.example'
    readFileMock.mockResolvedValueOnce(
      JSON.stringify({
        openapi: '3.0.0',
        servers: [{ url: 'https://existing.example' }],
      })
    )

    const req = makeReq('api.example.com')
    const res = await GET(req as any)
    const body = await res.json()

    expect(res.status).toBe(200)
    const urls = body.servers.map((s: any) => s.url)

    // env override always comes first
    expect(urls[0]).toBe('https://override.example')

    // still includes existing
    expect(urls).toContain('https://existing.example')

    // since host was non-local, we expect an https URL was generated
    expect(urls.some((u: string) => u.startsWith('https://'))).toBe(true)
  })

  it('creates servers array when missing, using current host', async () => {
    readFileMock.mockResolvedValueOnce(JSON.stringify({ openapi: '3.0.0' }))

    const req = makeReq('localhost:3000')
    const res = await GET(req as any)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.servers).toEqual([{ url: 'http://localhost:3000' }])
  })

  it('returns 500 when reading the spec fails', async () => {
    readFileMock.mockRejectedValueOnce(new Error('boom'))
    const req = makeReq('localhost:3000')
    const res = await GET(req as any)
    const body = await res.json()

    expect(res.status).toBe(500)
    expect(body).toEqual({ error: 'Failed to load OpenAPI specification' })
  })
})

describe('OPTIONS /api/openapi', () => {
  it('responds with 200 and CORS headers', async () => {
    const res = await OPTIONS()
    expect(res.status).toBe(200)
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*')
    expect(res.headers.get('Access-Control-Allow-Methods')).toBe('GET, OPTIONS')
    expect(res.headers.get('Access-Control-Allow-Headers')).toBe('Content-Type')
  })
})

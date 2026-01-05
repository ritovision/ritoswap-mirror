
// ---- Hoisted shared mocks ----
const h = vi.hoisted(() => ({
  mockRequestJSON: vi.fn(),
}))

// only mock http + API paths; use real zod schemas to avoid union crash
vi.mock('../_http', () => ({
  requestJSON: (...args: any[]) => h.mockRequestJSON(...args),
}))

vi.mock('../signing', () => ({
  API_PATHS: { tokenStatus: (id: number | string) => `/api/token-status/${id}` },
}))

import { fetchTokenStatus } from '../token-status.client'

describe('token-status.client > fetchTokenStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls requestJSON with GET and composed schemas, returns its result', async () => {
    const result = { ok: true, status: 200, data: { exists: true, used: false }, headers: new Headers() }
    h.mockRequestJSON.mockResolvedValue(result)

    const res = await fetchTokenStatus(42)

    expect(h.mockRequestJSON).toHaveBeenCalledTimes(1)
    const [url, init, succ, errUnion] = h.mockRequestJSON.mock.calls[0]
    expect(url).toBe('/api/token-status/42')
    expect(init).toEqual({ method: 'GET' })
    expect(succ).toBeTruthy()     // real TokenStatusResponseSchema
    expect(errUnion).toBeTruthy() // real union schema
    expect(res).toBe(result)
  })
})

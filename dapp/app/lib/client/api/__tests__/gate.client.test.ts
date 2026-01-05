
// ---- Hoisted shared mocks ----
const h = vi.hoisted(() => ({
  mockRequestJSON: vi.fn(),
  mockJsonHeaders: { 'Content-Type': 'application/json' },
  succSchema: {} as any,
  errSchema:  {} as any,
}))

vi.mock('../_http', () => ({
  requestJSON: (...args: any[]) => h.mockRequestJSON(...args),
  jsonHeaders: h.mockJsonHeaders,
}))

vi.mock('../signing', () => ({
  // align with your app: '/api/gate-access'
  API_PATHS: { gateAccess: '/api/gate-access' },
}))

vi.mock('@/app/schemas/dto/gate-access.dto', () => ({
  GateAccessSuccessResponseSchema: h.succSchema,
  GateAccessErrorResponseSchema:   h.errSchema,
}))

import { requestGateAccess } from '../gate.client'

describe('gate.client > requestGateAccess', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('POSTs payload with jsonHeaders and forwards schemas', async () => {
    const payload = { kind: 'siwe', address: '0xabc' } as any
    const result = { ok: true, status: 200, data: { granted: true }, headers: new Headers() }
    h.mockRequestJSON.mockResolvedValue(result)

    const res = await requestGateAccess(payload, { cache: 'no-store' })

    expect(h.mockRequestJSON).toHaveBeenCalledTimes(1)
    const [url, init, succ, err] = h.mockRequestJSON.mock.calls[0]
    expect(url).toBe('/api/gate-access')
    expect(init.method).toBe('POST')
    expect(init.headers).toBe(h.mockJsonHeaders)
    expect(init.body).toBe(JSON.stringify(payload))
    expect(init.cache).toBe('no-store')
    expect(succ).toBe(h.succSchema)
    expect(err).toBe(h.errSchema)
    expect(res).toBe(result)
  })
})

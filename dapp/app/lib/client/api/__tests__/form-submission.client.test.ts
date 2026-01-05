
// ---- Hoisted shared mocks (usable inside vi.mock factories) ----
const h = vi.hoisted(() => ({
  mockRequestJSON: vi.fn(),
  mockJsonHeaders: { 'Content-Type': 'application/json' },
  safeParseMock: vi.fn(),
  parseMock: vi.fn(),
  successSchema: {} as any,
  errorSchema: {} as any,
}))

// mock the internal http helper used by the module
vi.mock('../_http', () => ({
  requestJSON: (...args: any[]) => h.mockRequestJSON(...args),
  jsonHeaders: h.mockJsonHeaders,
}))

// mock API paths
vi.mock('../signing', () => ({
  API_PATHS: { formSubmissionGate: '/api/form-submission-gate' },
}))

// mock DTOs
vi.mock('@/app/schemas/dto/form-submission-gate.dto', () => ({
  FormSubmissionRequestSchema: {
    safeParse: (...a: any[]) => h.safeParseMock(...a),
    parse:     (...a: any[]) => h.parseMock(...a),
  },
  FormSubmissionSuccessResponseSchema: h.successSchema,
  FormSubmissionErrorResponseSchema:   h.errorSchema,
}))

// import after mocks
import { submitForm } from '../form-submission.client'

describe('form-submission.client > submitForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('valid payload → POST with jsonHeaders/body and forwards schemas', async () => {
    const payload = { foo: 'bar' } as any
    h.safeParseMock.mockReturnValue({ success: true, data: payload })
    const resultObj = { ok: true, status: 200, data: { ok: true }, headers: new Headers() }
    h.mockRequestJSON.mockResolvedValue(resultObj)

    const res = await submitForm(payload, { cache: 'no-store' })

    expect(h.mockRequestJSON).toHaveBeenCalledTimes(1)
    const [url, init, succ, err] = h.mockRequestJSON.mock.calls[0]
    expect(url).toBe('/api/form-submission-gate')
    expect(init.method).toBe('POST')
    expect(init.headers).toBe(h.mockJsonHeaders)
    expect(init.body).toBe(JSON.stringify(payload))
    expect(init.cache).toBe('no-store')
    expect(succ).toBe(h.successSchema)
    expect(err).toBe(h.errorSchema)
    expect(res).toBe(resultObj)
  })

  it('invalid payload → returns 400 ApiResult and does not call requestJSON', async () => {
    h.safeParseMock.mockReturnValue({
      success: false,
      error: { issues: [{ message: 'nope' }] },
    })

    const res = await submitForm({} as any)

    expect(h.mockRequestJSON).not.toHaveBeenCalled()
    expect(res.ok).toBe(false)
    expect(res.status).toBe(400)
    // narrow before accessing `error`
    if (!res.ok) {
      expect(res.error).toEqual({ error: 'nope' })
    }
    expect(res.headers).toBeInstanceOf(Headers)
  })
})

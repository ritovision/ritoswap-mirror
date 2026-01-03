
// ---- Hoisted test doubles used inside vi.mock factories ----
const h = vi.hoisted(() => {
  const makeLogger = () => {
    // single self-returning logger so .child() keeps same spies
    const self: any = {
      child: vi.fn(() => self),
      info:  vi.fn(),
      warn:  vi.fn(),
      debug: vi.fn(),
      error: vi.fn(),
    }
    return self
  }
  return {
    logger: makeLogger(),
    // server env/config can be mutated per test
    serverConfig: { backdoor: { isEnabled: false, tokenId: undefined as any, address: undefined as any } },
    nodeConfig:   { isProduction: false },
    tokenModel:   { findUnique: vi.fn(), upsert: vi.fn() },
  }
})

// Mocks for module deps
vi.mock('@logger', () => ({
  createLogger: () => h.logger,
}))

vi.mock('@/app/lib/prisma/prismaNetworkUtils', () => ({
  getTokenModel: () => h.tokenModel,
}))

vi.mock('@config/server.env', () => ({
  serverConfig: h.serverConfig,
}))

vi.mock('@config/node.env', () => ({
  nodeConfig: h.nodeConfig,
}))

// Provide simple schema shims so `.parse` behaves similarly to real ones.
vi.mock('@/app/config/security.public', () => {
  const AddressSchema = {
    parse: (val: unknown) => {
      if (typeof val === 'string' && /^0x[a-fA-F0-9]{40}$/.test(val)) return val
      throw new Error('Invalid address')
    },
    safeParse: (val: unknown) => ({
      success: typeof val === 'string' && /^0x[a-fA-F0-9]{40}$/.test(val),
      data: val,
    }),
  }
  const TokenIdInputSchema = {
    parse: (v: unknown) => {
      const n = Number(v)
      if (Number.isInteger(n) && n >= 0) return n
      throw new Error('Invalid token id')
    },
  }
  return { AddressSchema, TokenIdInputSchema }
})

// Import module under test AFTER mocks
import { scheduleTokenReset, getBackdoorStatus, validateBackdoorAddress } from './BackdoorToken'

const ADDR = '0xA1b2c3d4e5f6a7b8c9d0A1b2c3d4e5f6a7b8c9d0'
const OTHER = '0x0000000000000000000000000000000000000001'

describe('BackdoorToken', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // reset config per test
    h.serverConfig.backdoor.isEnabled = false
    h.serverConfig.backdoor.tokenId  = undefined
    h.serverConfig.backdoor.address  = undefined
    h.nodeConfig.isProduction        = false

    h.tokenModel.findUnique.mockReset()
    h.tokenModel.upsert.mockReset()
  })

  afterEach(() => {
    // ensure prod flag not leaking
    h.nodeConfig.isProduction = false
  })

  describe('scheduleTokenReset()', () => {
    it('does nothing when feature flag is disabled', async () => {
      h.serverConfig.backdoor.isEnabled = false
      await scheduleTokenReset(7, ADDR)
      expect(h.tokenModel.findUnique).not.toHaveBeenCalled()
      expect(h.tokenModel.upsert).not.toHaveBeenCalled()
    })

    it('in dev: enabled but missing tokenId → refuses to activate', async () => {
      h.serverConfig.backdoor.isEnabled = true
      h.serverConfig.backdoor.tokenId   = undefined
      await scheduleTokenReset(7, ADDR)
      expect(h.tokenModel.findUnique).not.toHaveBeenCalled()
      expect(h.tokenModel.upsert).not.toHaveBeenCalled()
      expect(h.logger.warn).toHaveBeenCalled() // logged a warning
    })

    it('in prod: refuses when authorizedAddress is not configured', async () => {
      h.nodeConfig.isProduction        = true
      h.serverConfig.backdoor.isEnabled = true
      h.serverConfig.backdoor.tokenId   = '7'
      h.serverConfig.backdoor.address   = undefined // critical in prod
      await scheduleTokenReset(7, ADDR)
      expect(h.tokenModel.findUnique).not.toHaveBeenCalled()
      expect(h.tokenModel.upsert).not.toHaveBeenCalled()
    })

    it('activates and resets when everything matches (used=true & usedBy matches caller)', async () => {
      h.serverConfig.backdoor.isEnabled = true
      h.serverConfig.backdoor.tokenId   = '7'
      // dev mode: no authorized address required
      h.tokenModel.findUnique.mockResolvedValue({
        tokenId: 7,
        used: true,
        usedBy: ADDR,
        usedAt: new Date(),
      })

      await scheduleTokenReset(7, ADDR, 'req-1')

      expect(h.tokenModel.findUnique).toHaveBeenCalledWith({ where: { tokenId: 7 } })
      expect(h.tokenModel.upsert).toHaveBeenCalledWith({
        where:  { tokenId: 7 },
        update: { used: false, usedBy: null, usedAt: null },
        create: { tokenId: 7, used: false, usedBy: null, usedAt: null },
      })
      expect(h.logger.info).toHaveBeenCalled() // activation + success logs
    })

    it('skips when token not found', async () => {
      h.serverConfig.backdoor.isEnabled = true
      h.serverConfig.backdoor.tokenId   = '7'
      h.tokenModel.findUnique.mockResolvedValue(null)

      await scheduleTokenReset(7, ADDR)

      expect(h.tokenModel.findUnique).toHaveBeenCalled()
      expect(h.tokenModel.upsert).not.toHaveBeenCalled()
      expect(h.logger.warn).toHaveBeenCalledWith(expect.stringContaining('Token not found in database'), expect.any(Object))
    })

    it('skips when record shape invalid', async () => {
      h.serverConfig.backdoor.isEnabled = true
      h.serverConfig.backdoor.tokenId   = '7'
      // missing required fields to fail TokenRecordSchema.safeParse
      h.tokenModel.findUnique.mockResolvedValue({ tokenId: 7 })

      await scheduleTokenReset(7, ADDR)

      expect(h.tokenModel.upsert).not.toHaveBeenCalled()
      expect(h.logger.warn).toHaveBeenCalledWith(expect.stringContaining('unexpected shape'), expect.any(Object))
    })

    it('skips when token was not used', async () => {
      h.serverConfig.backdoor.isEnabled = true
      h.serverConfig.backdoor.tokenId   = '7'
      h.tokenModel.findUnique.mockResolvedValue({ tokenId: 7, used: false, usedBy: null, usedAt: null })

      await scheduleTokenReset(7, ADDR)

      expect(h.tokenModel.upsert).not.toHaveBeenCalled()
      expect(h.logger.warn).toHaveBeenCalledWith(expect.stringContaining('not marked as used'), expect.any(Object))
    })

    it('skips when usedBy does not match caller', async () => {
      h.serverConfig.backdoor.isEnabled = true
      h.serverConfig.backdoor.tokenId   = '7'
      h.tokenModel.findUnique.mockResolvedValue({ tokenId: 7, used: true, usedBy: OTHER, usedAt: null })

      await scheduleTokenReset(7, ADDR)

      expect(h.tokenModel.upsert).not.toHaveBeenCalled()
      expect(h.logger.warn).toHaveBeenCalledWith(expect.stringContaining('different address'), expect.any(Object))
    })

    it('in prod: requires caller to equal authorized address if set', async () => {
      h.nodeConfig.isProduction        = true
      h.serverConfig.backdoor.isEnabled = true
      h.serverConfig.backdoor.tokenId   = '7'
      h.serverConfig.backdoor.address   = ADDR // gate set

      // Mismatch caller: should NOT activate
      await scheduleTokenReset(7, OTHER)
      expect(h.tokenModel.upsert).not.toHaveBeenCalled()
      expect(h.logger.debug).toHaveBeenCalledWith(expect.stringContaining('not authorized for backdoor'), expect.any(Object))

      // Match caller: proceed (and usedBy must match as well)
      h.tokenModel.findUnique.mockResolvedValue({ tokenId: 7, used: true, usedBy: ADDR, usedAt: null })
      await scheduleTokenReset(7, ADDR)

      expect(h.tokenModel.upsert).toHaveBeenCalledTimes(1)
    })
  })

  describe('getBackdoorStatus()', () => {
    it('in prod: hides status (disabled)', () => {
      h.nodeConfig.isProduction = true
      const s = getBackdoorStatus()
      expect(s).toEqual({ enabled: false, configured: false })
    })

    it('in dev: returns config snapshot', () => {
      h.serverConfig.backdoor.isEnabled = true
      h.serverConfig.backdoor.tokenId   = '42'
      h.serverConfig.backdoor.address   = ADDR

      const s = getBackdoorStatus()
      expect(s.enabled).toBe(true)
      expect(s.configured).toBe(true)
      expect(s.targetTokenId).toBe('42')
      expect(s.authorizedAddress).toBe(ADDR)
    })
  })

  describe('validateBackdoorAddress()', () => {
    it('returns valid:true, configured:false when not set', async () => {
      h.serverConfig.backdoor.address = undefined
      const r = await validateBackdoorAddress()
      expect(r).toEqual({ valid: true, configured: false })
    })

    it('validates and returns normalized address when configured', async () => {
      h.serverConfig.backdoor.address = ADDR
      const r = await validateBackdoorAddress()
      expect(r.valid).toBe(true)
      expect(r.configured).toBe(true)
      expect(r.address).toBe(ADDR)
    })

    it('returns error when configured but invalid', async () => {
      h.serverConfig.backdoor.address = 'not-an-address'
      const r = await validateBackdoorAddress()
      expect(r.valid).toBe(false)
      expect(r.configured).toBe(true)
      expect(r.error).toMatch(/Invalid BACKDOOR_ADDRESS/)
    })
  })
})

// app/schemas/dto/__tests__/gate-access.dto.test.ts

// Mock strict external schemas so we test DTO wiring, not regex specifics.
vi.mock('@/app/config/security.public', async () => {
  const { z } = await import('zod')
  return {
    // Accept any non-empty string for nonce in this unit test
    NonceSchema: z.string().min(1),
    // Accept any string for signature; we still pass a plausible-looking one
    SignatureSchema: z.string(),
  }
})

import {
  GateAccessSiweRequestSchema,
  GateAccessLegacyRequestSchema,
  GateAccessSuccessResponseSchema,
  isGateAccessSiweRequest,
  isGateAccessLegacyRequest,
  isGateAccessSuccess,
  isGateAccessError,
} from '@/app/schemas/dto/gate-access.dto'

const addr = '0x1234567890abcdef1234567890abcdef12345678'
const sig = '0x' + 'b'.repeat(130)
const nonce = 'nonce-1'

describe('gate-access DTOs', () => {
  it('parses SIWE requests', () => {
    const ok = {
      address: addr,
      signature: sig,
      tokenId: '123',
      message: 'siweMessage',
      nonce,
    }
    expect(GateAccessSiweRequestSchema.safeParse(ok).success).toBe(true)
    expect(isGateAccessSiweRequest(ok)).toBe(true)
  })

  it('parses Legacy requests', () => {
    const ok = { address: addr, signature: sig, tokenId: 123, timestamp: Date.now() }
    expect(GateAccessLegacyRequestSchema.safeParse(ok).success).toBe(true)
    expect(isGateAccessLegacyRequest(ok)).toBe(true)
  })

  it('type guards for success/error (without accessToken)', () => {
    const success = {
      success: true as const,
      access: 'granted' as const,
      content: {
        welcomeText: 'hi',
        textSubmissionAreaHtml: '<div></div>',
        audioData: {
          headline: 'h',
          imageSrc: '/a.png',
          imageAlt: 'alt',
          description: 'd',
          title: 't',
          audioSrc: '/a.mp3',
        },
        styles: '',
        script: '',
      },
    }
    expect(GateAccessSuccessResponseSchema.safeParse(success).success).toBe(true)
    expect(isGateAccessSuccess(success)).toBe(true)
    expect(isGateAccessError({ error: 'nope' })).toBe(true)
  })

  it('accepts success payload with a freshly minted accessToken', () => {
    const successWithToken = {
      success: true as const,
      access: 'granted' as const,
      content: {
        welcomeText: 'hi',
        textSubmissionAreaHtml: '<div></div>',
        audioData: {
          headline: 'h',
          imageSrc: '/a.png',
          imageAlt: 'alt',
          description: 'd',
          title: 't',
          audioSrc: '/a.mp3',
        },
        styles: '',
        script: '',
      },
      accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9....',
    }

    const parsed = GateAccessSuccessResponseSchema.safeParse(successWithToken)
    if (!parsed.success) {
      // make TS happy and provide a useful failure if schema changes
      throw new Error(`parse failed: ${parsed.error.message}`)
    }

    expect(parsed.data.accessToken).toBeTypeOf('string')
  })

  it('rejects invalid accessToken type', () => {
    const bad = {
      success: true as const,
      access: 'granted' as const,
      content: {
        welcomeText: 'hi',
        textSubmissionAreaHtml: '<div></div>',
        audioData: {
          headline: 'h',
          imageSrc: '/a.png',
          imageAlt: 'alt',
          description: 'd',
          title: 't',
          audioSrc: '/a.mp3',
        },
        styles: '',
        script: '',
      },
      // intentionally wrong type; we rely on Zod to catch this at runtime
      accessToken: 123,
    }

    expect(GateAccessSuccessResponseSchema.safeParse(bad).success).toBe(false)
  })
})

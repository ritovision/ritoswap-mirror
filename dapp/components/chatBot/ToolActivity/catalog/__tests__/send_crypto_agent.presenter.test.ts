// components/chatBot/ToolActivity/catalog/__tests__/send_crypto_agent.presenter.test.ts
import { presenter } from '../presenters/send_crypto_agent.presenter'

// Minimal ChipLike stub to satisfy presenter signatures
type Chip = {
  input?: any
  output?: any
  errorText?: string
}

// Helper to safely read label/text from union ToolChipContent
function getLT(v: unknown): { label?: string; text?: string } {
  if (typeof v === 'string') return { label: undefined, text: v }
  return (v ?? {}) as any
}

describe('send_crypto_agent.presenter', () => {
  describe('pending()', () => {
    it('shows evaluating label with empty text', () => {
      const chip: Chip = {
        input: { __jwt: { address: '0x1234567890abcdef1234567890abcdef12345678' } },
      }
      const res = presenter.pending(chip as any)
      const { label, text } = getLT(res)

      expect(label).toBe('Agent: Evaluating')
      expect(text).toBe('')
    })

    it('shows same label when address is missing', () => {
      const chip: Chip = { input: {} }
      const res = presenter.pending(chip as any)
      const { label, text } = getLT(res)

      expect(label).toBe('Agent: Evaluating')
      expect(text).toBe('')
    })
  })

  describe('success()', () => {
    it('labels and composes text for SEND with amount and recipient', () => {
      const chip: Chip = {
        output: {
          content: [
            { type: 'text', text: 'Approved: Sent 0.25 ETH on Sepolia to 0x1234…5678.' },
            {
              type: 'json',
              data: {
                decision: 'send',
                sentAmountEth: 0.25,
                to: '0x1234567890abcdef1234567890abcdef12345678',
                network: 'Sepolia',
              },
            },
          ],
        },
      }

      const res = presenter.success(chip as any)
      const { label, text } = getLT(res)

      expect(label).toBe('Agent Sent Crypto.')
      expect(text).toBe('.25 ETH sent to 0x1234…5678 on Sepolia')
    })

    it('handles SEND without network', () => {
      const chip: Chip = {
        output: {
          content: [
            {
              type: 'json',
              data: {
                decision: 'send',
                sentAmountEth: 0.15,
                to: '0xabcd',
              },
            },
          ],
        },
      }

      const res = presenter.success(chip as any)
      const { label, text } = getLT(res)

      expect(label).toBe('Agent Sent Crypto.')
      expect(text).toBe('.15 ETH sent to 0xabcd')
    })

    it('labels and composes text for DENY with reason', () => {
      const chip: Chip = {
        output: {
          content: [
            { type: 'text', text: 'Declined: Not eligible.' },
            {
              type: 'json',
              data: {
                decision: 'deny',
                reason: 'Not eligible.',
              },
            },
          ],
        },
      }

      const res = presenter.success(chip as any)
      const { label, text } = getLT(res)

      expect(label).toBe('Agent Declined.')
      expect(text).toBe('Not eligible.')
    })

    it('falls back to text-only when no JSON content is present', () => {
      const chip: Chip = {
        output: {
          content: [
            { type: 'text', text: 'Line A' },
            { type: 'text', text: 'Line B' },
          ],
        },
      }

      const res = presenter.success(chip as any)
      const { label, text } = getLT(res)

      expect(label).toBe('Agent Result')
      expect(text).toBe('Line A\nLine B')
    })
  })

  describe('error()', () => {
    it('returns Agent Error label with raw error text', () => {
      const chip: Chip = { errorText: 'JWT required: please authenticate' }
      const res = presenter.error(chip as any)
      const { label, text } = getLT(res)

      expect(label).toBe('Agent Error')
      expect(text).toBe('JWT required: please authenticate')
    })

    it('handles address errors', () => {
      const chip: Chip = { errorText: 'address not found in session' }
      const res = presenter.error(chip as any)
      const { label, text } = getLT(res)

      expect(label).toBe('Agent Error')
      expect(text).toBe('address not found in session')
    })

    it('shows default message when errorText is missing', () => {
      const chip: Chip = { errorText: undefined }
      const res = presenter.error(chip as any)
      const { label, text } = getLT(res)

      expect(label).toBe('Agent Error')
      expect(text).toBe('An unexpected error occurred')
    })
  })
})
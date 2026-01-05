// dapp/app/lib/notifications/__tests__/events.test.ts
import { NOTIFICATION_EVENTS, getEventByTag, hasEvent } from '../events'

describe('NOTIFICATION_EVENTS catalog', () => {
  it('includes all critical events', () => {
    const keys = Object.keys(NOTIFICATION_EVENTS)

    // core NFT events
    expect(keys).toContain('NFT_MINTED')
    expect(keys).toContain('NFT_BURNED')
    expect(keys).toContain('NFT_RECEIVED')
    expect(keys).toContain('NFT_TRANSFERRED')

    // tx lifecycle
    expect(keys).toContain('TRANSACTION_PENDING')
    expect(keys).toContain('TRANSACTION_CONFIRMED')
    expect(keys).toContain('TRANSACTION_FAILED')
    expect(keys).toContain('TRANSACTION_CANCELLED')

    // wallet
    expect(keys).toContain('WALLET_CONNECTED')
    expect(keys).toContain('WALLET_DISCONNECTED')

    // errors/info
    expect(keys).toContain('INSUFFICIENT_FUNDS')
    expect(keys).toContain('INVALID_TOKEN_ID')
    expect(keys).toContain('NOT_TOKEN_OWNER')
    expect(keys).toContain('ALREADY_MINTED')
    expect(keys).toContain('DATA_REFRESHED')
    expect(keys).toContain('NETWORK_ERROR')
    expect(keys).toContain('CONTRACT_ERROR')
  })

  it('has correct types and default channels for selected events', () => {
    // success events
    expect(NOTIFICATION_EVENTS.NFT_MINTED.type).toBe('success')
    expect(NOTIFICATION_EVENTS.NFT_MINTED.channels).toBe('both')

    expect(NOTIFICATION_EVENTS.NFT_BURNED.type).toBe('success')
    expect(NOTIFICATION_EVENTS.NFT_BURNED.channels).toBe('both')

    expect(NOTIFICATION_EVENTS.TRANSACTION_CONFIRMED.type).toBe('success')
    expect(NOTIFICATION_EVENTS.TRANSACTION_CONFIRMED.channels).toBe('both')

    // loading / toast-only
    expect(NOTIFICATION_EVENTS.TRANSACTION_PENDING.type).toBe('loading')
    expect(NOTIFICATION_EVENTS.TRANSACTION_PENDING.channels).toBe('toast')

    // error events
    expect(NOTIFICATION_EVENTS.TRANSACTION_FAILED.type).toBe('error')
    expect(NOTIFICATION_EVENTS.TRANSACTION_FAILED.channels).toBe('both')

    expect(NOTIFICATION_EVENTS.INSUFFICIENT_FUNDS.type).toBe('error')
    expect(NOTIFICATION_EVENTS.INSUFFICIENT_FUNDS.channels).toBe('toast')

    expect(NOTIFICATION_EVENTS.NOT_TOKEN_OWNER.type).toBe('error')
    expect(NOTIFICATION_EVENTS.NOT_TOKEN_OWNER.channels).toBe('toast')

    expect(NOTIFICATION_EVENTS.NETWORK_ERROR.type).toBe('error')
    expect(NOTIFICATION_EVENTS.CONTRACT_ERROR.type).toBe('error')

    // info events
    expect(NOTIFICATION_EVENTS.TRANSACTION_CANCELLED.type).toBe('info')
    expect(NOTIFICATION_EVENTS.TRANSACTION_CANCELLED.channels).toBe('toast')

    expect(NOTIFICATION_EVENTS.WALLET_DISCONNECTED.type).toBe('info')
    expect(NOTIFICATION_EVENTS.DATA_REFRESHED.type).toBe('info')

    // wallet connected
    expect(NOTIFICATION_EVENTS.WALLET_CONNECTED.type).toBe('success')
    expect(NOTIFICATION_EVENTS.WALLET_CONNECTED.channels).toBe('toast')
  })

  it('provides sensible default sources', () => {
    // user-initiated successes
    expect(NOTIFICATION_EVENTS.NFT_MINTED.source).toBe('user')
    expect(NOTIFICATION_EVENTS.NFT_BURNED.source).toBe('user')

    // watcher-initiated NFT movements
    expect(NOTIFICATION_EVENTS.NFT_RECEIVED.source).toBe('watcher')
    expect(NOTIFICATION_EVENTS.NFT_TRANSFERRED.source).toBe('watcher')

    // system-level errors
    expect(NOTIFICATION_EVENTS.INSUFFICIENT_FUNDS.source).toBe('system')
    expect(NOTIFICATION_EVENTS.NETWORK_ERROR.source).toBe('system')
    expect(NOTIFICATION_EVENTS.CONTRACT_ERROR.source).toBe('system')
  })

  it('getEventByTag returns the exact event object for known tags', () => {
    expect(getEventByTag('nft-minted')).toBe(NOTIFICATION_EVENTS.NFT_MINTED)
    expect(getEventByTag('nft-burned')).toBe(NOTIFICATION_EVENTS.NFT_BURNED)
    expect(getEventByTag('nft-received')).toBe(NOTIFICATION_EVENTS.NFT_RECEIVED)
    expect(getEventByTag('nft-transferred')).toBe(NOTIFICATION_EVENTS.NFT_TRANSFERRED)
  })

  it('getEventByTag returns undefined for unknown tags', () => {
    expect(getEventByTag('totally-unknown-tag')).toBeUndefined()
    expect(getEventByTag('')).toBeUndefined()
  })

  it('hasEvent accurately reports presence', () => {
    expect(hasEvent('NFT_MINTED')).toBe(true)
    expect(hasEvent('TRANSACTION_PENDING')).toBe(true)
    // @ts-expect-error intentional wrong key to verify runtime behavior
    expect(hasEvent('SOMETHING_THAT_DOES_NOT_EXIST')).toBe(false)
  })

  it('all tags (when present) are unique', () => {
    const events = Object.values(NOTIFICATION_EVENTS)
    const tags = events.map(e => e.tag).filter(Boolean) as string[]
    const unique = new Set(tags)
    expect(unique.size).toBe(tags.length)
  })

  it('each event includes a title and a valid type', () => {
    const validTypes = new Set(['success', 'error', 'info', 'loading'])
    for (const e of Object.values(NOTIFICATION_EVENTS)) {
      expect(typeof e.title).toBe('string')
      expect(e.title.length).toBeGreaterThan(0)
      expect(validTypes.has(e.type as any)).toBe(true)
    }
  })
})

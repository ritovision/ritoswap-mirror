import React from 'react'
import { render, screen } from '@testing-library/react'

// SUT
import { ChainInfoProvider, useChainInfo } from '../ChainInfoProvider'

// Mock wagmi hooks used by the provider
vi.mock('wagmi', () => ({
  useAccount: vi.fn(),
  useConfig: vi.fn(),
}))

import { useAccount, useConfig } from 'wagmi'

const Harness: React.FC<{ chainId: number; token?: string }> = ({ chainId, token }) => {
  const info = useChainInfo()
  return (
    <div>
      <div data-testid="name">{info.getChainDisplayName(chainId)}</div>
      <div data-testid="current-name">{info.getCurrentChainDisplayName()}</div>

      <img data-testid="chain-logo" alt="" src={info.getChainLogoUrl(chainId)} />
      <img data-testid="current-chain-logo" alt="" src={info.getCurrentChainLogoUrl()} />
      <img data-testid="token-logo" alt="" src={info.getTokenLogoUrl(chainId, token ?? '')} />
    </div>
  )
}

describe('ChainInfoProvider', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('falls back to Unknown + data URI when no chains and no active chain', () => {
    vi.mocked(useConfig).mockReturnValue({ chains: [] } as any)
    vi.mocked(useAccount).mockReturnValue({ chain: undefined } as any)

    render(
      <ChainInfoProvider>
        <Harness chainId={999} />
      </ChainInfoProvider>
    )

    expect(screen.getByTestId('name').textContent).toBe('Unknown')
    expect(screen.getByTestId('current-name').textContent).toBe('Unknown')

    const chainLogo = screen.getByTestId('chain-logo') as HTMLImageElement
    const currentLogo = screen.getByTestId('current-chain-logo') as HTMLImageElement
    const tokenLogo = screen.getByTestId('token-logo') as HTMLImageElement

    expect(chainLogo.src).toMatch(/^data:image\/svg\+xml/)
    expect(currentLogo.src).toMatch(/^data:image\/svg\+xml/)
    expect(tokenLogo.src).toMatch(/^data:image\/svg\+xml/)
  })

  it('uses config chain name and normalizes it into the TrustWallet CDN key', () => {
    // Name chosen to exercise normalization (lowercase, spaces -> dashes, strip punctuation)
    vi.mocked(useConfig).mockReturnValue({
      chains: [{ id: 1, name: 'Bnb Smart Chain (BEP20)!' }],
    } as any)
    vi.mocked(useAccount).mockReturnValue({ chain: undefined } as any)

    render(
      <ChainInfoProvider>
        <Harness chainId={1} token="0xABCDEF1234567890ABCDEF1234567890ABCDEF12" />
      </ChainInfoProvider>
    )

    expect(screen.getByTestId('name').textContent).toBe('Bnb Smart Chain (BEP20)!')

    const chainLogo = screen.getByTestId('chain-logo') as HTMLImageElement
    const tokenLogo = screen.getByTestId('token-logo') as HTMLImageElement

    // Normalized key should be "bnb-smart-chain-bep20"
    expect(chainLogo.src).toBe(
      'https://cdn.jsdelivr.net/gh/trustwallet/assets@master/blockchains/bnb-smart-chain-bep20/info/logo.png'
    )
    // Token address lowercased
    expect(tokenLogo.src).toBe(
      'https://cdn.jsdelivr.net/gh/trustwallet/assets@master/blockchains/bnb-smart-chain-bep20/assets/0xabcdef1234567890abcdef1234567890abcdef12/logo.png'
    )
  })

  it('falls back to active chain when the requested chainId is not in config', () => {
    vi.mocked(useConfig).mockReturnValue({ chains: [] } as any)
    vi.mocked(useAccount).mockReturnValue({ chain: { id: 56, name: 'BSC' } } as any)

    render(
      <ChainInfoProvider>
        {/* ask for arbitrary chainId 1 — provider will fall back to activeChain */}
        <Harness chainId={1} />
      </ChainInfoProvider>
    )

    expect(screen.getByTestId('name').textContent).toBe('BSC')
    expect(screen.getByTestId('current-name').textContent).toBe('BSC')

    const chainLogo = screen.getByTestId('chain-logo') as HTMLImageElement
    const currentLogo = screen.getByTestId('current-chain-logo') as HTMLImageElement

    // With name "BSC", normalized key is "bsc"
    expect(chainLogo.src).toBe(
      'https://cdn.jsdelivr.net/gh/trustwallet/assets@master/blockchains/bsc/info/logo.png'
    )
    expect(currentLogo.src).toBe(
      'https://cdn.jsdelivr.net/gh/trustwallet/assets@master/blockchains/bsc/info/logo.png'
    )
  })

  it('returns fallback logo for token when address is missing', () => {
    vi.mocked(useConfig).mockReturnValue({
      chains: [{ id: 1, name: 'Ethereum' }],
    } as any)
    vi.mocked(useAccount).mockReturnValue({ chain: { id: 1, name: 'Ethereum' } } as any)

    render(
      <ChainInfoProvider>
        <Harness chainId={1} token="" />
      </ChainInfoProvider>
    )

    const tokenLogo = screen.getByTestId('token-logo') as HTMLImageElement
    expect(tokenLogo.src).toMatch(/^data:image\/svg\+xml/)
  })
})

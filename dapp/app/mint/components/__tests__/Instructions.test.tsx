// app/mint/components/__tests__/Instructions.test.tsx
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from '@testing-library/react'

import localhostJson from '@Contract/local_blockchain.json'
import sepoliaJson   from '@Contract/sepolia.json'
import mainnetJson   from '@Contract/mainnet.json'

// Env helpers to seed required vars before importing component
import {
  resetModulesAndSeed,
  seedSepolia,
  seedRitonet,
  seedEthereum,
  seedBase,
} from '@/test/helpers/env'

// Extract the three on-chain addresses
const LOCAL_ADDRESS    = localhostJson.OnePerWalletKeyToken.address
const SEPOLIA_ADDRESS  = sepoliaJson.OnePerWalletKeyToken.address
const MAINNET_ADDRESS  = mainnetJson.OnePerWalletKeyToken.address

// ---- Clipboard mock setup ----
Object.defineProperty(window, 'isSecureContext', {
  value: true,
  configurable: true,
})
const mockClipboard = {
  writeText: vi.fn().mockResolvedValue(undefined),
}
Object.defineProperty(navigator, 'clipboard', {
  value: mockClipboard,
  writable: true,
  configurable: true,
})

async function load() {
  const mod = await import('../Instructions/Instructions')
  return mod.default
}

describe('Instructions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.unstubAllEnvs()
    vi.resetModules()
    cleanup()
  })

  it('renders all FAQ sections', async () => {
    resetModulesAndSeed(seedSepolia) // default safe env
    const Instructions = await load()
    render(<Instructions />)

    expect(screen.getByText('Mint & Burn FAQ')).toBeInTheDocument()
    expect(screen.getByText('Rules for Colored Keys:')).toBeInTheDocument()
    expect(screen.getByText("What's the key for?")).toBeInTheDocument()
    expect(screen.getByText('How does minting work?')).toBeInTheDocument()
    expect(screen.getByText('How does burning work?')).toBeInTheDocument()
    expect(screen.getByText("Where is the NFT's content stored?")).toBeInTheDocument()
  })

  it('displays contract address based on environment', async () => {
    resetModulesAndSeed(seedSepolia)
    const Instructions = await load()
    render(<Instructions />)

    expect(screen.getByText(/Smart Contract Address:/)).toBeInTheDocument()
    const btn = screen.getByRole('button', { name: /Copy smart contract address/i })
    expect(btn).toBeInTheDocument()
  })

  it('copies contract address to clipboard when clicked (Sepolia)', async () => {
    resetModulesAndSeed(seedSepolia)
    const Instructions = await load()
    render(<Instructions />)

    fireEvent.click(screen.getByRole('button', { name: /Copy smart contract address/i }))
    expect(mockClipboard.writeText).toHaveBeenCalledWith(SEPOLIA_ADDRESS)

    await waitFor(() => {
      expect(screen.getByText('Copied!')).toBeInTheDocument()
    })
  })

  it('handles different environment configurations', async () => {
    // — Sepolia —
    resetModulesAndSeed(seedSepolia)
    let Instructions = await load()
    render(<Instructions />)
    fireEvent.click(screen.getByRole('button', { name: /Copy smart contract address/i }))
    expect(mockClipboard.writeText).toHaveBeenLastCalledWith(SEPOLIA_ADDRESS)
    cleanup()

    // — Ritonet (requires extra envs) —
    resetModulesAndSeed(seedRitonet)
    Instructions = await load()
    render(<Instructions />)
    fireEvent.click(screen.getByRole('button', { name: /Copy smart contract address/i }))
    expect(mockClipboard.writeText).toHaveBeenLastCalledWith(LOCAL_ADDRESS)
    cleanup()

    // — Ethereum mainnet —
    resetModulesAndSeed(seedEthereum)
    Instructions = await load()
    render(<Instructions />)
    fireEvent.click(screen.getByRole('button', { name: /Copy smart contract address/i }))
    expect(mockClipboard.writeText).toHaveBeenLastCalledWith(MAINNET_ADDRESS)
  })

  it('uses sepolia address when no env is set (default)', async () => {
    // seedBase defaults NEXT_PUBLIC_ACTIVE_CHAIN to 'sepolia'
    resetModulesAndSeed(seedBase)
    const Instructions = await load()
    render(<Instructions />)

    fireEvent.click(screen.getByRole('button', { name: /Copy smart contract address/i }))
    expect(mockClipboard.writeText).toHaveBeenCalledWith(SEPOLIA_ADDRESS)
  })
})

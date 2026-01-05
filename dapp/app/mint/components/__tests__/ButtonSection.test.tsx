// app/mint/components/__tests__/ButtonSection.test.tsx

import React from 'react'
import { screen, fireEvent } from '@testing-library/react'
import { renderWithWagmi } from '@/test/utils/wagmi'
import ButtonSection from '../ButtonSection/ButtonSection'
import { useAccount } from 'wagmi'
import { useNFTStore } from '@store/nftStore'
import { useMintBurn } from '@hooks/useMintBurn'

let lastProcessingModalProps: any

vi.mock('wagmi', async () => {
  const actual = await vi.importActual<typeof import('wagmi')>('wagmi')
  return {
    ...actual,
    useAccount: vi.fn(),
  }
})

vi.mock('@store/nftStore', () => ({
  useNFTStore: vi.fn(),
}))

vi.mock('@hooks/useMintBurn', () => ({
  useMintBurn: vi.fn(),
}))

vi.mock('@/components/wallet/connectButton/ConnectWrapper', () => ({
  __esModule: true,
  default: () => <button>Connect Wallet</button>,
}))

vi.mock('@/components/wallet/processingModal/ProcessingModal', () => ({
  __esModule: true,
  default: (props: any) => {
    lastProcessingModalProps = props
    return <div data-testid="processing-modal" />
  },
}))

// Keep chain logic simple & deterministic in tests
vi.mock('@config/chain', () => ({
  Chain: { SEPOLIA: 'SEPOLIA' },
  isActiveChain: vi.fn(() => false),
}))

describe('ButtonSection', () => {
  let mockMint: ReturnType<typeof vi.fn>
  let mockBurn: ReturnType<typeof vi.fn>
  let mockResetAll: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    lastProcessingModalProps = undefined

    mockMint = vi.fn()
    mockBurn = vi.fn()
    mockResetAll = vi.fn()

    ;(useAccount as any).mockReturnValue({ isConnected: false })

    ;(useNFTStore as any).mockReturnValue({
      hasNFT: false,
      hasUsedTokenGate: false,
      tokenId: null,
      setLoading: vi.fn(),
      isLoading: false,
      isSwitchingAccount: false,
    })

    ;(useMintBurn as any).mockReturnValue({
      mint: mockMint,
      burn: mockBurn,
      isProcessing: false,
      isMinting: false,
      isBurning: false,
      isMintConfirming: false,
      isBurnConfirming: false,
      mintHash: undefined,
      burnHash: undefined,
      isMintSuccess: false,
      isBurnSuccess: false,
      mintError: null,
      burnError: null,
      resetMint: vi.fn(),
      resetBurn: vi.fn(),
      resetAll: mockResetAll,
    })
  })

  it('shows connect button when not connected', async () => {
    renderWithWagmi(<ButtonSection />)

    const connectButton = await screen.findByRole('button', { name: /connect wallet/i })
    expect(connectButton).toBeInTheDocument()
  })

  it('shows mint button when connected without NFT', async () => {
    ;(useAccount as any).mockReturnValue({ isConnected: true })

    renderWithWagmi(<ButtonSection />)

    const mintButton = await screen.findByRole('button', { name: /mint nft/i })
    expect(mintButton).toBeInTheDocument()
  })

  it('shows gate button and burn button when user has NFT', async () => {
    ;(useAccount as any).mockReturnValue({ isConnected: true })
    ;(useNFTStore as any).mockReturnValue({
      hasNFT: true,
      hasUsedTokenGate: false,
      tokenId: 42,
      setLoading: vi.fn(),
      isLoading: false,
      isSwitchingAccount: false,
    })

    renderWithWagmi(<ButtonSection />)

    const gateLink = await screen.findByRole('link', { name: /go to token gate/i })
    const burnButton = await screen.findByRole('button', { name: /burn nft/i })

    expect(gateLink).toBeInTheDocument()
    expect(burnButton).toBeInTheDocument()
  })

  it('shows only burn button when user has used token gate', async () => {
    ;(useAccount as any).mockReturnValue({ isConnected: true })
    ;(useNFTStore as any).mockReturnValue({
      hasNFT: true,
      hasUsedTokenGate: true,
      tokenId: 42,
      setLoading: vi.fn(),
      isLoading: false,
      isSwitchingAccount: false,
    })

    renderWithWagmi(<ButtonSection />)

    const burnButton = await screen.findByRole('button', { name: /burn nft/i })
    const gateLink = screen.queryByRole('link', { name: /go to token gate/i })

    expect(burnButton).toBeInTheDocument()
    expect(gateLink).not.toBeInTheDocument()
  })

  it('handles mint button click', async () => {
    ;(useAccount as any).mockReturnValue({ isConnected: true })

    const mockSetLoading = vi.fn()
    ;(useNFTStore as any).mockReturnValue({
      hasNFT: false,
      hasUsedTokenGate: false,
      tokenId: null,
      setLoading: mockSetLoading,
      isLoading: false,
      isSwitchingAccount: false,
    })

    renderWithWagmi(<ButtonSection />)

    const mintButton = await screen.findByRole('button', { name: /mint nft/i })
    fireEvent.click(mintButton)

    expect(mockSetLoading).toHaveBeenCalledWith(true)
    expect(mockMint).toHaveBeenCalled()
  })

  it('handles burn button click', async () => {
    ;(useAccount as any).mockReturnValue({ isConnected: true })

    const mockSetLoading = vi.fn()
    ;(useNFTStore as any).mockReturnValue({
      hasNFT: true,
      hasUsedTokenGate: false,
      tokenId: 42,
      setLoading: mockSetLoading,
      isLoading: false,
      isSwitchingAccount: false,
    })

    renderWithWagmi(<ButtonSection />)

    const burnButton = await screen.findByRole('button', { name: /burn nft/i })
    fireEvent.click(burnButton)

    expect(mockSetLoading).toHaveBeenCalledWith(true)
    expect(mockBurn).toHaveBeenCalledWith(42)
  })

  it('shows processing state during transaction and passes hash to ProcessingModal', async () => {
    ;(useAccount as any).mockReturnValue({ isConnected: true })
    ;(useNFTStore as any).mockReturnValue({
      hasNFT: false,
      hasUsedTokenGate: false,
      tokenId: null,
      setLoading: vi.fn(),
      isLoading: false,
      isSwitchingAccount: false,
    })

    ;(useMintBurn as any).mockReturnValue({
      mint: mockMint,
      burn: mockBurn,
      isProcessing: true,
      isMinting: false,
      isBurning: false,
      isMintConfirming: false,
      isBurnConfirming: false,
      mintHash: '0x123',
      burnHash: undefined,
      isMintSuccess: false,
      isBurnSuccess: false,
      mintError: null,
      burnError: null,
      resetMint: vi.fn(),
      resetBurn: vi.fn(),
      resetAll: mockResetAll,
    })

    renderWithWagmi(<ButtonSection />)

    const processingButton = await screen.findByRole('button', {
      name: /minting nft, processing/i,
    })

    expect(processingButton).toBeInTheDocument()
    expect(processingButton).toBeDisabled()
    expect(processingButton).toHaveAttribute('aria-busy', 'true')

    // ProcessingModal should be wired to the current mint hash and visibility
    expect(lastProcessingModalProps).toBeDefined()
    expect(lastProcessingModalProps.transactionHash).toBe('0x123')
    expect(lastProcessingModalProps.isVisible).toBe(true)
  })
})

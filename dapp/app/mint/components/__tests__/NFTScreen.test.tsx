// app/mint/components/__tests__/NFTScreen.test.tsx

import { render, screen, waitFor } from '@testing-library/react'
import NFTScreen from '../NFTScreen/NFTScreen'
import { useAccount } from 'wagmi'
import { useNFTStore } from '@/app/store/nftStore'

// Mock wagmi
vi.mock('wagmi', () => ({
  useAccount: vi.fn(),
}))

// Mock NFT store
vi.mock('@/app/store/nftStore', () => ({
  useNFTStore: vi.fn(),
}))

describe('NFTScreen', () => {
  const mockStoreData = {
    hasNFT: false,
    backgroundColor: null,
    keyColor: null,
    tokenId: null,
    isSwitchingAccount: false,
    previousData: null,
    isLoading: false,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    ;(useAccount as any).mockReturnValue({ isConnected: false })
    ;(useNFTStore as any).mockReturnValue(mockStoreData)
  })

  it('shows lock icon when not connected', async () => {
    render(<NFTScreen />)

    await waitFor(() => {
      expect(screen.getByTestId('lock-icon')).toBeInTheDocument()
    })
  })

  it('shows default white key when connected without NFT', async () => {
    ;(useAccount as any).mockReturnValue({ isConnected: true })
    render(<NFTScreen />)

    await waitFor(() => {
      const svg = screen.getByTestId('key-svg')
      expect(svg).toBeInTheDocument()
      expect(svg).toHaveStyle({ color: 'white' })
    })
  })

  it('shows custom colored key when user has NFT', async () => {
    ;(useAccount as any).mockReturnValue({ isConnected: true })
    ;(useNFTStore as any).mockReturnValue({
      ...mockStoreData,
      hasNFT: true,
      backgroundColor: '#FF0000',
      keyColor: '#00FF00',
      tokenId: 42,
    })
    render(<NFTScreen />)

    await waitFor(() => {
      expect(screen.getByText('Key #42')).toBeInTheDocument()
      const svg = screen.getByTestId('key-svg')
      const wrapper = screen.getByTestId('key-wrapper')
      expect(wrapper).toHaveStyle({ backgroundColor: '#FF0000' })
      expect(svg).toHaveStyle({ color: '#00FF00' })
    })
  })

  it('maintains previous display during account switch', async () => {
    ;(useAccount as any).mockReturnValue({ isConnected: true })
    ;(useNFTStore as any).mockReturnValue({
      ...mockStoreData,
      hasNFT: false,
      isSwitchingAccount: true,
      previousData: {
        hasNFT: true,
        backgroundColor: '#123456',
        keyColor: '#ABCDEF',
        tokenId: 99,
      },
    })
    render(<NFTScreen />)

    await waitFor(() => {
      expect(screen.getByText('Key #99')).toBeInTheDocument()
      const wrapper = screen.getByTestId('key-wrapper')
      expect(wrapper).toHaveStyle({ backgroundColor: '#123456' })
    })
  })

  it('does not show token ID when user has no NFT', async () => {
    ;(useAccount as any).mockReturnValue({ isConnected: true })
    render(<NFTScreen />)

    await waitFor(() => {
      expect(screen.queryByText(/Key #/)).not.toBeInTheDocument()
    })
  })

  it('renders no lock or key while wallet is connecting (loading state)', async () => {
    // Force wagmi into a "connecting" state so NFTScreen stays in its
    // internal "loading" displayState, which should render no visual content.
    ;(useAccount as any).mockReturnValue({
      isConnected: false,
      isConnecting: true,
    })

    render(<NFTScreen />)

    await waitFor(() => {
      expect(screen.queryByTestId('lock-icon')).not.toBeInTheDocument()
      expect(screen.queryByTestId('key-wrapper')).not.toBeInTheDocument()
      expect(screen.queryByTestId('key-svg')).not.toBeInTheDocument()
      expect(screen.queryByText(/Key #/i)).not.toBeInTheDocument()
    })
  })

  it('applies transition classes appropriately', () => {
    const { container } = render(<NFTScreen />)

    // Grab the top-level wrapper element
    const wrapper = container.firstChild as HTMLElement
    expect(wrapper).toBeInTheDocument()

    const classList = wrapper.className

    // On initial load, we expect only the base wrapper class,
    // and no 'switching' or 'stable' modifiers yet.
    expect(classList).toBeTruthy() // has at least the wrapper class
    expect(classList).not.toContain('switching')
    expect(classList).not.toContain('stable')
  })
})

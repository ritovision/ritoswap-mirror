import { render, fireEvent } from '@testing-library/react'
import OpenWalletButton from '../OpenWalletButton/OpenWalletButton'

vi.mock('wagmi', () => ({
  useAccount: vi.fn(),
}))

vi.mock('@/app/utils/mobile', () => ({
  isMobileDevice: vi.fn(),
}))

vi.mock('@/app/utils/walletDeeplink', () => ({
  openWalletDeeplink: vi.fn(),
  DUMMY_WALLETCONNECT_URI: 'wc:ritoswap',
}))

import { useAccount } from 'wagmi'
import { isMobileDevice } from '@/app/utils/mobile'
import { openWalletDeeplink } from '@/app/utils/walletDeeplink'

describe('OpenWalletButton', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should not render on desktop', () => {
    ;(isMobileDevice as any).mockReturnValue(false)
    ;(useAccount as any).mockReturnValue({
      isConnected: true,
      connector: { id: 'walletConnect' },
    })
    
    const { container } = render(<OpenWalletButton />)
    expect(container.firstChild).toBeNull()
  })

  it('should not render when not connected', () => {
    ;(isMobileDevice as any).mockReturnValue(true)
    ;(useAccount as any).mockReturnValue({
      isConnected: false,
      connector: null,
    })
    
    const { container } = render(<OpenWalletButton />)
    expect(container.firstChild).toBeNull()
  })

  it('should not render for non-WalletConnect connectors', () => {
    ;(isMobileDevice as any).mockReturnValue(true)
    ;(useAccount as any).mockReturnValue({
      isConnected: true,
      connector: { id: 'metamask' },
    })
    
    const { container } = render(<OpenWalletButton />)
    expect(container.firstChild).toBeNull()
  })

  it('should render and handle clicks on mobile with WalletConnect', () => {
    ;(isMobileDevice as any).mockReturnValue(true)
    ;(useAccount as any).mockReturnValue({
      isConnected: true,
      connector: { id: 'walletConnect' },
    })
    
    const { getByLabelText } = render(<OpenWalletButton />)
    const button = getByLabelText('Open wallet app')
    
    expect(button).toBeInTheDocument()
    
    fireEvent.click(button)
    expect(openWalletDeeplink).toHaveBeenCalledTimes(1)
  })
})

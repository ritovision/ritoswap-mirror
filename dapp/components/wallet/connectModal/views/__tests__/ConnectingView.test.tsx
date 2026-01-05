// components/utilities/wallet/connectModal/views/__tests__/ConnectingView.test.tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ConnectingView } from '../ConnectingView'

describe('ConnectingView', () => {
  const mockWallet = {
    name: 'MetaMask',
    icon: '/icons/metamask.png',
  }

  const defaultProps = {
    wallet: mockWallet,
    onCancel: vi.fn(),
    onOpenWallet: vi.fn(),
    canOpenMobile: false,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('rendering', () => {
    it('renders the connecting status with wallet icon', () => {
      render(<ConnectingView {...defaultProps} />)
      
      const icon = screen.getByAltText('MetaMask logo')
      expect(icon).toBeInTheDocument()
      expect(icon).toHaveAttribute('src', '/icons/metamask.png')
      
      expect(screen.getByText('Connecting')).toBeInTheDocument()
    })

    it('renders animated dots', () => {
      const { container } = render(<ConnectingView {...defaultProps} />)
      
      const dotsContainer = container.querySelector('[aria-hidden="true"]')
      expect(dotsContainer).toBeInTheDocument()
      
      const dots = container.querySelectorAll('[aria-hidden="true"] span')
      expect(dots).toHaveLength(3)
    })

    it('renders instruction text', () => {
      render(<ConnectingView {...defaultProps} />)
      
      expect(
        screen.getByText('Please check your wallet to accept or reject connection')
      ).toBeInTheDocument()
    })

    it('renders without wallet icon when icon is not provided', () => {
      const walletWithoutIcon = { name: 'Unknown Wallet' }
      render(<ConnectingView {...defaultProps} wallet={walletWithoutIcon} />)
      
      expect(screen.queryByAltText(/logo/i)).not.toBeInTheDocument()
      expect(screen.getByText('Connecting')).toBeInTheDocument()
    })

    it('renders when wallet is null', () => {
      render(<ConnectingView {...defaultProps} wallet={null} />)
      
      expect(screen.getByText('Connecting')).toBeInTheDocument()
      expect(screen.queryByRole('img')).not.toBeInTheDocument()
    })
  })

  describe('accessibility', () => {
    it('has proper ARIA labels and roles', () => {
      render(<ConnectingView {...defaultProps} />)
      
      const region = screen.getByRole('region')
      expect(region).toHaveAttribute('aria-labelledby', 'connecting-status')
      
      const status = screen.getByRole('status')
      expect(status).toHaveAttribute('id', 'connecting-status')
      expect(status).toHaveAttribute('aria-live', 'polite')
    })

    it('marks decorative dots as aria-hidden', () => {
      const { container } = render(<ConnectingView {...defaultProps} />)
      
      const dotsContainer = container.querySelector('[aria-hidden="true"]')
      expect(dotsContainer).toBeInTheDocument()
    })

    it('has descriptive button labels', () => {
      render(<ConnectingView {...defaultProps} canOpenMobile />)
      
      expect(screen.getByLabelText('Cancel wallet connection')).toBeInTheDocument()
      expect(screen.getByLabelText('Open wallet app')).toBeInTheDocument()
    })
  })

  describe('cancel button', () => {
    it('renders cancel button', () => {
      render(<ConnectingView {...defaultProps} />)
      
      expect(screen.getByText('Cancel')).toBeInTheDocument()
    })

    it('calls onCancel when cancel button is clicked', async () => {
      const user = userEvent.setup()
      render(<ConnectingView {...defaultProps} />)
      
      await user.click(screen.getByText('Cancel'))
      
      expect(defaultProps.onCancel).toHaveBeenCalledTimes(1)
    })

    it('cancel button is keyboard accessible', async () => {
      const user = userEvent.setup()
      render(<ConnectingView {...defaultProps} />)
      
      const cancelButton = screen.getByLabelText('Cancel wallet connection')
      cancelButton.focus()
      
      await user.keyboard('{Enter}')
      
      expect(defaultProps.onCancel).toHaveBeenCalledTimes(1)
    })
  })

  describe('open wallet button', () => {
    it('renders open wallet button when canOpenMobile is true', () => {
      render(<ConnectingView {...defaultProps} canOpenMobile />)
      
      expect(screen.getByText('Open Wallet')).toBeInTheDocument()
    })

    it('does not render open wallet button when canOpenMobile is false', () => {
      render(<ConnectingView {...defaultProps} canOpenMobile={false} />)
      
      expect(screen.queryByText('Open Wallet')).not.toBeInTheDocument()
    })

    it('calls onOpenWallet when open wallet button is clicked', async () => {
      const user = userEvent.setup()
      render(<ConnectingView {...defaultProps} canOpenMobile />)
      
      await user.click(screen.getByText('Open Wallet'))
      
      expect(defaultProps.onOpenWallet).toHaveBeenCalledTimes(1)
    })

    it('open wallet button is keyboard accessible', async () => {
      const user = userEvent.setup()
      render(<ConnectingView {...defaultProps} canOpenMobile />)
      
      const openButton = screen.getByLabelText('Open wallet app')
      openButton.focus()
      
      await user.keyboard('{Enter}')
      
      expect(defaultProps.onOpenWallet).toHaveBeenCalledTimes(1)
    })
  })

  describe('edge cases', () => {
    it('handles rapid button clicks gracefully', async () => {
      const user = userEvent.setup()
      render(<ConnectingView {...defaultProps} />)
      
      const cancelButton = screen.getByText('Cancel')
      
      await user.tripleClick(cancelButton)
      
      expect(defaultProps.onCancel).toHaveBeenCalledTimes(3)
    })

    it('renders correctly with WalletConnect wallet', () => {
      const wcWallet = {
        name: 'WalletConnect',
        icon: '/icons/wc.png',
        isWalletConnect: true,
      }
      
      render(<ConnectingView {...defaultProps} wallet={wcWallet} />)
      
      expect(screen.getByAltText('WalletConnect logo')).toBeInTheDocument()
      expect(screen.getByText('Connecting')).toBeInTheDocument()
    })

    it('handles missing wallet name gracefully', () => {
      const walletNoName = { name: '', icon: '/icons/test.png' }
      render(<ConnectingView {...defaultProps} wallet={walletNoName} />)
      
      const icon = screen.getByRole('img')
      expect(icon).toBeInTheDocument()
      expect(icon).toHaveAttribute('src', '/icons/test.png')
    })
  })
})
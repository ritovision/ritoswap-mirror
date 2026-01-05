// components/utilities/wallet/connectModal/views/__tests__/DefaultView.test.tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DefaultView } from '../DefaultView'
import type { Connector } from 'wagmi'

// Mock WalletButton component to match real implementation
vi.mock('../components/WalletButton', () => ({
  WalletButton: ({ icon, name, onClick }: any) => (
    <button
      onClick={onClick}
      aria-label={`Connect with ${name}`}
      role="listitem"
    >
      {icon && <img src={icon} alt="" aria-hidden="true" />}
      <span>{name}</span>
    </button>
  ),
}))

describe('DefaultView', () => {
  const mockConnectors: Connector[] = [
    {
      id: 'metamask',
      name: 'MetaMask',
      type: 'injected',
      icon: '/icons/metamask.png',
    } as any,
    {
      id: 'walletconnect',
      name: 'WalletConnect',
      type: 'walletConnect',
    } as any,
    {
      id: 'coinbase',
      name: 'Coinbase Wallet',
      type: 'coinbaseWallet',
      icon: '/icons/coinbase.png',
    } as any,
  ]

  const defaultProps = {
    connectors: mockConnectors,
    onSelect: vi.fn(),
    onGetWallet: vi.fn(),
    onClose: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('rendering', () => {
    it('renders the modal title', () => {
      render(<DefaultView {...defaultProps} />)
      
      expect(screen.getByText('Connect Your Wallet')).toBeInTheDocument()
    })

    it('renders RitoSwap logo', () => {
      render(<DefaultView {...defaultProps} />)
      
      const logo = screen.getByAltText('RitoSwap Logo')
      expect(logo).toBeInTheDocument()
      expect(logo).toHaveAttribute('src', '/images/brand/ritoswap.png')
    })

    it('renders close button', () => {
      render(<DefaultView {...defaultProps} />)
      
      expect(screen.getByLabelText('Close wallet connection modal')).toBeInTheDocument()
    })

    it('renders wallet button for each connector', () => {
      render(<DefaultView {...defaultProps} />)
      
      expect(screen.getByLabelText('Connect with MetaMask')).toBeInTheDocument()
      expect(screen.getByLabelText('Connect with WalletConnect')).toBeInTheDocument()
      expect(screen.getByLabelText('Connect with Coinbase Wallet')).toBeInTheDocument()
    })

    it('renders no wallet button', () => {
      render(<DefaultView {...defaultProps} />)
      
      expect(screen.getByText("I don't have a wallet yet")).toBeInTheDocument()
    })

    it('renders terms section with links', () => {
      render(<DefaultView {...defaultProps} />)
      
      expect(screen.getByText(/By connecting your wallet you agree/i)).toBeInTheDocument()
      expect(screen.getByText('Terms of Service')).toBeInTheDocument()
      expect(screen.getByText('Privacy Policy')).toBeInTheDocument()
    })

    it('uses WalletConnect icon for WalletConnect type', () => {
      render(<DefaultView {...defaultProps} />)
      
      const wcButton = screen.getByLabelText('Connect with WalletConnect')
      const icon = wcButton.querySelector('img')
      
      expect(icon).toHaveAttribute('src', '/images/wallets/walletconnect.png')
    })

    it('uses connector icon for non-WalletConnect types', () => {
      render(<DefaultView {...defaultProps} />)
      
      const metamaskButton = screen.getByLabelText('Connect with MetaMask')
      const icon = metamaskButton.querySelector('img')
      
      expect(icon).toHaveAttribute('src', '/icons/metamask.png')
    })
  })

  describe('accessibility', () => {
    it('has proper ARIA labels and roles', () => {
      render(<DefaultView {...defaultProps} />)
      
      const region = screen.getByRole('region')
      expect(region).toHaveAttribute('aria-labelledby', 'modal-title')
      
      const heading = screen.getByRole('heading', { level: 2 })
      expect(heading).toHaveAttribute('id', 'modal-title')
    })

    it('marks wallet list with proper role and label', () => {
      const { container } = render(<DefaultView {...defaultProps} />)
      
      const walletList = container.querySelector('[role="list"][aria-label="Available wallets"]')
      expect(walletList).toBeInTheDocument()
    })

    it('has descriptive button labels', () => {
      render(<DefaultView {...defaultProps} />)
      
      expect(screen.getByLabelText('Close wallet connection modal')).toBeInTheDocument()
      expect(screen.getByLabelText('Learn about wallets and how to get one')).toBeInTheDocument()
    })

    it('marks decorative SVG as aria-hidden', () => {
      const { container } = render(<DefaultView {...defaultProps} />)
      
      const closeSvg = container.querySelector('button[aria-label*="Close"] svg')
      expect(closeSvg).toHaveAttribute('aria-hidden', 'true')
    })
  })

  describe('close button', () => {
    it('calls onClose when clicked', async () => {
      const user = userEvent.setup()
      render(<DefaultView {...defaultProps} />)
      
      await user.click(screen.getByLabelText('Close wallet connection modal'))
      
      expect(defaultProps.onClose).toHaveBeenCalledTimes(1)
    })

    it('is keyboard accessible', async () => {
      const user = userEvent.setup()
      render(<DefaultView {...defaultProps} />)
      
      const closeButton = screen.getByLabelText('Close wallet connection modal')
      closeButton.focus()
      
      await user.keyboard('{Enter}')
      
      expect(defaultProps.onClose).toHaveBeenCalledTimes(1)
    })

    it('handles rapid clicks gracefully', async () => {
      const user = userEvent.setup()
      render(<DefaultView {...defaultProps} />)
      
      const closeButton = screen.getByLabelText('Close wallet connection modal')
      
      await user.tripleClick(closeButton)
      
      expect(defaultProps.onClose).toHaveBeenCalledTimes(3)
    })
  })

  describe('wallet selection', () => {
    it('calls onSelect with correct connector when wallet button is clicked', async () => {
      const user = userEvent.setup()
      render(<DefaultView {...defaultProps} />)
      
      await user.click(screen.getByLabelText('Connect with MetaMask'))
      
      expect(defaultProps.onSelect).toHaveBeenCalledTimes(1)
      expect(defaultProps.onSelect).toHaveBeenCalledWith(mockConnectors[0])
    })

    it('calls onSelect for different wallets', async () => {
      const user = userEvent.setup()
      render(<DefaultView {...defaultProps} />)
      
      await user.click(screen.getByLabelText('Connect with WalletConnect'))
      expect(defaultProps.onSelect).toHaveBeenCalledWith(mockConnectors[1])
      
      await user.click(screen.getByLabelText('Connect with Coinbase Wallet'))
      expect(defaultProps.onSelect).toHaveBeenCalledWith(mockConnectors[2])
    })

    it('allows selecting same wallet multiple times', async () => {
      const user = userEvent.setup()
      render(<DefaultView {...defaultProps} />)
      
      const metamaskButton = screen.getByLabelText('Connect with MetaMask')
      
      await user.click(metamaskButton)
      await user.click(metamaskButton)
      
      expect(defaultProps.onSelect).toHaveBeenCalledTimes(2)
    })
  })

  describe('get wallet button', () => {
    it('calls onGetWallet when clicked', async () => {
      const user = userEvent.setup()
      render(<DefaultView {...defaultProps} />)
      
      await user.click(screen.getByText("I don't have a wallet yet"))
      
      expect(defaultProps.onGetWallet).toHaveBeenCalledTimes(1)
    })

    it('is keyboard accessible', async () => {
      const user = userEvent.setup()
      render(<DefaultView {...defaultProps} />)
      
      const getWalletButton = screen.getByLabelText('Learn about wallets and how to get one')
      getWalletButton.focus()
      
      await user.keyboard('{Enter}')
      
      expect(defaultProps.onGetWallet).toHaveBeenCalledTimes(1)
    })
  })

  describe('terms section', () => {
    it('renders terms and privacy policy links', () => {
      render(<DefaultView {...defaultProps} />)
      
      const termsLink = screen.getByText('Terms of Service').closest('a')
      const privacyLink = screen.getByText('Privacy Policy').closest('a')
      
      expect(termsLink).toHaveAttribute('href', '/terms')
      expect(privacyLink).toHaveAttribute('href', '/privacy')
    })

    it('links are keyboard accessible', async () => {
      const user = userEvent.setup()
      render(<DefaultView {...defaultProps} />)
      
      const termsLink = screen.getByText('Terms of Service')
      termsLink.focus()
      
      expect(termsLink).toHaveFocus()
    })
  })

  describe('connector list', () => {
    it('renders empty state when no connectors provided', () => {
      render(<DefaultView {...defaultProps} connectors={[]} />)
      
      expect(screen.queryByRole('listitem')).not.toBeInTheDocument()
      expect(screen.getByText("I don't have a wallet yet")).toBeInTheDocument()
    })

    it('renders single connector', () => {
      const singleConnector = [mockConnectors[0]]
      render(<DefaultView {...defaultProps} connectors={singleConnector} />)
      
      expect(screen.getByLabelText('Connect with MetaMask')).toBeInTheDocument()
      expect(screen.queryByLabelText('Connect with WalletConnect')).not.toBeInTheDocument()
    })

    it('renders many connectors', () => {
      const manyConnectors = [
        ...mockConnectors,
        { id: 'trust', name: 'Trust Wallet', type: 'injected', icon: '/icons/trust.png' } as any,
        { id: 'phantom', name: 'Phantom', type: 'injected', icon: '/icons/phantom.png' } as any,
      ]
      
      render(<DefaultView {...defaultProps} connectors={manyConnectors} />)
      
      const walletButtons = screen.getAllByRole('listitem')
      expect(walletButtons.length).toBe(5)
    })

    it('handles connectors without icons', () => {
      const noIconConnector = [
        { id: 'custom', name: 'Custom Wallet', type: 'injected' } as any,
      ]
      
      render(<DefaultView {...defaultProps} connectors={noIconConnector} />)
      
      expect(screen.getByLabelText('Connect with Custom Wallet')).toBeInTheDocument()
    })
  })

  describe('component interactions', () => {
    it('allows sequential button operations', async () => {
      const user = userEvent.setup()
      render(<DefaultView {...defaultProps} />)
      
      // Select wallet
      await user.click(screen.getByLabelText('Connect with MetaMask'))
      expect(defaultProps.onSelect).toHaveBeenCalledTimes(1)
      
      // Click get wallet
      await user.click(screen.getByText("I don't have a wallet yet"))
      expect(defaultProps.onGetWallet).toHaveBeenCalledTimes(1)
      
      // Close modal
      await user.click(screen.getByLabelText('Close wallet connection modal'))
      expect(defaultProps.onClose).toHaveBeenCalledTimes(1)
    })

    it('maintains proper tab order', async () => {
      const user = userEvent.setup()
      render(<DefaultView {...defaultProps} />)
      
      // First tab goes to close button
      await user.tab()
      expect(screen.getByLabelText('Close wallet connection modal')).toHaveFocus()
    })
  })

  describe('edge cases', () => {
    it('handles connector with special characters in name', () => {
      const specialConnector = [
        { id: 'test', name: "Wallet's Name & Co.", type: 'injected' } as any,
      ]
      
      render(<DefaultView {...defaultProps} connectors={specialConnector} />)
      
      expect(screen.getByText("Wallet's Name & Co.")).toBeInTheDocument()
    })

    it('handles duplicate connector IDs gracefully', () => {
      const duplicateConnectors = [
        { id: 'same', name: 'Wallet 1', type: 'injected' } as any,
        { id: 'same', name: 'Wallet 2', type: 'injected' } as any,
      ]
      
      // Should render but with React key warning (expected)
      render(<DefaultView {...defaultProps} connectors={duplicateConnectors} />)
      
      expect(screen.getByText('Wallet 1')).toBeInTheDocument()
      expect(screen.getByText('Wallet 2')).toBeInTheDocument()
    })

    it('handles long connector names', () => {
      const longNameConnector = [
        { 
          id: 'long', 
          name: 'Super Long Wallet Name That Goes On And On', 
          type: 'injected' 
        } as any,
      ]
      
      render(<DefaultView {...defaultProps} connectors={longNameConnector} />)
      
      expect(screen.getByText('Super Long Wallet Name That Goes On And On')).toBeInTheDocument()
    })
  })
})
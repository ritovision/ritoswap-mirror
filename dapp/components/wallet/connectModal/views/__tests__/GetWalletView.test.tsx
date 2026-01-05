// components/utilities/wallet/connectModal/views/__tests__/GetWalletView.test.tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { GetWalletView } from '../GetWalletView'

describe('GetWalletView', () => {
  const defaultProps = {
    onBack: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('rendering', () => {
    it('renders the main heading', () => {
      render(<GetWalletView {...defaultProps} />)
      
      expect(screen.getByText('What does a wallet do?')).toBeInTheDocument()
    })

    it('renders all wallet feature items', () => {
      render(<GetWalletView {...defaultProps} />)
      
      expect(screen.getByText('Holds your crypto and NFTs')).toBeInTheDocument()
      expect(screen.getByText('Lets you send and receive crypto')).toBeInTheDocument()
      expect(screen.getByText("Let's you sign in to dApps securely")).toBeInTheDocument()
      expect(screen.getByText('Gives you an identity in the blockchain')).toBeInTheDocument()
    })

    it('renders wallet information text', () => {
      render(<GetWalletView {...defaultProps} />)
      
      expect(screen.getByText(/You can get one as a standalone mobile app/i)).toBeInTheDocument()
      expect(screen.getByText(/You need a wallet to interact with RitoSwap!/i)).toBeInTheDocument()
    })

    it('renders get wallet button', () => {
      render(<GetWalletView {...defaultProps} />)
      
      expect(screen.getByText('Get a Wallet')).toBeInTheDocument()
    })

    it('renders back button with arrow icon', () => {
      render(<GetWalletView {...defaultProps} />)
      
      const backButton = screen.getByLabelText('Go back to wallet selection')
      expect(backButton).toBeInTheDocument()
      
      const svg = backButton.querySelector('svg')
      expect(svg).toBeInTheDocument()
    })

    it('renders check icons for each feature', () => {
      const { container } = render(<GetWalletView {...defaultProps} />)
      
      const checkIcons = container.querySelectorAll('svg[aria-hidden="true"]')
      expect(checkIcons.length).toBeGreaterThanOrEqual(4)
    })
  })

  describe('accessibility', () => {
    it('has proper ARIA labels and roles', () => {
      render(<GetWalletView {...defaultProps} />)
      
      const region = screen.getByRole('region')
      expect(region).toHaveAttribute('aria-labelledby', 'get-wallet-title')
      
      const heading = screen.getByRole('heading', { level: 2 })
      expect(heading).toHaveAttribute('id', 'get-wallet-title')
    })

    it('marks features as a list', () => {
      render(<GetWalletView {...defaultProps} />)
      
      const list = screen.getByRole('list')
      expect(list).toBeInTheDocument()
      
      const listItems = screen.getAllByRole('listitem')
      expect(listItems).toHaveLength(4)
    })

    it('marks decorative icons as aria-hidden', () => {
      const { container } = render(<GetWalletView {...defaultProps} />)
      
      const hiddenSvgs = container.querySelectorAll('svg[aria-hidden="true"]')
      expect(hiddenSvgs.length).toBeGreaterThan(0)
    })

    it('has descriptive label for back button', () => {
      render(<GetWalletView {...defaultProps} />)
      
      expect(screen.getByLabelText('Go back to wallet selection')).toBeInTheDocument()
    })

    it('has descriptive label for external link', () => {
      render(<GetWalletView {...defaultProps} />)
      
      expect(screen.getByLabelText('Get a wallet - opens in new tab')).toBeInTheDocument()
    })
  })

  describe('back button', () => {
    it('calls onBack when clicked', async () => {
      const user = userEvent.setup()
      render(<GetWalletView {...defaultProps} />)
      
      await user.click(screen.getByLabelText('Go back to wallet selection'))
      
      expect(defaultProps.onBack).toHaveBeenCalledTimes(1)
    })

    it('is keyboard accessible', async () => {
      const user = userEvent.setup()
      render(<GetWalletView {...defaultProps} />)
      
      const backButton = screen.getByLabelText('Go back to wallet selection')
      backButton.focus()
      
      await user.keyboard('{Enter}')
      
      expect(defaultProps.onBack).toHaveBeenCalledTimes(1)
    })

    it('handles rapid clicks gracefully', async () => {
      const user = userEvent.setup()
      render(<GetWalletView {...defaultProps} />)
      
      const backButton = screen.getByLabelText('Go back to wallet selection')
      
      await user.tripleClick(backButton)
      
      expect(defaultProps.onBack).toHaveBeenCalledTimes(3)
    })
  })

  describe('get wallet link', () => {
    it('has correct href to ethereum.org', () => {
      render(<GetWalletView {...defaultProps} />)
      
      const link = screen.getByText('Get a Wallet')
      expect(link).toHaveAttribute('href', 'https://ethereum.org/en/wallets/find-wallet/')
    })

    it('opens in new tab with proper security attributes', () => {
      render(<GetWalletView {...defaultProps} />)
      
      const link = screen.getByText('Get a Wallet')
      expect(link).toHaveAttribute('target', '_blank')
      expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    })

    it('is keyboard accessible', async () => {
      const user = userEvent.setup()
      render(<GetWalletView {...defaultProps} />)
      
      const link = screen.getByText('Get a Wallet')
      link.focus()
      
      expect(link).toHaveFocus()
    })
  })

  describe('feature list content', () => {
    it('displays features in correct order', () => {
      render(<GetWalletView {...defaultProps} />)
      
      const listItems = screen.getAllByRole('listitem')
      
      expect(listItems[0]).toHaveTextContent('Holds your crypto and NFTs')
      expect(listItems[1]).toHaveTextContent('Lets you send and receive crypto')
      expect(listItems[2]).toHaveTextContent("Let's you sign in to dApps securely")
      expect(listItems[3]).toHaveTextContent('Gives you an identity in the blockchain')
    })

    it('each feature has accompanying check icon', () => {
      const { container } = render(<GetWalletView {...defaultProps} />)
      
      const listItems = screen.getAllByRole('listitem')
      
      listItems.forEach(item => {
        const svg = item.querySelector('svg')
        expect(svg).toBeInTheDocument()
      })
    })
  })

  describe('component interactions', () => {
    it('maintains proper tab order', async () => {
      const user = userEvent.setup()
      render(<GetWalletView {...defaultProps} />)
      
      // Tab to first focusable element (back button)
      await user.tab()
      expect(screen.getByLabelText('Go back to wallet selection')).toHaveFocus()
      
      // Tab to get wallet link
      await user.tab()
      expect(screen.getByText('Get a Wallet')).toHaveFocus()
    })

    it('allows sequential operations', async () => {
      const user = userEvent.setup()
      render(<GetWalletView {...defaultProps} />)
      
      // Click back button
      await user.click(screen.getByLabelText('Go back to wallet selection'))
      expect(defaultProps.onBack).toHaveBeenCalledTimes(1)
      
      // Click back button again
      await user.click(screen.getByLabelText('Go back to wallet selection'))
      expect(defaultProps.onBack).toHaveBeenCalledTimes(2)
    })
  })

  describe('styling and structure', () => {
    it('renders main content container', () => {
      render(<GetWalletView {...defaultProps} />)
      
      const region = screen.getByRole('region')
      expect(region).toBeInTheDocument()
    })

    it('renders all structural elements', () => {
      const { container } = render(<GetWalletView {...defaultProps} />)
      
      expect(screen.getByRole('heading')).toBeInTheDocument()
      expect(screen.getByRole('list')).toBeInTheDocument()
      expect(screen.getByRole('link')).toBeInTheDocument()
      expect(container.querySelector('button')).toBeInTheDocument()
    })
  })
})
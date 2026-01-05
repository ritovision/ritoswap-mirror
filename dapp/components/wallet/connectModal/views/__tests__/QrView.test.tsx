// components/utilities/wallet/connectModal/views/__tests__/QrView.test.tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QrView } from '../QrView'

// Mock the QRCode component
vi.mock('react-qr-code', () => ({
  __esModule: true,
  default: ({ value, size, bgColor, fgColor }: any) => (
    <div
      data-testid="qr-code"
      data-value={value}
      data-size={size}
      data-bgcolor={bgColor}
      data-fgcolor={fgColor}
    >
      QR Code Mock
    </div>
  ),
}))

describe('QrView', () => {
  const defaultProps = {
    qrUri: 'wc:abc123@2?relay-protocol=irn&symKey=xyz',
    copied: false,
    onBack: vi.fn(),
    onCopy: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('rendering', () => {
    it('renders the QR view with title', () => {
      render(<QrView {...defaultProps} />)
      
      expect(screen.getByText("Scan with Phone's Wallet")).toBeInTheDocument()
    })

    it('renders QR code when qrUri is provided', () => {
      render(<QrView {...defaultProps} />)
      
      const qrCode = screen.getByTestId('qr-code')
      expect(qrCode).toBeInTheDocument()
      expect(qrCode).toHaveAttribute('data-value', defaultProps.qrUri)
      expect(qrCode).toHaveAttribute('data-size', '198')
      expect(qrCode).toHaveAttribute('data-bgcolor', '#000000')
      expect(qrCode).toHaveAttribute('data-fgcolor', 'var(--accent-color)')
    })

    it('renders logo overlay on QR code', () => {
      render(<QrView {...defaultProps} />)
      
      const logo = screen.getByAltText('Logo')
      expect(logo).toBeInTheDocument()
      expect(logo).toHaveAttribute('src', '/images/blockchainLogos/ritonet.png')
    })

    it('shows loading state when qrUri is empty', () => {
      render(<QrView {...defaultProps} qrUri="" />)
      
      expect(screen.getByText('Generating QR Code...')).toBeInTheDocument()
      expect(screen.queryByTestId('qr-code')).not.toBeInTheDocument()
    })

    it('shows loading state when qrUri is not provided', () => {
      render(<QrView {...defaultProps} qrUri="" />)
      
      const loadingText = screen.getByText('Generating QR Code...')
      expect(loadingText).toBeInTheDocument()
    })
  })

  describe('accessibility', () => {
    it('has proper ARIA labels and roles', () => {
      render(<QrView {...defaultProps} />)
      
      const region = screen.getByRole('region')
      expect(region).toHaveAttribute('aria-labelledby', 'qr-title')
      
      const title = screen.getByRole('heading', { level: 2 })
      expect(title).toHaveAttribute('id', 'qr-title')
    })

    it('marks loading state with proper aria attributes', () => {
      render(<QrView {...defaultProps} qrUri="" />)
      
      const loadingState = screen.getByRole('status')
      expect(loadingState).toHaveAttribute('aria-live', 'polite')
    })

    it('has descriptive label for QR code image', () => {
      render(<QrView {...defaultProps} />)
      
      const qrLayer = screen.getByRole('img', { name: 'QR code for wallet connection' })
      expect(qrLayer).toBeInTheDocument()
    })

    it('has descriptive back button label', () => {
      render(<QrView {...defaultProps} />)
      
      expect(screen.getByLabelText('Go back to wallet selection')).toBeInTheDocument()
    })

    it('updates copy button label based on copied state', () => {
      const { rerender } = render(<QrView {...defaultProps} copied={false} />)
      
      expect(screen.getByLabelText('Copy connection link to clipboard')).toBeInTheDocument()
      
      rerender(<QrView {...defaultProps} copied />)
      
      expect(screen.getByLabelText('Copied to clipboard')).toBeInTheDocument()
    })

    it('marks SVG icons as aria-hidden', () => {
      const { container } = render(<QrView {...defaultProps} />)
      
      const svgElements = container.querySelectorAll('svg[aria-hidden="true"]')
      expect(svgElements.length).toBeGreaterThan(0)
    })
  })

  describe('back button', () => {
    it('renders back button with arrow icon', () => {
      render(<QrView {...defaultProps} />)
      
      const backButton = screen.getByLabelText('Go back to wallet selection')
      expect(backButton).toBeInTheDocument()
      
      const svg = backButton.querySelector('svg')
      expect(svg).toBeInTheDocument()
    })

    it('calls onBack when back button is clicked', async () => {
      const user = userEvent.setup()
      render(<QrView {...defaultProps} />)
      
      await user.click(screen.getByLabelText('Go back to wallet selection'))
      
      expect(defaultProps.onBack).toHaveBeenCalledTimes(1)
    })

    it('back button is keyboard accessible', async () => {
      const user = userEvent.setup()
      render(<QrView {...defaultProps} />)
      
      const backButton = screen.getByLabelText('Go back to wallet selection')
      backButton.focus()
      
      await user.keyboard('{Enter}')
      
      expect(defaultProps.onBack).toHaveBeenCalledTimes(1)
    })
  })

  describe('copy button', () => {
    it('renders copy button with default text', () => {
      render(<QrView {...defaultProps} />)
      
      expect(screen.getByText('Copy to Clipboard')).toBeInTheDocument()
    })

    it('shows "Copied!" text when copied is true', () => {
      render(<QrView {...defaultProps} copied />)
      
      expect(screen.getByText('Copied!')).toBeInTheDocument()
      expect(screen.queryByText('Copy to Clipboard')).not.toBeInTheDocument()
    })

    it('calls onCopy when copy button is clicked', async () => {
      const user = userEvent.setup()
      render(<QrView {...defaultProps} />)
      
      await user.click(screen.getByText('Copy to Clipboard'))
      
      expect(defaultProps.onCopy).toHaveBeenCalledTimes(1)
    })

    it('is disabled when qrUri is empty', () => {
      render(<QrView {...defaultProps} qrUri="" />)
      
      const copyButton = screen.getByRole('button', { name: /copy/i })
      expect(copyButton).toBeDisabled()
    })

    it('is enabled when qrUri is provided', () => {
      render(<QrView {...defaultProps} />)
      
      const copyButton = screen.getByRole('button', { name: /copy/i })
      expect(copyButton).not.toBeDisabled()
    })

    it('renders copy icon svg', () => {
      const { container } = render(<QrView {...defaultProps} />)
      
      const copyButton = screen.getByText('Copy to Clipboard').closest('button')
      const svg = copyButton?.querySelector('svg')
      
      expect(svg).toBeInTheDocument()
    })

    it('copy button is keyboard accessible', async () => {
      const user = userEvent.setup()
      render(<QrView {...defaultProps} />)
      
      const copyButton = screen.getByLabelText('Copy connection link to clipboard')
      copyButton.focus()
      
      await user.keyboard('{Enter}')
      
      expect(defaultProps.onCopy).toHaveBeenCalledTimes(1)
    })
  })

  describe('QR code rendering', () => {
    it('applies ready class when qrUri is available', () => {
      const { container } = render(<QrView {...defaultProps} />)
      
      const qrWrapper = container.querySelector('[class*="qrWrapper"]')
      expect(qrWrapper?.className).toContain('isReady')
    })

    it('does not apply ready class when qrUri is empty', () => {
      const { container } = render(<QrView {...defaultProps} qrUri="" />)
      
      const qrWrapper = container.querySelector('[class*="qrWrapper"]')
      expect(qrWrapper?.className).not.toContain('isReady')
    })

    it('hides QR layer when not ready', () => {
      render(<QrView {...defaultProps} qrUri="" />)
      
      expect(screen.queryByTestId('qr-code')).not.toBeInTheDocument()
      expect(screen.getByText('Generating QR Code...')).toBeInTheDocument()
    })

    it('shows both placeholder and QR layer when ready', () => {
      render(<QrView {...defaultProps} />)
      
      expect(screen.getByText('Generating QR Code...')).toBeInTheDocument()
      expect(screen.getByTestId('qr-code')).toBeInTheDocument()
    })
  })

  describe('edge cases', () => {
    it('handles rapid button clicks gracefully', async () => {
      const user = userEvent.setup()
      render(<QrView {...defaultProps} />)
      
      const copyButton = screen.getByText('Copy to Clipboard')
      
      await user.tripleClick(copyButton)
      
      expect(defaultProps.onCopy).toHaveBeenCalledTimes(3)
    })

    it('handles toggling between copied states', () => {
      const { rerender } = render(<QrView {...defaultProps} copied={false} />)
      
      expect(screen.getByText('Copy to Clipboard')).toBeInTheDocument()
      
      rerender(<QrView {...defaultProps} copied />)
      expect(screen.getByText('Copied!')).toBeInTheDocument()
      
      rerender(<QrView {...defaultProps} copied={false} />)
      expect(screen.getByText('Copy to Clipboard')).toBeInTheDocument()
    })

    it('handles very long qrUri values', () => {
      const longUri = 'wc:' + 'a'.repeat(1000) + '@2?relay-protocol=irn&symKey=' + 'x'.repeat(500)
      render(<QrView {...defaultProps} qrUri={longUri} />)
      
      const qrCode = screen.getByTestId('qr-code')
      expect(qrCode).toHaveAttribute('data-value', longUri)
    })

    it('handles special characters in qrUri', () => {
      const specialUri = 'wc:test@2?param=hello%20world&key=<>&"'
      render(<QrView {...defaultProps} qrUri={specialUri} />)
      
      const qrCode = screen.getByTestId('qr-code')
      expect(qrCode).toHaveAttribute('data-value', specialUri)
    })

    it('maintains button functionality during state transitions', async () => {
      const user = userEvent.setup()
      const { rerender } = render(<QrView {...defaultProps} qrUri="" />)
      
      const copyButton = screen.getByRole('button', { name: /copy/i })
      expect(copyButton).toBeDisabled()
      
      rerender(<QrView {...defaultProps} />)
      expect(copyButton).not.toBeDisabled()
      
      await user.click(copyButton)
      expect(defaultProps.onCopy).toHaveBeenCalledTimes(1)
    })

    it('handles null or undefined qrUri gracefully', () => {
      render(<QrView {...defaultProps} qrUri={null as any} />)
      
      expect(screen.getByText('Generating QR Code...')).toBeInTheDocument()
      expect(screen.queryByTestId('qr-code')).not.toBeInTheDocument()
    })
  })

  describe('component interactions', () => {
    it('allows sequential button operations', async () => {
      const user = userEvent.setup()
      render(<QrView {...defaultProps} />)
      
      // Click back
      await user.click(screen.getByLabelText('Go back to wallet selection'))
      expect(defaultProps.onBack).toHaveBeenCalledTimes(1)
      
      // Click copy
      await user.click(screen.getByText('Copy to Clipboard'))
      expect(defaultProps.onCopy).toHaveBeenCalledTimes(1)
      
      // Click back again
      await user.click(screen.getByLabelText('Go back to wallet selection'))
      expect(defaultProps.onBack).toHaveBeenCalledTimes(2)
    })

    it('maintains proper tab order', async () => {
      const user = userEvent.setup()
      render(<QrView {...defaultProps} />)
      
      // Tab through focusable elements
      await user.tab()
      expect(screen.getByLabelText('Go back to wallet selection')).toHaveFocus()
      
      await user.tab()
      expect(screen.getByLabelText('Copy connection link to clipboard')).toHaveFocus()
    })
  })
})
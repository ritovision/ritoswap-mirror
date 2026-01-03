// FILE: components/utilities/wallet/processingModal/__tests__/ProcessingModal.test.tsx
import React from 'react'
import { render, screen, fireEvent, act } from '@testing-library/react'
import ProcessingModal, {
  ProcessingModalProps,
} from '../processingModal/ProcessingModal'
import * as mobileUtils from '@/app/utils/mobile'
import * as walletDeeplink from '@/app/utils/walletDeeplink'
import * as chainConfig from '@config/chain'

describe('ProcessingModal', () => {
  const openWalletMock = vi.fn()
  const onCancelMock = vi.fn()

  beforeEach(() => {
    // use fake timers to control the 50ms / 1000ms timeouts
    vi.useFakeTimers()
    vi.spyOn(walletDeeplink, 'openWalletDeeplink').mockImplementation(openWalletMock)
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  function renderModal(props: Partial<ProcessingModalProps> = {}) {
    return render(
      <ProcessingModal
        isVisible={props.isVisible ?? false}
        onCancel={props.onCancel ?? onCancelMock}
        transactionHash={
          props.transactionHash === undefined ? null : props.transactionHash
        }
      />
    )
  }

  it('does not render when isVisible is false', () => {
    renderModal({ isVisible: false })
    expect(
      screen.queryByTestId('processing-modal-overlay')
    ).toBeNull()
  })

  it('renders when isVisible is true', () => {
    vi.spyOn(mobileUtils, 'isMobileDevice').mockReturnValue(true)
    renderModal({ isVisible: true })

    // flush useEffect
    act(() => {
      // first effect to set shouldRender
      // second timer for isShowing we don't care about here
      vi.advanceTimersByTime(0)
    })

    expect(
      screen.getByText(
        /Open your connected wallet app or extension to continue/i
      )
    ).toBeInTheDocument()
    expect(screen.getByTestId('cancel-button')).toBeInTheDocument()
  })

  it('calls onCancel when cancel button is clicked', () => {
    vi.spyOn(mobileUtils, 'isMobileDevice').mockReturnValue(false)
    renderModal({ isVisible: true, onCancel: onCancelMock })

    act(() => {
      vi.advanceTimersByTime(0)
    })

    fireEvent.click(screen.getByTestId('cancel-button'))
    expect(onCancelMock).toHaveBeenCalledOnce()
  })

  it('shows "Open Wallet" button when on mobile and calls openWalletDeeplink()', () => {
    vi.spyOn(mobileUtils, 'isMobileDevice').mockReturnValue(true)
    renderModal({ isVisible: true })

    act(() => {
      vi.advanceTimersByTime(0)
    })

    const openBtn = screen.getByTestId('open-wallet-button')
    expect(openBtn).toBeInTheDocument()

    fireEvent.click(openBtn)
    expect(openWalletMock).toHaveBeenCalledOnce()
  })

  it('does not show "Open Wallet" button when not on mobile', () => {
    vi.spyOn(mobileUtils, 'isMobileDevice').mockReturnValue(false)
    renderModal({ isVisible: true })

    act(() => {
      vi.advanceTimersByTime(0)
    })

    expect(
      screen.queryByTestId('open-wallet-button')
    ).toBeNull()
  })

  it.each([
    ['ethereum', chainConfig.CHAIN_IDS.ethereum, 'https://etherscan.io/tx/'],
    ['sepolia', chainConfig.CHAIN_IDS.sepolia, 'https://sepolia.etherscan.io/tx/'],
  ])(
    'shows block explorer link for %s transactions',
    (_, chainId, explorerBase) => {
      const txHash = '0xabc123' as `0x${string}`
      vi.spyOn(chainConfig, 'getTargetChainId').mockReturnValue(chainId)

      renderModal({ isVisible: true, transactionHash: txHash })

      act(() => {
        vi.advanceTimersByTime(0)
      })

      const link = screen.getByRole('link', {
        name: /view pending transaction on block explorer/i,
      })
      expect(link).toHaveAttribute('href', `${explorerBase}${txHash}`)
    }
  )

  it('clears the block explorer link after the modal closes', () => {
    const txHash = '0xdef456' as `0x${string}`
    vi
      .spyOn(chainConfig, 'getTargetChainId')
      .mockReturnValue(chainConfig.CHAIN_IDS.ethereum)

    const { rerender } = render(
      <ProcessingModal
        isVisible
        onCancel={onCancelMock}
        transactionHash={txHash}
      />
    )

    act(() => {
      vi.advanceTimersByTime(0)
    })

    expect(
      screen.getByRole('link', {
        name: /view pending transaction on block explorer/i,
      })
    ).toBeInTheDocument()

    rerender(
      <ProcessingModal
        isVisible={false}
        onCancel={onCancelMock}
        transactionHash={txHash}
      />
    )

    act(() => {
      vi.advanceTimersByTime(1000)
    })

    rerender(
      <ProcessingModal
        isVisible
        onCancel={onCancelMock}
        transactionHash={null}
      />
    )

    act(() => {
      vi.advanceTimersByTime(0)
    })

    expect(
      screen.queryByRole('link', {
        name: /view pending transaction on block explorer/i,
      })
    ).toBeNull()
  })

  it('keeps the modal mounted until the fade-out timer completes', () => {
    const { rerender } = render(
      <ProcessingModal isVisible onCancel={onCancelMock} />
    )

    act(() => {
      vi.advanceTimersByTime(0)
    })

    expect(
      screen.getByTestId('processing-modal-overlay')
    ).toBeInTheDocument()

    rerender(<ProcessingModal isVisible={false} onCancel={onCancelMock} />)

    act(() => {
      vi.advanceTimersByTime(999)
    })

    expect(
      screen.getByTestId('processing-modal-overlay')
    ).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(1)
    })

    expect(
      screen.queryByTestId('processing-modal-overlay')
    ).toBeNull()
  })
})

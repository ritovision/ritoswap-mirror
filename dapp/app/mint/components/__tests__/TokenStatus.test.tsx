// dapp/app/mint/components/__tests__/TokenStatus.test.tsx
import React from 'react'
import { renderWithWagmi } from '../../../../test/utils/wagmi'
import { screen, act } from '@testing-library/react'
import TokenStatus from '../TokenStatus/TokenStatus'

// 1) Mock wagmi.useAccount by pulling in the real module and overriding just useAccount
vi.mock('wagmi', () => {
  return vi
    .importActual<typeof import('wagmi')>('wagmi')
    .then((actual) => ({
      ...actual,
      useAccount: vi.fn(),
    }))
})

// 2) Mock your NFT store hook — match the path used by the component
vi.mock('@store/nftStore', () => ({
  useNFTStore: vi.fn(),
}))

// 3) Import those mocks so we can drive them in our tests
import { useAccount } from 'wagmi'
import { useNFTStore } from '@store/nftStore'

// Use vitest's helper to get typed mocks (no Mock type import needed)
const useAccountMock = vi.mocked(useAccount)
const useNFTStoreMock = vi.mocked(useNFTStore)

describe('TokenStatus Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getText() logic', () => {
    it('shows "You are not signed in" when isConnected=false', async () => {
      useAccountMock.mockReturnValue({ isConnected: false } as any)
      useNFTStoreMock.mockReturnValue({
        hasNFT: false,
        hasUsedTokenGate: false,
        isLoading: false,
      } as any)

      renderWithWagmi(<TokenStatus />)

      expect(
        await screen.findByText('You are not signed in')
      ).toBeInTheDocument()
    })

    it('shows "You have a used key..." when hasNFT & hasUsedTokenGate', async () => {
      useAccountMock.mockReturnValue({ isConnected: true } as any)
      useNFTStoreMock.mockReturnValue({
        hasNFT: true,
        hasUsedTokenGate: true,
        isLoading: false,
      } as any)

      renderWithWagmi(<TokenStatus />)

      expect(
        await screen.findByText('You have a used key...')
      ).toBeInTheDocument()
    })

    it('shows "You have an unused key!" when hasNFT && !hasUsedTokenGate', async () => {
      useAccountMock.mockReturnValue({ isConnected: true } as any)
      useNFTStoreMock.mockReturnValue({
        hasNFT: true,
        hasUsedTokenGate: false,
        isLoading: false,
      } as any)

      renderWithWagmi(<TokenStatus />)

      expect(
        await screen.findByText('You have an unused key!')
      ).toBeInTheDocument()
    })

    it("shows \"You don't have a key yet\" when connected but no NFT", async () => {
      useAccountMock.mockReturnValue({ isConnected: true } as any)
      useNFTStoreMock.mockReturnValue({
        hasNFT: false,
        hasUsedTokenGate: false,
        isLoading: false,
      } as any)

      renderWithWagmi(<TokenStatus />)

      expect(
        await screen.findByText("You don't have a key yet")
      ).toBeInTheDocument()
    })
  })

  describe('initial-load behavior', () => {
    it('renders "Loading..." while isLoading=true on first mount', () => {
      useAccountMock.mockReturnValue({ isConnected: true } as any)
      useNFTStoreMock.mockReturnValue({
        hasNFT: true,
        hasUsedTokenGate: true,
        isLoading: true,
      } as any)

      renderWithWagmi(<TokenStatus />)

      expect(screen.getByText('Loading...')).toBeInTheDocument()
      expect(screen.queryByText('You have a used key...')).toBeNull()
    })

    it('renders initial getText() result when isLoading=false on first mount', async () => {
      useAccountMock.mockReturnValue({ isConnected: true } as any)
      useNFTStoreMock.mockReturnValue({
        hasNFT: false,
        hasUsedTokenGate: false,
        isLoading: false,
      } as any)

      renderWithWagmi(<TokenStatus />)

      expect(
        await screen.findByText("You don't have a key yet")
      ).toBeInTheDocument()
    })
  })

  describe('transition flow on state change', () => {
    beforeEach(() => vi.useFakeTimers())
    afterEach(() => vi.useRealTimers())

    it('fades out old text, updates displayText after 500ms, then removes transition after 50ms', () => {
      useAccountMock.mockReturnValue({ isConnected: true } as any)
      useNFTStoreMock.mockReturnValue({
        hasNFT: false,
        hasUsedTokenGate: false,
        isLoading: false,
      } as any)
      const { rerender } = renderWithWagmi(<TokenStatus />)

      const initialText = "You don't have a key yet"
      const newText = 'You have an unused key!'

      // initial state
      const heading1 = screen.getByText(initialText)
      expect(heading1.className).not.toMatch(/transitioning/)

      // trigger update
      useNFTStoreMock.mockReturnValue({
        hasNFT: true,
        hasUsedTokenGate: false,
        isLoading: false,
      } as any)
      rerender(<TokenStatus />)

      // run the 0ms timer that toggles isTransitioning
      act(() => vi.advanceTimersByTime(0))
      const heading2 = screen.getByText(initialText)
      expect(heading2.className).toMatch(/transitioning/)

      // after 500ms, text updates
      act(() => vi.advanceTimersByTime(500))
      const heading3 = screen.getByText(newText)
      expect(heading3).toBeInTheDocument()
      expect(heading3.className).toMatch(/transitioning/)

      // after another 50ms, transition ends
      act(() => vi.advanceTimersByTime(50))
      expect(heading3.className).not.toMatch(/transitioning/)
    })
  })

  describe('no-op when text does not change', () => {
    beforeEach(() => vi.useFakeTimers())
    afterEach(() => vi.useRealTimers())

    it('does not schedule any transition if getText() is unchanged', () => {
      useAccountMock.mockReturnValue({ isConnected: true } as any)
      useNFTStoreMock.mockReturnValue({
        hasNFT: true,
        hasUsedTokenGate: false,
        isLoading: false,
      } as any)
      const setTimeoutSpy = vi.spyOn(global, 'setTimeout')
      const { rerender } = renderWithWagmi(<TokenStatus />)

      setTimeoutSpy.mockClear()
      rerender(<TokenStatus />)
      act(() => vi.advanceTimersByTime(1000))

      expect(setTimeoutSpy).not.toHaveBeenCalled()
      const heading = screen.getByText('You have an unused key!')
      expect(heading.className).not.toMatch(/transitioning/)
    })
  })

  describe('ARIA & CSS classes', () => {
    it('has correct ARIA attributes and CSS-module classes', async () => {
      useAccountMock.mockReturnValue({ isConnected: true } as any)
      useNFTStoreMock.mockReturnValue({
        hasNFT: false,
        hasUsedTokenGate: false,
        isLoading: false,
      } as any)

      renderWithWagmi(<TokenStatus />)

      const container = screen.getByRole('status')
      expect(container).toHaveAttribute('role', 'status')
      expect(container).toHaveAttribute('aria-live', 'polite')
      expect(container).toHaveAttribute('aria-atomic', 'true')
      expect(container.className).toMatch(/container/)

      const heading = await screen.findByRole('heading')
      expect(heading.tagName).toBe('H1')
      expect(heading.className).toMatch(/text/)
      expect(heading.className).not.toMatch(/transitioning/)
    })
  })

  describe('rapid consecutive updates', () => {
    it('ultimately shows only the latest text after quick successive state changes', () => {
      vi.useFakeTimers()
      useAccountMock.mockReturnValue({ isConnected: true } as any)
      useNFTStoreMock.mockReturnValue({
        hasNFT: false,
        hasUsedTokenGate: false,
        isLoading: false,
      } as any)
      const { rerender } = renderWithWagmi(<TokenStatus />)

      useNFTStoreMock.mockReturnValue({
        hasNFT: true,
        hasUsedTokenGate: false,
        isLoading: false,
      } as any)
      rerender(<TokenStatus />)

      useNFTStoreMock.mockReturnValue({
        hasNFT: true,
        hasUsedTokenGate: true,
        isLoading: false,
      } as any)
      rerender(<TokenStatus />)

      act(() => vi.advanceTimersByTime(1000))

      const finalText = 'You have a used key...'
      const heading = screen.getByText(finalText)
      expect(heading).toBeInTheDocument()
      expect(heading.className).not.toMatch(/transitioning/)
      vi.useRealTimers()
    })
  })
})

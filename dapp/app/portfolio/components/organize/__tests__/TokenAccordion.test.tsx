// app/portfolio/components/organize/__tests__/TokenAccordion.test.tsx
import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TokenAccordion } from '../TokenAccordion'

// Stub the TokenAccordionContent from the assets folder
vi.mock('../../assets/TokenAccordionContent', () => ({
  __esModule: true,
  default: () => <div data-testid="token-accordion-content" />,
}))

// Mock useAssets hook
vi.mock('@hooks/useAssets', () => ({
  useAssets: () => ({
    assets: [],
    totalCount: 0,
    isLoading: false,
    isError: false,
    error: null,
    fetchNextPage: vi.fn(),
    hasNextPage: false,
    isFetchingNextPage: false,
    refetch: vi.fn(),
    prefetch: vi.fn(),
    clearCache: vi.fn(),
  }),
}))

// Test wrapper with QueryClient
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  })
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe('TokenAccordion', () => {
  it('renders a trigger for each tokenType', () => {
    const Wrapper = createWrapper()
    render(
      <TokenAccordion
        chainId={1}
        tokenTypes={['ERC-20', 'ERC-721']}
        address="0x0"
      />,
      { wrapper: Wrapper }
    )

    // Now matching partial accessible names (which include “collapsed”/“expanded”)
    expect(
      screen.getByRole('button', { name: /ERC-20/ })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /ERC-721/ })
    ).toBeInTheDocument()
  })

  it('toggles content mount/unmount when trigger is clicked', async () => {
    const user = userEvent.setup()
    const Wrapper = createWrapper()

    render(
      <TokenAccordion
        chainId={1}
        tokenTypes={['ERC-1155']}
        address="0x0"
      />,
      { wrapper: Wrapper }
    )

    // Initially, no content
    expect(
      screen.queryByTestId('token-accordion-content')
    ).toBeNull()

    // Open accordion
    await user.click(
      screen.getByRole('button', { name: /ERC-1155/ })
    )
    expect(
      screen.getByTestId('token-accordion-content')
    ).toBeInTheDocument()

    // Close accordion
    await user.click(
      screen.getByRole('button', { name: /ERC-1155/ })
    )
    await waitFor(() => {
      expect(
        screen.queryByTestId('token-accordion-content')
      ).toBeNull()
    })
  })
})

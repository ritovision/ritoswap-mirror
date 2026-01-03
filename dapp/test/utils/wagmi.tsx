import React from 'react'
import { WagmiProvider } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createConfig, http } from 'wagmi'
import { mainnet, sepolia } from 'wagmi/chains'
import { mock } from '@wagmi/connectors'
import type { Chain } from 'viem'

// Create a test config with mock connector
export function createTestConfig(chains: readonly [Chain, ...Chain[]] = [mainnet]) {
  return createConfig({
    chains,
    connectors: [
      mock({
        accounts: [
          '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
          '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
        ],
      }),
    ],
    transports: chains.reduce((acc, chain) => {
      acc[chain.id] = http()
      return acc
    }, {} as any),
  })
}

// Test wrapper component that includes all providers
export function TestWrapper({ 
  children,
  config = createTestConfig(),
}: { 
  children: React.ReactNode
  config?: ReturnType<typeof createTestConfig>
}) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  )
}

// Helper to render with wagmi context
export function renderWithWagmi(
  ui: React.ReactElement,
  options?: {
    chains?: readonly [Chain, ...Chain[]]
  }
) {
  const config = createTestConfig(options?.chains)
  
  return {
    ...render(ui, {
      wrapper: ({ children }: { children: React.ReactNode }) => (
        <TestWrapper config={config}>{children}</TestWrapper>
      ),
    }),
    config,
  }
}

// Re-export testing library functions for convenience
export * from '@testing-library/react'
import { render } from '@testing-library/react'
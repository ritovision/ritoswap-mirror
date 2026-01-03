// app/portfolio/PortfolioClient.tsx
'use client'

import React, { useState } from 'react'
import {
  ChainInfoProvider,
  useChainInfo,
} from '@/components/providers/ChainInfoProvider'
import SelectAccount from './components/selection/SelectAccount'
import SelectChain from './components/selection/SelectChain'
import SelectToken, { TokenType } from './components/selection/SelectToken'
import ChainWrapper, { ChainData } from './components/organize/ChainWrapper'
import styles from './page.module.css'
import InlineErrorBoundary from '@/components/errors/InlineErrorBoundary'

interface ContentProps {
  selectedAccount: string
  onAccountChange: (addr: string) => void
  selectedChains: number[]
  onChainsChange: (ids: number[]) => void
  selectedTokens: TokenType[]
  onTokensChange: (tokens: TokenType[]) => void
}

export default function PortfolioClient() {
  const [selectedAccount, setSelectedAccount] = useState<string>('')
  const [selectedChains, setSelectedChains] = useState<number[]>([])
  const [selectedTokens, setSelectedTokens] = useState<TokenType[]>([])

  return (
    <ChainInfoProvider>
      <Content
        selectedAccount={selectedAccount}
        onAccountChange={setSelectedAccount}
        selectedChains={selectedChains}
        onChainsChange={setSelectedChains}
        selectedTokens={selectedTokens}
        onTokensChange={setSelectedTokens}
      />
    </ChainInfoProvider>
  )
}

/**
 * Exported so you can unit-test the pure mapping logic:
 * turns selectedChains + selectedTokens → ChainData[]
 */
export function Content({
  selectedAccount,
  onAccountChange,
  selectedChains,
  onChainsChange,
  selectedTokens,
  onTokensChange,
}: ContentProps) {
  const { getChainDisplayName } = useChainInfo()

  const chainData: ChainData[] = selectedChains.map((id: number) => ({
    chainId: id,
    chainName: getChainDisplayName(id),
    tokens: selectedTokens,
  }))

  return (
    <>
      <div className={styles.AccountContainer}>
        <InlineErrorBoundary
          component="portfolio-select-account"
          title="Account selector unavailable"
        >
          <SelectAccount onAccountChange={onAccountChange} />
        </InlineErrorBoundary>
      </div>
      <div className={styles.SelectionContainer}>
        <InlineErrorBoundary
          component="portfolio-select-chain"
          title="Chain selection unavailable"
        >
          <SelectChain onSelectionChange={onChainsChange} />
        </InlineErrorBoundary>
        <InlineErrorBoundary
          component="portfolio-select-token"
          title="Token selection unavailable"
        >
          <SelectToken onSelectionChange={onTokensChange} />
        </InlineErrorBoundary>
      </div>
      <div className={styles.ChainContainer}>
        <ChainWrapper chains={chainData} address={selectedAccount} />
      </div>
    </>
  )
}

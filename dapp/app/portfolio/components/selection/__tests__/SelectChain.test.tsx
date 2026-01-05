// app/portfolio/components/selection/__tests__/SelectChain.test.tsx
// @ts-nocheck
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'

import SelectChain from '../SelectChain'

// 1) Stub wagmi useConfig to supply two chains
vi.mock('wagmi', () => ({
  useConfig: vi.fn().mockReturnValue({
    chains: [
      { id: 1, name: 'Chain1' },
      { id: 2, name: 'Chain2' },
    ],
  }),
}))

// 2) Stub your new ChainInfoProvider hook
vi.mock('@/components/providers/ChainInfoProvider', () => ({
  useChainInfo: () => ({
    getChainLogoUrl:       (id: number) => `logo-${id}.png`,
    getFallbackLogoUrl:    () => 'fallback.png',
    getChainDisplayName:   (id: number) => `Name${id}`,
  }),
}))

describe('SelectChain', () => {
  it('renders chains and toggles selection with callback', () => {
    const onSelectionChange = vi.fn()
    render(<SelectChain onSelectionChange={onSelectionChange} />)

    // the component fires one initial onSelectionChange([]) on mount
    expect(onSelectionChange).toHaveBeenCalledWith([])

    // Both chain logos should render with the correct alt text
    const img1 = screen.getByAltText('Name1 logo')
    const img2 = screen.getByAltText('Name2 logo')
    expect(img1).toBeInTheDocument()
    expect(img2).toBeInTheDocument()

    // Click the first chain to select it
    fireEvent.click(img1.closest('div')!)
    expect(onSelectionChange).toHaveBeenLastCalledWith([1])

    // Click it again to un-select
    fireEvent.click(img1.closest('div')!)
    expect(onSelectionChange).toHaveBeenLastCalledWith([])
  })
})

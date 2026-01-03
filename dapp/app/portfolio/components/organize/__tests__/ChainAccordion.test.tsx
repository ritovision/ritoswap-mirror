// __tests__/ChainAccordion.test.tsx
import React from 'react'
import { render, screen } from '@testing-library/react'
import ChainAccordion from '../ChainAccordion'

// 1) Stub BigAccordion to capture its props
let lastBigAccordionProps: any
vi.mock('@/components/utilities/accordions/BigAccordion', () => ({
  BigAccordion: (props: any) => {
    lastBigAccordionProps = props
    return <div data-testid="big-accordion" />
  },
}))

// 2) Stub the new ChainInfoProvider hook
vi.mock('@/components/providers/ChainInfoProvider', () => ({
  useChainInfo: () => ({
    getChainLogoUrl: (id: number) => `logo-${id}.png`,
  }),
}))

// 3) Stub NativeBalance & TokenAccordion
vi.mock('../../assets/NativeBalance', () => ({
  __esModule: true,
  default: () => <div data-testid="native-balance" />,
}))
vi.mock('../TokenAccordion', () => ({
  __esModule: true,
  TokenAccordion: () => <div data-testid="token-accordion" />,
}))

describe('ChainAccordion', () => {
  afterEach(() => {
    lastBigAccordionProps = undefined
    vi.clearAllMocks()
  })

  it('renders BigAccordion with correct title, value & content', () => {
    render(
      <ChainAccordion
        chainId={5}
        chainName="TestChain"
        tokens={['ERC-20']}
        address="0x123"
      />
    )

    // BigAccordion stub should be rendered
    expect(screen.getByTestId('big-accordion')).toBeInTheDocument()
    expect(lastBigAccordionProps).toBeDefined()

    // items array
    const items = lastBigAccordionProps.items
    expect(items).toHaveLength(1)
    const item = items[0]
    expect(item.value).toBe('5')

    // title is a React element—we can render it separately
    const { container: titleContainer } = render(item.title)
    const img = titleContainer.querySelector('img')!
    expect(img).toHaveAttribute('src', 'logo-5.png')
    expect(screen.getByText('TestChain')).toBeInTheDocument()

    // content includes our stubs
    const { container: contentContainer } = render(item.content)
    expect(
      contentContainer.querySelector('[data-testid="native-balance"]')
    ).toBeInTheDocument()
    expect(
      contentContainer.querySelector('[data-testid="token-accordion"]')
    ).toBeInTheDocument()
  })
})

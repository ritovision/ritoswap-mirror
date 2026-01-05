import React from 'react'
import { render, screen, act, cleanup } from '@testing-library/react'

// ---- Mocks ----

// Mock CSS Modules so classnames are stable and assertable
vi.mock('../page.module.css', () => ({
  default: {
    widgetSpacer: 'widgetSpacer',
    widgetWrapper: 'widgetWrapper',
    widgetContainer: 'widgetContainer',
    widgetLoaded: 'widgetLoaded',
    widgetContent: 'widgetContent',
    widgetContentVisible: 'widgetContentVisible',
    caption: 'caption',
    captionVisible: 'captionVisible',
  },
}))

// Capture props passed to the LiFiWidget
const lifiWidgetMock = vi.fn((props: any) =>
  React.createElement('div', {
    'data-testid': 'lifi-widget',
    'data-props': JSON.stringify(props),
  })
)

// Mock @lifi/widget with a simple function component
vi.mock('@lifi/widget', async () => {
  const React = await import('react')
  return {
    LiFiWidget: (props: any) => React.createElement(lifiWidgetMock as any, props),
  }
})

// Mock wagmi.useAccount; we’ll customize per test
const useAccountMock = vi.fn()
vi.mock('wagmi', () => ({
  useAccount: () => useAccountMock(),
}))

// Import the component AFTER mocks are set up
import SwapClient from './SwapClient'

// ---- Helpers ----
const advance = async (ms: number) => {
  await act(() => {
    vi.advanceTimersByTime(ms)
  })
}

beforeEach(() => {
  vi.useFakeTimers()
  lifiWidgetMock.mockClear()
  useAccountMock.mockReset()
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('SwapClient', () => {
  it('renders LiFiWidget and passes expected props', () => {
    useAccountMock.mockReturnValue({ address: undefined, isConnected: false })
    const { container } = render(<SwapClient />)

    const widget = screen.getByTestId('lifi-widget')
    expect(widget).toBeInTheDocument()

    expect(lifiWidgetMock).toHaveBeenCalledTimes(1)
    const firstCallProps = lifiWidgetMock.mock.calls[0][0]

    expect(firstCallProps.integrator).toBe('RitoSwap')
    expect(firstCallProps.config).toBeTruthy()
    expect(firstCallProps.config.integrator).toBe('RitoSwap')
    expect(firstCallProps.config.appearance).toBe('dark')
    expect(firstCallProps.config.variant).toBe('wide')
    expect(firstCallProps.config.theme?.palette?.mode).toBe('dark')

    const containerDiv = container.querySelector('.widgetContainer')
    const contentDiv = container.querySelector('.widgetContent')
    const captionDiv = container.querySelector('.caption')

    expect(containerDiv?.className).toContain('widgetContainer')
    expect(containerDiv?.className).not.toContain('widgetLoaded')
    expect(contentDiv?.className).toContain('widgetContent')
    expect(contentDiv?.className).not.toContain('widgetContentVisible')
    expect(captionDiv?.className).toContain('caption')
    expect(captionDiv?.className).not.toContain('captionVisible')
  })

  it('shows the disconnected caption by default', () => {
    useAccountMock.mockReturnValue({ address: undefined, isConnected: false })
    render(<SwapClient />)
    expect(
      screen.getByText('We receive no fees, profits or benefits from any swaps')
    ).toBeInTheDocument()
  })

  it('shows connected caption with truncated address', () => {
    useAccountMock.mockReturnValue({
      address: '0x1234567890abcdef1234567890abcdef12345678',
      isConnected: true,
    })
    render(<SwapClient />)
    expect(screen.getByText('Connected: 0x1234...5678')).toBeInTheDocument()
  })

  it('applies "loaded" classes after 1s', async () => {
    useAccountMock.mockReturnValue({ address: undefined, isConnected: false })
    const { container } = render(<SwapClient />)

    const containerDiv = container.querySelector('.widgetContainer')
    const contentDiv = container.querySelector('.widgetContent')
    const captionDiv = container.querySelector('.caption')

    expect(containerDiv?.className).not.toContain('widgetLoaded')
    expect(contentDiv?.className).not.toContain('widgetContentVisible')
    expect(captionDiv?.className).not.toContain('captionVisible')

    await advance(1000)

    expect(containerDiv?.className).toContain('widgetLoaded')
    expect(contentDiv?.className).toContain('widgetContentVisible')
    expect(captionDiv?.className).toContain('captionVisible')
  })
})

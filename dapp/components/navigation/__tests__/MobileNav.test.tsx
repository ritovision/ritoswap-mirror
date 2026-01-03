// File: components/navigation/__tests__/MobileNav.test.tsx
import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// Stub out framer-motion’s motion.div
vi.mock('framer-motion', () => ({
  motion: { div: ({ children, ...props }: any) => <div {...props}>{children}</div> },
}))

// Stub the MenuLinks component
vi.mock('../menuLinks/MenuLinks', () => ({
  __esModule: true,
  default: ({ onClick }: { onClick: () => void }) => (
    <button data-testid="menu-links" onClick={onClick}>
      MENU LINKS
    </button>
  ),
}))

import MobileNav from '../mobileNav/MobileNav'

describe('<MobileNav />', () => {
  it('renders a motion-container with MenuLinks and calls onClose when its button is clicked', async () => {
    const onClose = vi.fn()
    render(<MobileNav innerRef={React.createRef()} onClose={onClose} />)

    // our stubbed MenuLinks should render a button with data-testid="menu-links"
    const btn = screen.getByTestId('menu-links')
    expect(btn).toBeInTheDocument()

    // clicking it should forward the onClose callback
    await userEvent.click(btn)
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

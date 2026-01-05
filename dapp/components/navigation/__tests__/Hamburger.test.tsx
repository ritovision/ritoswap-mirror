// components/navigation/__tests__/Hamburger.test.tsx
import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// Improved framer-motion mock: omit non-DOM props
vi.mock('framer-motion', () => {
  const React = require('react')
  /** motion.div mock strips out motion props before spreading to <div> */
  function MotionDiv({ children, ...props }: any) {
    // remove motion-specific props
    const { initial, animate, exit, transition, ...domProps } = props
    return <div {...domProps}>{children}</div>
  }
  /** AnimatePresence mock strips out initial/mode before rendering children */
  function AnimatePresence({ children, ...props }: any) {
    const { initial, mode, ...domProps } = props
    // you can choose to render a <div> or a fragment
    return <div {...domProps}>{children}</div>
  }
  return {
    motion: { div: MotionDiv },
    AnimatePresence,
  }
})

// Stub out the MobileNav component
vi.mock(
  '../mobileNav/MobileNav',
  () => ({
    __esModule: true,
    default: ({ onClose }: { onClose: () => void }) => (
      <button data-testid="mobile-nav" onClick={onClose}>
        MOBILE NAV
      </button>
    ),
  }),
)

import Hamburger from '../mobileNav/Hamburger'

describe('<Hamburger />', () => {
  it('toggles the menu on click & closes on MOBILE NAV click', async () => {
    const { container } = render(<Hamburger />)

    // Initially hidden
    expect(screen.queryByTestId('mobile-nav')).toBeNull()

    // Click to open
    const toggleDiv = container.querySelector('div')
    await userEvent.click(toggleDiv!)

    // Now visible
    expect(screen.getByTestId('mobile-nav')).toBeInTheDocument()

    // Click to close
    await userEvent.click(screen.getByTestId('mobile-nav'))
    expect(screen.queryByTestId('mobile-nav')).toBeNull()
  })
})

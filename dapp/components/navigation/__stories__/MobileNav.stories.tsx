import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';

import MobileNav from '../mobileNav/MobileNav';
import TopNav from '../topNav/TopNav';
import Hamburger from '../mobileNav/Hamburger';

function PreventNavigation({ children }: { children: React.ReactNode }) {
  return (
    <div
      onClickCapture={(e) => {
        const target = e.target as HTMLElement | null;
        const anchor = target?.closest?.('a');
        if (!anchor) return;
        e.preventDefault();
      }}
    >
      {children}
    </div>
  );
}

function AlwaysOnHarness() {
  const innerRef = React.useRef<HTMLDivElement>(null);
  return (
    <PreventNavigation>
      <div style={{ minHeight: '100vh', padding: 24, background: '#0b0b0b', color: 'white' }}>
        <div style={{ opacity: 0.8, marginBottom: 16 }}>
          Always-on MobileNav (navigation is prevented in Storybook).
        </div>
        <MobileNav innerRef={innerRef} onClose={() => {}} />
      </div>
    </PreventNavigation>
  );
}

function InTopNavHarness() {
  return (
    <PreventNavigation>
      <div style={{ minHeight: '100vh', background: '#0b0b0b', color: 'white' }}>
        <TopNav />
        <Hamburger />
        <main style={{ padding: 24 }}>
          <h2 style={{ marginTop: 0 }}>Resize Hint</h2>
          <p style={{ opacity: 0.85 }}>
            At 730px wide or less you should see the mobile hamburger. Click it to open the menu.
          </p>
          <p style={{ opacity: 0.7 }}>
            (Storybook can’t force viewport width in this repo yet—just resize the canvas/browser.)
          </p>
        </main>
      </div>
    </PreventNavigation>
  );
}

const meta: Meta = {
  title: 'Navigation/MobileNav',
  parameters: {
    layout: 'fullscreen',
    mockWallet: {
      includeWalletConnect: false,
    },
  },
};

export default meta;
type Story = StoryObj;

export const AlwaysOn: Story = {
  render: () => <AlwaysOnHarness />,
};

export const InTopNav: Story = {
  render: () => <InTopNavHarness />,
};

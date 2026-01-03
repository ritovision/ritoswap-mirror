import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';

import { RateLimitModalProvider, showRateLimitModal } from '../RateLimitModal';

type StoryControls = {
  limit?: number;
  remaining?: number;
  retryAfter?: number;
  autoDismiss?: boolean;
};

const themeVars = {
  '--primary-color': '#2563eb',
  '--default-border': '1px solid rgba(255, 255, 255, 0.25)',
  '--font-primary': 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
} as React.CSSProperties;

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', background: '#0b1220', ...themeVars }}>
      {children}
    </div>
  );
}

function showFromArgs({ limit = 10, remaining = 0, retryAfter = 60, autoDismiss = false }: StoryControls) {
  showRateLimitModal({ limit, remaining, retryAfter, autoDismiss });
}

function AlwaysOpenHarness(args: StoryControls) {
  React.useEffect(() => {
    const id = window.setTimeout(() => showFromArgs(args), 0);
    return () => window.clearTimeout(id);
  }, [args, args.limit, args.remaining, args.retryAfter, args.autoDismiss]);

  return (
    <Frame>
      <RateLimitModalProvider>
        <div />
      </RateLimitModalProvider>
    </Frame>
  );
}

function ClickToOpenHarness(args: StoryControls) {
  return (
    <Frame>
      <RateLimitModalProvider>
        <div style={{ padding: 16 }}>
          <button type="button" onClick={() => showFromArgs(args)}>
            Trigger rate limit modal
          </button>
        </div>
      </RateLimitModalProvider>
    </Frame>
  );
}

const meta: Meta<StoryControls> = {
  title: 'Utilities/RateLimitModal',
  parameters: {
    layout: 'fullscreen',
  },
  args: {
    limit: 10,
    remaining: 0,
    retryAfter: 60,
    autoDismiss: false,
  },
  argTypes: {
    limit: { control: 'number' },
    remaining: { control: 'number' },
    retryAfter: { control: 'number' },
    autoDismiss: { control: 'boolean' },
  },
};

export default meta;
type Story = StoryObj<StoryControls>;

export const AlwaysOpen: Story = {
  render: (args) => <AlwaysOpenHarness {...args} />,
};

export const ClickToOpen: Story = {
  render: (args) => <ClickToOpenHarness {...args} />,
};

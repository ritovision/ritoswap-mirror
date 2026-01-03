import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';

import NetworkStatusProvider from '../NetworkStatusProvider';

const themeVars = {
  '--primary-color': '#012035',
  '--secondary-color': '#04426C',
  '--accent-color': '#FC1819',
  '--foreground': '#ffffff',
  '--default-border': '2px solid var(--secondary-color)',
  '--font-primary': 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
} as React.CSSProperties;

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--primary-color)', color: 'var(--foreground)', ...themeVars }}>
      <div style={{ padding: 16 }}>
        <div style={{ marginBottom: 16, border: 'var(--default-border)', borderRadius: 12, padding: 16 }}>
          <div style={{ fontFamily: 'var(--font-primary)' }}>Underlying app content</div>
          <div style={{ opacity: 0.75, marginTop: 8, fontFamily: 'var(--font-primary)' }}>
            This area is here so the offline overlay blur/backdrop matches how it looks in the real app.
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}

function AlwaysOpenHarness() {
  React.useEffect(() => {
    (window as any).__RITOSWAP_OFFLINE_OVERRIDE__ = true;
    window.dispatchEvent(new Event('offline'));
    return () => {
      delete (window as any).__RITOSWAP_OFFLINE_OVERRIDE__;
      window.dispatchEvent(new Event('online'));
    };
  }, []);

  return (
    <Frame>
      <NetworkStatusProvider>
        <div />
      </NetworkStatusProvider>
    </Frame>
  );
}

const meta: Meta = {
  title: 'Utilities/OfflineModal',
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj;

export const AlwaysOpen: Story = {
  render: () => <AlwaysOpenHarness />,
};

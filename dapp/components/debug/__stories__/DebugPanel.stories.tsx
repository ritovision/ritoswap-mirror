import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';

import DebugPanel from '../DebugPanel';

type StoryControls = {
  online?: boolean;
  stateWorkerUrl?: boolean;
  stateWorkerApiKey?: boolean;
  nonceResponse?: string;
};

function createJsonResponse(body: unknown, init?: { status?: number }) {
  const status = init?.status ?? 200;
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return body;
    },
  } as unknown as Response;
}

function Harness({
  online = true,
  stateWorkerUrl = true,
  stateWorkerApiKey = false,
  nonceResponse = 'test-nonce',
}: StoryControls) {
  React.useEffect(() => {
    const originalFetch = window.fetch.bind(window);
    const originalOnLine = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(navigator), 'onLine');

    try {
      Object.defineProperty(Object.getPrototypeOf(navigator), 'onLine', {
        configurable: true,
        get: () => online,
      });
      window.dispatchEvent(new Event(online ? 'online' : 'offline'));
    } catch {
      // ignore (some browsers make navigator.onLine non-configurable)
    }

    window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as Request).url;

      if (url.endsWith('/api/debug/status')) {
        return createJsonResponse({ stateWorkerUrl, stateWorkerApiKey });
      }

      if (url.endsWith('/api/nonce')) {
        return createJsonResponse({ nonce: nonceResponse });
      }

      if (url.includes('/api/token-status/')) {
        return createJsonResponse({ tokenId: 1, gated: false });
      }

      if (url.endsWith('/api/gate-access') && (init?.method ?? 'GET') === 'POST') {
        return createJsonResponse({ ok: true, access: false });
      }

      if (url.endsWith('/api/verify-token-gate') && (init?.method ?? 'GET') === 'POST') {
        return createJsonResponse({ ok: true, verified: false });
      }

      return originalFetch(input as any, init);
    }) as typeof window.fetch;

    return () => {
      window.fetch = originalFetch;
      try {
        if (originalOnLine) {
          Object.defineProperty(Object.getPrototypeOf(navigator), 'onLine', originalOnLine);
        }
      } catch {
        // ignore
      }
    };
  }, [online, stateWorkerUrl, stateWorkerApiKey, nonceResponse]);

  return (
    <div
      style={{
        minHeight: '100vh',
        padding: 24,
        background: '#0b0b0b',
        color: 'white',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <p style={{ maxWidth: 720, opacity: 0.85 }}>
        DebugPanel only renders when `publicConfig.isDevelopment` is true. Use Controls to simulate online/offline and
        stubbed API responses; wallet connection is controlled by global Storybook wallet args.
      </p>
      <DebugPanel forceVisible />
    </div>
  );
}

const meta: Meta<typeof Harness> = {
  title: 'Debug/DebugPanel',
  component: Harness,
  parameters: {
    layout: 'fullscreen',
  },
  args: {
    online: true,
    stateWorkerUrl: true,
    stateWorkerApiKey: false,
    nonceResponse: 'test-nonce',
  },
  argTypes: {
    online: { control: 'boolean', table: { category: 'Network' } },
    stateWorkerUrl: { control: 'boolean', table: { category: 'Server Status' } },
    stateWorkerApiKey: { control: 'boolean', table: { category: 'Server Status' } },
    nonceResponse: { control: 'text', table: { category: 'API' } },
  },
};

export default meta;
type Story = StoryObj<typeof Harness>;

export const Playground: Story = {
  render: (args) => <Harness {...args} />,
};

import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';

import InlineErrorBoundary from '../InlineErrorBoundary';

function ThrowingWidget(): React.ReactElement {
  throw new Error('Storybook demo error');
}

function Harness() {
  return (
    <div
      style={{
        minHeight: '100vh',
        padding: 24,
        background: '#010a12',
        display: 'grid',
        placeItems: 'center',
      }}
    >
      <div style={{ width: 720, maxWidth: '100%' }}>
        <InlineErrorBoundary
          component="storybook-inline-boundary"
          title="Module unavailable"
          message="Please refresh and try again."
        >
          <ThrowingWidget />
        </InlineErrorBoundary>
      </div>
    </div>
  );
}

const meta: Meta<typeof Harness> = {
  title: 'Errors/InlineErrorBoundary',
  component: Harness,
  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;
type Story = StoryObj<typeof Harness>;

export const Default: Story = {
  render: () => <Harness />,
};

import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';

import Placeholder from '../organize/Placeholder';

function Harness() {
  return (
    <div
      style={{
        minHeight: '100vh',
        padding: 24,
        background: '#012035',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Placeholder />
    </div>
  );
}

const meta: Meta<typeof Harness> = {
  title: 'Portfolio/Organize/Placeholder',
  component: Harness,
  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;
type Story = StoryObj<typeof Harness>;

export const Default: Story = {};


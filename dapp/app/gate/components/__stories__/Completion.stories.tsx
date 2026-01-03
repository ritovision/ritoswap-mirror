import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';

import Completion from '../Completion/Completion';

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
      <Completion />
    </div>
  );
}

const meta: Meta<typeof Harness> = {
  title: 'Gate/Completion',
  component: Harness,
  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;
type Story = StoryObj<typeof Harness>;

export const Default: Story = {};


import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';

import SelectChain from '../selection/SelectChain';
import {
  portfolioChainToggleArgTypes,
  portfolioChainToggleDefaults,
} from '@/.storybook/mocks/portfolio';

type StoryArgs = typeof portfolioChainToggleDefaults;

function Harness(_args: StoryArgs) {
  const [selected, setSelected] = React.useState<number[]>([]);

  return (
    <div style={{ minHeight: '100vh', padding: 24, background: '#012035', color: 'white' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <SelectChain onSelectionChange={setSelected} />
        <div style={{ marginTop: 12, opacity: 0.85, fontSize: 14 }}>
          Selected chain IDs: {selected.length ? selected.join(', ') : '(none)'}
        </div>
      </div>
    </div>
  );
}

const meta: Meta<typeof Harness> = {
  title: 'Portfolio/Selection/SelectChain',
  component: Harness,
  parameters: {
    layout: 'fullscreen',
  },
  args: {
    ...portfolioChainToggleDefaults,
  },
  argTypes: {
    ...portfolioChainToggleArgTypes,
  },
};

export default meta;
type Story = StoryObj<typeof Harness>;

export const Playground: Story = {};


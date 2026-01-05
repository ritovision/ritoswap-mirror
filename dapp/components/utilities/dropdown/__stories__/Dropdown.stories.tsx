import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';

import Dropdown from '../Dropdown';
import type { DropdownState } from '../Dropdown';

const DEFAULT_ITEMS = ['Option One', 'Option Two', 'Option Three', 'Option Four'];

type StoryControls = {
  label?: string;
  state?: DropdownState;
  initialValue?: string;
  items?: string[];
};

function Harness({
  label = 'Pick a preset',
  state = 'pre',
  initialValue,
  items = DEFAULT_ITEMS,
}: StoryControls) {
  const [value, setValue] = React.useState(initialValue ?? '');

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 32,
        background: '#010f1f',
        color: '#fff',
      }}
    >
      <div style={{ width: 260 }}>
        <Dropdown
          label={label}
          items={items}
          state={state}
          selectedValue={value}
          onChange={(val) => setValue(val)}
        />
        <p style={{ marginTop: 16, fontSize: 14 }}>
          Selected: <strong>{value || 'none'}</strong>
        </p>
      </div>
    </div>
  );
}

const meta: Meta<typeof Harness> = {
  title: 'Utilities/Dropdown',
  component: Harness,
  parameters: { layout: 'fullscreen' },
  args: {
    label: 'Pick a preset',
    state: 'pre',
    initialValue: '',
    items: DEFAULT_ITEMS,
  },
  argTypes: {
    label: { control: 'text' },
    state: {
      control: { type: 'radio' },
      options: ['pre', 'valid', 'invalid', 'disabled'],
    },
    initialValue: { control: 'text' },
    items: { control: 'object' },
  },
};

export default meta;
type Story = StoryObj<typeof Harness>;

export const Playground: Story = {};

export const TwoOptions: Story = {
  args: { items: ['Alpha', 'Beta'] },
};

export const EightOptions: Story = {
  args: {
    items: [
      'Alpha',
      'Beta',
      'Gamma',
      'Delta',
      'Epsilon',
      'Zeta',
      'Eta',
      'Theta',
    ],
  },
};

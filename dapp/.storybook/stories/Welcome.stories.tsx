import type { Meta, StoryObj } from '@storybook/react';

const meta: Meta = {
  title: 'Sandbox/Welcome',
  parameters: {
    layout: 'centered',
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Basics: Story = {
  render: () => (
    <div style={{ maxWidth: 720 }}>
      <h1>RitoSwap Storybook</h1>
      <p>
        Welcome to Ritoswap's Storybook.
        <br /><br />
        This is a mock-only Storybook setup intended for portable docs builds. Global styles and fonts should be applied
        here.
      </p>
    </div>
  ),
};


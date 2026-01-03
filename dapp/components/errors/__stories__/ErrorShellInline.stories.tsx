import type { Meta, StoryObj } from '@storybook/react';

import ErrorShellInline from '../ErrorShellInline';

const meta: Meta<typeof ErrorShellInline> = {
  title: 'Errors/ErrorShellInline',
  component: ErrorShellInline,
  parameters: {
    layout: 'centered',
  },
  args: {
    title: 'Something went wrong',
    message: 'Please try again.',
  },
};

export default meta;
type Story = StoryObj<typeof ErrorShellInline>;

export const Default: Story = {};

export const WithRetry: Story = {
  args: {
    onRetry: () => {
      console.log('Retry clicked');
    },
  },
};

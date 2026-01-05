import type { Meta, StoryObj } from '@storybook/react';

import ErrorShellFullPage from '../ErrorShellFullPage';

const meta: Meta<typeof ErrorShellFullPage> = {
  title: 'Errors/ErrorShellFullPage',
  component: ErrorShellFullPage,
  parameters: {
    layout: 'fullscreen',
  },
  args: {
    title: 'Oh how the mighty have fallen...',
    message: 'The site is too much for itself. Try again soon.',
  },
};

export default meta;
type Story = StoryObj<typeof ErrorShellFullPage>;

export const Default: Story = {};

export const WithRetry: Story = {
  args: {
    onRetry: () => {
      console.log('Retry clicked');
    },
  },
};

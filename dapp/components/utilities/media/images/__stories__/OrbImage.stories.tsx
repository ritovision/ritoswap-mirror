import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';

import OrbImage from '../OrbImage';

const meta: Meta<typeof OrbImage> = {
  title: 'Utilities/Media/OrbImage',
  component: OrbImage,
  parameters: { layout: 'centered' },
  args: {
    src: '/images/rito/rito-thinker.jpg',
    alt: 'Rito Thinker',
    aspectRatio: '1 / 1',
    radius: 16,
    showOrbs: true,
    sizes: '360px',
  },
  argTypes: {
    src: { control: 'text' },
    alt: { control: 'text' },
    aspectRatio: { control: 'text' },
    radius: { control: 'number' },
    showOrbs: { control: 'boolean' },
    forceLoading: { control: 'boolean' },
  },
};

export default meta;
type Story = StoryObj<typeof OrbImage>;

export const LoadsImage: Story = {
  render: (args) => (
    <div style={{ width: 360 }}>
      <OrbImage {...args} forceLoading={false} />
    </div>
  ),
};

export const OrbsOnly: Story = {
  args: { forceLoading: true },
  render: (args) => (
    <div style={{ width: 360 }}>
      <OrbImage {...args} />
    </div>
  ),
};


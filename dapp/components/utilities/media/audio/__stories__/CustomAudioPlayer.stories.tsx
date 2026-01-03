import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';

import CustomAudioPlayer from '../CustomAudioPlayer';

const meta: Meta<typeof CustomAudioPlayer> = {
  title: 'Utilities/Media/CustomAudioPlayer',
  component: CustomAudioPlayer,
  parameters: { layout: 'centered' },
  args: {
    title: 'Altcoin Love',
    audioSrc: '/audio/Altcoin_Love.mp3',
  },
  argTypes: {
    title: { control: 'text' },
    audioSrc: { control: 'text' },
  },
};

export default meta;
type Story = StoryObj<typeof CustomAudioPlayer>;

export const Default: Story = {
  render: (args) => (
    <div style={{ width: 520 }}>
      <CustomAudioPlayer {...args} />
    </div>
  ),
};

export const Playground: Story = {
  render: (args) => (
    <div style={{ width: 520 }}>
      <CustomAudioPlayer {...args} />
    </div>
  ),
};

export const Compact: Story = {
  render: (args) => (
    <div style={{ width: 300, margin: '0 auto' }}>
      <CustomAudioPlayer {...args} />
    </div>
  ),
};

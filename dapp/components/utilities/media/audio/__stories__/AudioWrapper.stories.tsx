import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';

import AudioWrapper from '../AudioWrapper';

const meta: Meta<typeof AudioWrapper> = {
  title: 'Utilities/Media/AudioWrapper',
  component: AudioWrapper,
  parameters: { layout: 'fullscreen' },
  args: {
    id: 'crypto-music',
    headline: 'Crypto Music',
    imageSrc: '/images/music/altcoin-love-coverart-square.jpg',
    imageAlt: 'Altcoin Love Cover Art',
    description: (
      <>
        An anthemic ode to altcoins by Rito Rhymes <em>California Love</em> style
      </>
    ),
    title: 'Altcoin Love',
    audioSrc: '/audio/Altcoin_Love.mp3',
  },
  argTypes: {
    headline: { control: 'text' },
    imageSrc: { control: 'text' },
    imageAlt: { control: 'text' },
    title: { control: 'text' },
    audioSrc: { control: 'text' },
  },
};

export default meta;
type Story = StoryObj<typeof AudioWrapper>;

export const HomepageSection: Story = {
  render: (args) => <AudioWrapper {...args} />,
};


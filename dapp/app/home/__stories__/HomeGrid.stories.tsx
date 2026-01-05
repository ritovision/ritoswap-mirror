import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';

import HomeGrid, { type HomeGridItem } from '../HomeGrid';

type HomeGridEditableItem = Omit<HomeGridItem, 'title' | 'description'> & {
  title: string;
  description: string;
};

type StoryControls = {
  items: HomeGridEditableItem[];
};

function PreventNavigation({ children }: { children: React.ReactNode }) {
  return (
    <div
      onClickCapture={(e) => {
        const target = e.target as HTMLElement | null;
        const anchor = target?.closest?.('a');
        if (!anchor) return;
        e.preventDefault();
      }}
    >
      {children}
    </div>
  );
}

function Harness({ items }: StoryControls) {
  const resolved: HomeGridItem[] = items.map((item) => ({
    ...item,
    title: item.title,
    description: item.description,
  }));

  return (
    <PreventNavigation>
      <div style={{ minHeight: '100vh', padding: 24, background: '#0b0b0b', color: 'white' }}>
        <div style={{ opacity: 0.8, marginBottom: 16 }}>
          Edit card titles/descriptions in Controls. Navigation is prevented in Storybook.
        </div>
        <HomeGrid items={resolved} />
      </div>
    </PreventNavigation>
  );
}

const meta: Meta<typeof Harness> = {
  title: 'Home/HomeGrid',
  component: Harness,
  parameters: {
    layout: 'fullscreen',
  },
  args: {
    items: [
      {
        id: 1,
        title: 'Trade',
        description: "Swap til your heart's content, across chains even... Rito won't stop you",
        href: '/swap',
        imageSrc: '/images/home/trade.jpg',
      },
      {
        id: 2,
        title: 'Mint',
        description: 'Forge one-of-a-kind collectibles that do more than just collect dust',
        href: '/mint',
        imageSrc: '/images/home/mint.jpg',
      },
      {
        id: 3,
        title: 'Burn',
        description: "Sometimes tokens gotta go. Let 'em burn!",
        href: '/mint',
        imageSrc: '/images/home/burn.jpg',
      },
      {
        id: 4,
        title: 'RapBotRito AI',
        description:
          'Meet the rapping multi-modal agentic chatbot who will rap battle you, create and share images and even interact directly with the blockchain',
        href: '/gate',
        imageSrc: '/images/home/glitchy-rapbotrito.jpg',
      },
      {
        id: 5,
        title: 'Music',
        description: 'Enjoy fire crypto anthems by Rito Rhymes',
        href: '#crypto-music',
        imageSrc: '/images/home/boombox.jpg',
      },
      {
        id: 6,
        title: 'Unlock',
        description:
          'Access an exclusive token-gate with perks like unreleased music, RapBotRito AI and a special form to send a message to Rito',
        href: '/gate',
        imageSrc: '/images/home/unlock.jpg',
      },
    ],
  },
  argTypes: {
    items: { control: 'object', table: { category: 'Content' } },
  },
};

export default meta;
type Story = StoryObj<typeof Harness>;

export const Playground: Story = {};


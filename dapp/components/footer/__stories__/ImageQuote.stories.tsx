import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';

import ImageQuoteClient from '../utilities/imageQuote/ImageQuoteClient';
import { FooterStoryFrame } from './FooterStoryFrame';

import rawPairs from '../utilities/imageQuote/imageTextPairs.json';

type ImageTextPair = { image: string; text: string };
const rawData = rawPairs as ImageTextPair[];
const imageTextPairs = rawData.map(p => ({
  ...p,
  image: p.image.startsWith('/') ? p.image.slice(1) : p.image
}));


type StoryArgs = {
  image: string;
  text: string;
};

function Harness(args: StoryArgs) {
  return <ImageQuoteClient imageTextPairs={[{ image: args.image, text: args.text }]} />;
}

function RerollHarness() {
  const [nonce, setNonce] = React.useState(0);
  const rerollPairs = React.useMemo(() => imageTextPairs.map((pair) => ({ ...pair })), []);

  return (
    <div style={{ display: 'grid', gap: 12, justifyItems: 'center', width: '100%', minWidth: '300px' }}>
      <button
        type="button"
        onClick={() => setNonce((x) => x + 1)}
        style={{
          borderRadius: 999,
          padding: '10px 16px',
          border: '1px solid rgba(255,255,255,0.2)',
          background: 'rgba(255,255,255,0.08)',
          color: 'white',
          cursor: 'pointer',
        }}
      >
        Refresh
      </button>
      <ImageQuoteClient key={nonce} imageTextPairs={rerollPairs} />
    </div>
  );
}

const meta = {
  title: 'Footer/Utilities/ImageQuote',
  component: Harness,
  parameters: { layout: 'centered' },
  args: {
    image: imageTextPairs[0]?.image ?? 'images/utilities/imageQuote/Bitcoin.jpg',
    text: imageTextPairs[0]?.text ?? 'Sample quote',
  },
  argTypes: {
    image: { control: 'select', options: imageTextPairs.map((p) => p.image) },
    text: { control: 'text' },
  },
} satisfies Meta<typeof Harness>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  render: (args) => (
    <FooterStoryFrame width={440}>
      <Harness {...args} />
    </FooterStoryFrame>
  ),
};

export const RandomOnReload: Story = {
  render: () => (
    <FooterStoryFrame width={440}>
      <ImageQuoteClient imageTextPairs={imageTextPairs} />
    </FooterStoryFrame>
  ),
};

export const RerollButton: Story = {
  render: () => (
    <FooterStoryFrame width="100%" padding={12}>
      <RerollHarness />
    </FooterStoryFrame>
  ),
};


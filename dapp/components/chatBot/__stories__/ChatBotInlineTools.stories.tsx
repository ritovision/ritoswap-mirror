import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import type { UIMessage } from 'ai';

import ChatBotHarness, {
  chatBotStoryArgs,
  chatBotStoryArgTypes,
  type ChatBotStoryArgs,
} from '@/.storybook/harnesses/ChatBotHarness';

type StoryArgs = ChatBotStoryArgs;

const meta: Meta<StoryArgs> = {
  title: 'ChatBot/InlineTools',
  parameters: {
    layout: 'fullscreen',
  },
  args: {
    ...chatBotStoryArgs,
  },
  argTypes: {
    ...chatBotStoryArgTypes,
  },
};

export default meta;
type Story = StoryObj<StoryArgs>;

const seededMessages = (text: string, id = 'seeded-assistant'): UIMessage[] => [
  { id: 'system-seed', role: 'system', parts: [{ type: 'text', text: 'storybook-seed' }] },
  { id, role: 'assistant', parts: [{ type: 'text', text }] },
];

export const GifSeeded: Story = {
  render: (args) => (
    <ChatBotHarness
      {...args}
      scenarioId="inlineGif"
      initialMessages={seededMessages(
        'Reaction time:\n<gif src="https://media1.tenor.com/m/mFxdMmWsRikAAAAd/dogecoin-tweet-dogecoin.gif" width="320" alt="Dogecoin tweet" />'
      )}
    />
  ),
};

export const GifInteractive: Story = {
  render: (args) => <ChatBotHarness {...args} scenarioId="inlineGif" />,
};

export const ImageSeeded: Story = {
  render: (args) => (
    <ChatBotHarness
      {...args}
      scenarioId="inlineImage"
      initialMessages={seededMessages(
        'Fresh visual dropped:\n<img src="/images/utilities/imageQuote/Bitcoin.jpg" alt="Bitcoin quote" width="260" height="200" />'
      )}
    />
  ),
};

export const ImageInteractive: Story = {
  render: (args) => <ChatBotHarness {...args} scenarioId="inlineImage" />,
};

export const SvgSeeded: Story = {
  render: (args) => (
    <ChatBotHarness
      {...args}
      scenarioId="inlineSvg"
      initialMessages={seededMessages(
        'SVG flex:\n<svg viewBox="0 0 140 80" width="240" height="120"><rect x="0" y="0" width="140" height="80" fill="#0f172a"/><text x="70" y="45" fill="#38bdf8" text-anchor="middle" font-size="16">Rito SVG</text></svg>'
      )}
    />
  ),
};

export const SvgInteractive: Story = {
  render: (args) => <ChatBotHarness {...args} scenarioId="inlineSvg" />,
};

export const ChainLogoSeeded: Story = {
  render: (args) => (
    <ChatBotHarness
      {...args}
      scenarioId="inlineChainLogo"
      initialMessages={seededMessages('Chain check:\n<chain-logo chainName="Ethereum" size="64" />')}
    />
  ),
};

export const ChainLogoInteractive: Story = {
  render: (args) => <ChatBotHarness {...args} scenarioId="inlineChainLogo" />,
};

export const LinkSeeded: Story = {
  render: (args) => (
    <ChatBotHarness
      {...args}
      initialMessages={seededMessages('Peep the docs: [Rito Swap](https://ritoswap.com)')}
    />
  ),
};

export const LinkInteractive: Story = {
  render: (args) => <ChatBotHarness {...args} scenarioId="inlineLink" />,
};

export const KeyNftSeeded: Story = {
  render: (args) => (
    <ChatBotHarness
      {...args}
      scenarioId="inlineKeyNft"
      initialMessages={seededMessages(
        'Key NFT preview:\n<key-nft bgColor="#0b1220" keyColor="#22d3ee" width="240" height="120" />'
      )}
    />
  ),
};

export const KeyNftInteractive: Story = {
  render: (args) => <ChatBotHarness {...args} scenarioId="inlineKeyNft" />,
};

export const GoodbyeStubbed: Story = {
  render: (args) => (
    <ChatBotHarness {...args} scenarioId="inlineGoodbye" goodbyeMode="stub" />
  ),
};

export const GoodbyeLive: Story = {
  render: (args) => (
    <ChatBotHarness {...args} scenarioId="inlineGoodbye" goodbyeMode="live" />
  ),
};

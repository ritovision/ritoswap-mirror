import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';

import ChatBotHarness, {
  chatBotStoryArgs,
  chatBotStoryArgTypes,
  type ChatBotStoryArgs,
} from '@/.storybook/harnesses/ChatBotHarness';

type StoryArgs = ChatBotStoryArgs;

const meta: Meta<StoryArgs> = {
  title: 'ChatBot/Modals',
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

export const ModeSelect: Story = {
  render: (args) => <ChatBotHarness {...args} activeMode={null} modal="mode" />,
};

export const BattleForm: Story = {
  render: (args) => (
    <ChatBotHarness
      {...args}
      activeMode="freestyle"
      modal="battleForm"
      modalPayload={{ battleMode: 'rapBattle' }}
      battleFormData={{
        user: {
          favoriteBlockchains: 'Ethereum, Base',
          favoriteNftCollection: 'CryptoPunks',
          placeOfOrigin: 'Brooklyn',
          careerJobTitles: 'Solidity dev',
          personalQuirks: 'Always writes bars in hex.',
          thingsToBragAbout: '10x trades, on-chain speed',
          thingsToBeAshamedOf: 'Minted a rug on testnet',
        },
        chatbot: {
          favoriteBlockchains: 'RitoNet',
          favoriteNftCollection: 'Rito Keys',
          placeOfOrigin: 'Cyberspace',
          careerJobTitles: 'Rap general',
          personalQuirks: 'Counts in 16s',
          thingsToBragAbout: 'Infinite flow',
          thingsToBeAshamedOf: 'Uses too many rhymes',
        },
      }}
    />
  ),
};

export const ErrorModal: Story = {
  render: (args) => (
    <ChatBotHarness
      {...args}
      activeMode="freestyle"
      modal="error"
      modalPayload={{
        error: {
          message: 'Something went wrong on the wire.',
          details: 'Mock error: the response stream got cut off.',
        },
      }}
    />
  ),
};

export const ErrorModalJwt: Story = {
  render: (args) => (
    <ChatBotHarness
      {...args}
      activeMode="freestyle"
      modal="error"
      modalPayload={{
        error: {
          message: 'Unauthorized: JWT expired.',
          details: '401: token invalid',
        },
      }}
    />
  ),
};

export const ConfirmReset: Story = {
  render: (args) => (
    <ChatBotHarness {...args} activeMode="freestyle" modal="confirmReset" />
  ),
};


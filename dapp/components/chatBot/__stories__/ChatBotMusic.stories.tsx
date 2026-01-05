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
  title: 'ChatBot/Music',
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

export const PlayerPaused: Story = {
  render: (args) => (
    <ChatBotHarness
      {...args}
      initialMessages={seededMessages(
        'Player is ready:\n<music song="A-Trillie" autoplay="false" action="pause" />'
      )}
    />
  ),
};

export const TriggeredByChat: Story = {
  render: (args) => <ChatBotHarness {...args} scenarioId="inlineMusicPlay" />,
};

export const RandomControls: Story = {
  render: (args) => (
    <ChatBotHarness
      {...args}
      scenarioId="inlineMusicRandom"
      initialMessages={seededMessages(
        'Player is ready:\n<music song="A-Trillie" autoplay="false" action="pause" />'
      )}
    />
  ),
};

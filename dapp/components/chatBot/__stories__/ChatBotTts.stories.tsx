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
  title: 'ChatBot/TTS',
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

const seededMessages: UIMessage[] = [
  { id: 'u1', role: 'user', parts: [{ type: 'text', text: 'Read this out loud.' }] },
  {
    id: 'a1',
    role: 'assistant',
    parts: [
      {
        type: 'text',
        text: 'Click Play Audio to generate a clip. This is a Storybook TTS mock.',
      },
    ],
  },
];

export const TtsPlayback: Story = {
  render: (args) => (
    <ChatBotHarness
      {...args}
      initialMessages={seededMessages}
      ttsMock={{ delayMs: 3000, durationSec: 15 }}
    />
  ),
};

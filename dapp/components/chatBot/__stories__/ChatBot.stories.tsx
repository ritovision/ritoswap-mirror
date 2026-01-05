import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';

import ChatBotHarness, {
  chatBotStoryArgs,
  chatBotStoryArgTypes,
  type ChatBotStoryArgs,
} from '@/.storybook/harnesses/ChatBotHarness';
import { mockChatScenarios } from '@/.storybook/mocks/mockChat';

type StoryArgs = ChatBotStoryArgs;

const slowStreamingText = [
  'Rito taps the wireframe and the stream starts moving: every token arrives in small bursts so the UI can stay responsive while the story builds.',
  '',
  'While the text is still flowing, the client already knows the message id and can stage tool calls, so chips land at the exact anchor instead of popping in late.',
  '',
  'This longer reply is deliberate. Watch the cadence, the pauses, and the paragraph breaks as the stream unfolds before the final token lands.',
].join('\n\n');

const meta: Meta<StoryArgs> = {
  title: 'ChatBot/Playground',
  parameters: {
    layout: 'centered',
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

export const Default: Story = {
  render: (args) => <ChatBotHarness {...args} scenarioId="default" />,
};

export const SlowStreaming: Story = {
  render: (args) => (
    <ChatBotHarness
      {...args}
      scenario={{
        ...mockChatScenarios.default,
        id: 'slow-stream',
        label: 'Slow Streaming Demo',
        description: 'Long-form response for chunked streaming.',
        responses: [{ text: slowStreamingText }],
        repeat: 'last',
        initialDelayMs: 2000,
        chunkDelayMs: 280,
      }}
    />
  ),
};

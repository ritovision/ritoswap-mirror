import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';

import ToolCallChip from '../ToolActivity/ToolCallChip';
import { toolChipFixtures } from './toolChipFixtures';
import type { ToolCallChipData } from '../ToolActivity/ToolCallChip';
import messageStyles from '../ChatMessages/ChatMessages.module.css';

function StoryWrapper({ children, center = false }: { children: React.ReactNode; center?: boolean }) {
  return (
    <div
      style={{
        minHeight: '100vh',
        padding: 24,
        background: '#010a12',
        display: center ? 'flex' : undefined,
        alignItems: center ? 'center' : undefined,
        justifyContent: center ? 'center' : undefined,
      }}
    >
      <div className={`${messageStyles.message} ${messageStyles.assistantMessage}`}>
        <div
          className={messageStyles.messageContent}
          style={{ alignItems: center ? 'center' : undefined }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

function ChipGrid({ chips, center = false }: { chips: ToolCallChipData[]; center?: boolean }) {
  return (
    <StoryWrapper center={center}>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 12,
          maxWidth: 960,
          margin: '0 auto',
          justifyContent: center ? 'center' : 'flex-start',
        }}
      >
        {chips.map((chip) => (
          <ToolCallChip key={`${chip.toolName}-${chip.toolCallId}-${chip.status}`} chip={chip} />
        ))}
      </div>
    </StoryWrapper>
  );
}

const pendingChips = Object.values(toolChipFixtures).map((tool) => tool.pending);
const successChips = Object.values(toolChipFixtures).map((tool) => tool.success);
const errorChips = Object.values(toolChipFixtures).map((tool) => tool.error);
const toolKeys = Object.keys(toolChipFixtures) as Array<keyof typeof toolChipFixtures>;
const statusOptions = ['pending', 'success', 'error'] as const;
const defaultToolKey = (toolKeys[0] ?? 'getEthBalance') as keyof typeof toolChipFixtures;
type ToolStatus = (typeof statusOptions)[number];

const mixedChips: ToolCallChipData[] = [
  toolChipFixtures.getEthBalance.pending,
  toolChipFixtures.generateImage.success,
  toolChipFixtures.sendCrypto.error,
  toolChipFixtures.keyNftManage.success,
  toolChipFixtures.pineconeSearch.pending,
  toolChipFixtures.sendCryptoAgent.success,
];

const meta: Meta<typeof ChipGrid> = {
  title: 'ChatBot/ToolChips/Isolated',
  component: ChipGrid,
  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;
type Story = StoryObj<typeof ChipGrid>;

export const Pending: Story = {
  render: () => <ChipGrid chips={pendingChips} />,
};

export const Success: Story = {
  render: () => <ChipGrid chips={successChips} />,
};

export const Error: Story = {
  render: () => <ChipGrid chips={errorChips} />,
};

export const Mixed: Story = {
  render: () => <ChipGrid chips={mixedChips} />,
};

type PlaygroundArgs = {
  toolKey: keyof typeof toolChipFixtures;
  status: ToolStatus;
};

type PlaygroundStory = StoryObj<PlaygroundArgs>;

export const Playground: PlaygroundStory = {
  args: {
    toolKey: defaultToolKey,
    status: 'success',
  },
  argTypes: {
    toolKey: {
      control: { type: 'select' },
      options: toolKeys,
    },
    status: {
      control: { type: 'inline-radio' },
      options: statusOptions,
    },
  },
  render: (args) => {
    const { toolKey, status } = args;
    const chip = toolChipFixtures[toolKey][status];
    return <ChipGrid chips={[chip]} center />;
  },
};

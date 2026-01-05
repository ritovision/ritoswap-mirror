import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';

import TabsContainer from '../TabsContainer/TabsContainer';

function Panel({ label }: { label: string }) {
  return (
    <div
      style={{
        width: '100%',
        maxWidth: 720,
        padding: 24,
        border: '1px solid rgba(255,255,255,0.2)',
        borderRadius: 12,
        background: 'rgba(0,0,0,0.25)',
        color: 'white',
        fontSize: 18,
      }}
    >
      {label}
    </div>
  );
}

function Harness() {
  return (
    <div style={{ minHeight: '100vh', padding: 24, background: '#012035' }}>
      <TabsContainer
        messageContent={<Panel label="tab 1" />}
        musicContent={<Panel label="tab 2" />}
        chatbotContent={<Panel label="tab 3" />}
      />
    </div>
  );
}

const meta: Meta<typeof Harness> = {
  title: 'Gate/TabsContainer',
  component: Harness,
  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;
type Story = StoryObj<typeof Harness>;

export const Playground: Story = {};


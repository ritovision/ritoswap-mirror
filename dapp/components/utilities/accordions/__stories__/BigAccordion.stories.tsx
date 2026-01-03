import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';

import { BigAccordion } from '../BigAccordion';

type AccordionItem = Parameters<typeof BigAccordion>[0]['items'][number];

const DEFAULT_ITEMS: AccordionItem[] = [
  {
    title: 'Welcome to RitoSwap',
    value: 'welcome',
    content: (
      <p>
        Welcome to RitoSwap — where every fold of the accordion keeps you informed and entertained.
      </p>
    ),
  },
  {
    title: 'How it works',
    value: 'how-it-works',
    content: (
      <p>
        We combine music, art, and blockchain surprises with a smooth interface that feels cinematic.
      </p>
    ),
  },
];



const meta: Meta<typeof BigAccordion> = {
  title: 'Utilities/BigAccordion',
  component: BigAccordion,
  parameters: {
    layout: 'fullscreen',
  },
  args: {
    items: DEFAULT_ITEMS,
    contentPadding: 2,
  },
  argTypes: {
    contentPadding: { control: { type: 'number', min: 0, max: 4, step: 0.5 } },
    items: { table: { disable: true } },
  },
};

export default meta;
type Story = StoryObj<typeof BigAccordion>;

export const AccordionPlayground: Story = {};

export const CustomList: Story = {
  args: {
    items: [
      {
        title: 'Welcome to RitoSwap',
        value: 'welcome',
        content: <p>Welcome to RitoSwap — the fastest sound-to-chain bridge.</p>,
      },
      {
        title: 'Drop Frequency',
        value: 'drop-frequency',
        content: <p>New tracks every Wednesday, each with exclusive art.</p>,
      },
      {
        title: 'Keep exploring',
        value: 'keep-exploring',
        content: <p>Scroll to the next section to keep the rhythm going.</p>,
      },
    ],
  },
};


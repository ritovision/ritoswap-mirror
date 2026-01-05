import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';

import FooterLegalClient from '../utilities/footerLegal/FooterLegalClient';
import { FooterStoryFrame, PreventNavigation } from './FooterStoryFrame';

const meta = {
  title: 'Footer/Utilities/FooterLegal',
  component: FooterLegalClient,
  parameters: { layout: 'centered' },
} satisfies Meta<typeof FooterLegalClient>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <PreventNavigation>
      <FooterStoryFrame width={720}>
        <FooterLegalClient />
      </FooterStoryFrame>
    </PreventNavigation>
  ),
};

export const Playground: Story = {
  render: () => (
    <PreventNavigation>
      <FooterStoryFrame width={720}>
        <FooterLegalClient />
      </FooterStoryFrame>
    </PreventNavigation>
  ),
};

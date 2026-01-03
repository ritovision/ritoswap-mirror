import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';

import FooterMenuClient from '../utilities/footerMenu/FooterMenuClient';
import { FooterStoryFrame, PreventNavigation } from './FooterStoryFrame';

const meta: Meta<typeof FooterMenuClient> = {
  title: 'Footer/Utilities/FooterMenu',
  component: FooterMenuClient,
  parameters: { layout: 'centered' },
};

export default meta;
type Story = StoryObj<typeof FooterMenuClient>;

export const Default: Story = {
  render: () => (
    <PreventNavigation>
      <FooterStoryFrame width={420}>
        <FooterMenuClient />
      </FooterStoryFrame>
    </PreventNavigation>
  ),
};

export const Playground: Story = {
  render: () => (
    <PreventNavigation>
      <FooterStoryFrame width={420}>
        <FooterMenuClient />
      </FooterStoryFrame>
    </PreventNavigation>
  ),
};

import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';

import LogoArrayClient from '../utilities/logoArray/LogoArrayClient';
import { FooterStoryFrame, PreventNavigation } from './FooterStoryFrame';

const meta: Meta<typeof LogoArrayClient> = {
  title: 'Footer/Utilities/LogoArray',
  component: LogoArrayClient,
  parameters: { layout: 'centered' },
};

export default meta;
type Story = StoryObj<typeof LogoArrayClient>;

export const Default: Story = {
  render: () => (
    <PreventNavigation>
      <FooterStoryFrame width={980}>
        <LogoArrayClient />
      </FooterStoryFrame>
    </PreventNavigation>
  ),
};

export const Playground: Story = {
  render: () => (
    <PreventNavigation>
      <FooterStoryFrame width={980}>
        <LogoArrayClient />
      </FooterStoryFrame>
    </PreventNavigation>
  ),
};

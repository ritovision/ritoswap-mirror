import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';

import FooterSocialsClient from '../utilities/footerSocials/FooterSocialsClient';
import { FooterStoryFrame, PreventNavigation } from './FooterStoryFrame';

const meta: Meta<typeof FooterSocialsClient> = {
  title: 'Footer/Utilities/FooterSocials',
  component: FooterSocialsClient,
  parameters: { layout: 'centered' },
};

export default meta;
type Story = StoryObj<typeof FooterSocialsClient>;

export const Default: Story = {
  render: () => (
    <PreventNavigation>
      <FooterStoryFrame width={420}>
        <FooterSocialsClient />
      </FooterStoryFrame>
    </PreventNavigation>
  ),
};

export const Playground: Story = {
  render: () => (
    <PreventNavigation>
      <FooterStoryFrame width={420}>
        <FooterSocialsClient />
      </FooterStoryFrame>
    </PreventNavigation>
  ),
};

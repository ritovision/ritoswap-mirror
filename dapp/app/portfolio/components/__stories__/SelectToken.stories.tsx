import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';

import SelectToken, { type TokenType } from '../selection/SelectToken';
import {
  portfolioTokenToggleArgTypes,
  portfolioTokenToggleDefaults,
} from '@/.storybook/mocks/portfolio';

type StoryArgs = typeof portfolioTokenToggleDefaults;

function syncTokenCheckboxes(root: HTMLElement | null, desired: Record<TokenType, boolean>) {
  if (!root) return;
  const checkboxes = Array.from(root.querySelectorAll<HTMLElement>('[role="checkbox"]'));
  for (const el of checkboxes) {
    const label = (el.textContent ?? '').trim() as TokenType;
    if (!(label in desired)) continue;
    const isChecked = el.getAttribute('aria-checked') === 'true';
    if (isChecked !== desired[label]) el.click();
  }
}

function Harness(args: StoryArgs) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [selected, setSelected] = React.useState<TokenType[]>([]);

  React.useEffect(() => {
    const desired: Record<TokenType, boolean> = {
      'ERC-20': args.selectErc20,
      'ERC-721': args.selectErc721,
      'ERC-1155': args.selectErc1155,
    };
    const t = window.setTimeout(() => syncTokenCheckboxes(containerRef.current, desired), 50);
    return () => window.clearTimeout(t);
  }, [args.selectErc20, args.selectErc721, args.selectErc1155]);

  return (
    <div style={{ minHeight: '100vh', padding: 24, background: '#012035', color: 'white' }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <div ref={containerRef}>
          <SelectToken onSelectionChange={setSelected} />
        </div>
        <div style={{ marginTop: 12, opacity: 0.85, fontSize: 14 }}>
          Selected token types: {selected.length ? selected.join(', ') : '(none)'}
        </div>
      </div>
    </div>
  );
}

const meta: Meta<typeof Harness> = {
  title: 'Portfolio/Selection/SelectToken',
  component: Harness,
  parameters: {
    layout: 'fullscreen',
  },
  args: {
    ...portfolioTokenToggleDefaults,
  },
  argTypes: {
    ...portfolioTokenToggleArgTypes,
  },
};

export default meta;
type Story = StoryObj<typeof Harness>;

export const Playground: Story = {};


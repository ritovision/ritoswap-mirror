import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';

import { useAccount } from 'wagmi';

import AccountDropdown from '../selection/AccountDropdown';
import SelectChain from '../selection/SelectChain';
import SelectToken, { type TokenType } from '../selection/SelectToken';
import ChainWrapper from '../organize/ChainWrapper';
import styles from '../../page.module.css';

import FetchMock from '@/.storybook/harnesses/FetchMock';
import WalletReady from '@/.storybook/harnesses/WalletReady';
import {
  PORTFOLIO_DEFAULT_ADDRESS,
  PORTFOLIO_SECONDARY_ADDRESS,
  createPortfolioAlchemyFetchHandlers,
  portfolioChainToggleArgTypes,
  portfolioChainToggleDefaults,
  portfolioTokenToggleArgTypes,
  portfolioTokenToggleDefaults,
} from '@/.storybook/mocks/portfolio';
import { useChainInfo } from '@/components/providers/ChainInfoProvider';

type StoryArgs = typeof portfolioChainToggleDefaults &
  typeof portfolioTokenToggleDefaults & {
    walletConnected: boolean;
    selectMainnet: boolean;
    selectSepolia: boolean;
    selectPolygon: boolean;
    selectArbitrum: boolean;
    selectBase: boolean;
    selectOptimism: boolean;
  };

function syncCheckboxesByLabel(
  root: HTMLElement | null,
  desired: Record<string, boolean>,
  opts?: { match?: 'equals' | 'includes' },
) {
  if (!root) return;
  const match = opts?.match ?? 'includes';
  const boxes = Array.from(root.querySelectorAll<HTMLElement>('[role="checkbox"]'));
  for (const el of boxes) {
    const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
    const desiredEntry =
      match === 'equals'
        ? desired[text]
        : Object.entries(desired).find(([k]) => text.includes(k))?.[1];
    if (typeof desiredEntry !== 'boolean') continue;
    const isChecked = el.getAttribute('aria-checked') === 'true';
    if (isChecked !== desiredEntry) el.click();
  }
}

function Harness(args: StoryArgs) {
  const handlers = React.useMemo(() => createPortfolioAlchemyFetchHandlers({ mode: 'ok' }), []);
  const { getChainDisplayName } = useChainInfo();
  const { isConnected, address, addresses } = useAccount();

  const [selectedAddress, setSelectedAddress] = React.useState<string>('');
  const [selectedChains, setSelectedChains] = React.useState<number[]>([]);
  const [selectedTokens, setSelectedTokens] = React.useState<TokenType[]>([]);

  const selectChainRef = React.useRef<HTMLDivElement>(null);
  const selectTokenRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (isConnected && address) setSelectedAddress(address);
    if (!isConnected) setSelectedAddress('');
  }, [isConnected, address]);

  React.useEffect(() => {
    const desiredChainIds = ([
      args.selectMainnet ? 1 : null,
      args.selectSepolia ? 11155111 : null,
      args.selectPolygon ? 137 : null,
      args.selectArbitrum ? 42161 : null,
      args.selectBase ? 8453 : null,
      args.selectOptimism ? 10 : null,
    ].filter(Boolean) as number[]);

    const desiredChainLabels = Object.fromEntries(
      desiredChainIds.map((id) => [getChainDisplayName(id), true]),
    );

    const desiredTokenLabels: Record<string, boolean> = {
      'ERC-20': args.selectErc20,
      'ERC-721': args.selectErc721,
      'ERC-1155': args.selectErc1155,
    };

    const t = window.setTimeout(() => {
      syncCheckboxesByLabel(selectChainRef.current, desiredChainLabels, { match: 'includes' });
      syncCheckboxesByLabel(selectTokenRef.current, desiredTokenLabels, { match: 'includes' });
    }, 120);

    return () => window.clearTimeout(t);
  }, [
    args.selectMainnet,
    args.selectSepolia,
    args.selectPolygon,
    args.selectArbitrum,
    args.selectBase,
    args.selectOptimism,
    args.selectErc20,
    args.selectErc721,
    args.selectErc1155,
    getChainDisplayName,
  ]);

  const chainData = selectedChains.map((id) => ({
    chainId: id,
    chainName: getChainDisplayName(id),
    tokens: selectedTokens,
  }));

  return (
    <FetchMock handlers={handlers}>
      <div style={{ minHeight: '100vh', background: '#012035' }}>
        <div className={styles.AccountContainer}>
          <WalletReady requiredConnected={args.walletConnected}>
            <AccountDropdown
              isConnected={isConnected}
              selectedAddress={selectedAddress}
              addresses={(addresses?.length ? addresses : [PORTFOLIO_DEFAULT_ADDRESS, PORTFOLIO_SECONDARY_ADDRESS]) as any}
              onConnect={() => {}}
              onAddressChange={setSelectedAddress}
            />
          </WalletReady>
        </div>

        <div className={styles.SelectionContainer}>
          <div ref={selectChainRef}>
            <SelectChain onSelectionChange={setSelectedChains} />
          </div>
          <div ref={selectTokenRef}>
            <SelectToken onSelectionChange={setSelectedTokens} />
          </div>
        </div>

        <div className={styles.ChainContainer}>
          <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px 24px' }}>
            <ChainWrapper chains={chainData} address={selectedAddress} />
          </div>
        </div>
      </div>
    </FetchMock>
  );
}

const meta: Meta<typeof Harness> = {
  title: 'Portfolio/Integration',
  component: Harness,
  parameters: {
    layout: 'fullscreen',
    mockWallet: {
      connected: true,
      accounts: [PORTFOLIO_DEFAULT_ADDRESS, PORTFOLIO_SECONDARY_ADDRESS],
    },
    mockEns: { enabled: true, allAddresses: false, name: 'ritorhymes.eth' },
    mockBalance: { enabled: true, eth: '1.2345' },
  },
  args: {
    ...portfolioChainToggleDefaults,
    ...portfolioTokenToggleDefaults,
    walletConnected: true,
    selectMainnet: true,
    selectSepolia: false,
    selectPolygon: true,
    selectArbitrum: false,
    selectBase: false,
    selectOptimism: false,
  },
  argTypes: {
    walletConnected: { control: { type: 'boolean' as const }, table: { category: 'Wallet' } },
    selectMainnet: { control: { type: 'boolean' as const }, table: { category: 'Selected Chains' } },
    selectSepolia: { control: { type: 'boolean' as const }, table: { category: 'Selected Chains' } },
    selectPolygon: { control: { type: 'boolean' as const }, table: { category: 'Selected Chains' } },
    selectArbitrum: { control: { type: 'boolean' as const }, table: { category: 'Selected Chains' } },
    selectBase: { control: { type: 'boolean' as const }, table: { category: 'Selected Chains' } },
    selectOptimism: { control: { type: 'boolean' as const }, table: { category: 'Selected Chains' } },
    ...portfolioTokenToggleArgTypes,
    ...portfolioChainToggleArgTypes,
  },
};

export default meta;
type Story = StoryObj<typeof Harness>;

export const Playground: Story = {};


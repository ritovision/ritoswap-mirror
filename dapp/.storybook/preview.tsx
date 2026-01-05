import React from 'react';
import type { Preview } from '@storybook/nextjs-vite';

import './fonts.css';
import '../styles/globals.css';
import './storybook-overrides.css';

import MockAppProviders from './decorators/MockAppProviders';
import RitoTheme from './RitoTheme';
import { getTargetChainId } from '@config/chain';

if (typeof window !== 'undefined') {
  const win = window as Window & { __RITO_ASSET_PREFIX__?: string };
  win.__RITO_ASSET_PREFIX__ = '/storybook-static';
}

function parseAccountsCsv(value: unknown) {
  if (typeof value !== 'string') return undefined;
  const parts = value
    .split(/[,\s]+/g)
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts : undefined;
}

function resolveChainIdFromNetwork(value: unknown) {
  if (typeof value !== 'string') return undefined;
  const map: Record<string, number> = {
    mainnet: 1,
    sepolia: 11155111,
    polygon: 137,
    arbitrum: 42161,
    avalanche: 43114,
    base: 8453,
    optimism: 10,
    fantom: 250,
  };
  return map[value];
}

function resolveAccounts(context: any) {
  const secondary: unknown = context.parameters?.walletSecondaryAccounts;
  const secondaryAccounts =
    Array.isArray(secondary) && secondary.every((x) => typeof x === 'string') ? (secondary as string[]) : undefined;

  const args = context.args ?? {};
  const fromArgs = parseAccountsCsv(args.walletAccountsCsv);
  const base = context.parameters?.mockWallet?.accounts;
  const baseAccounts =
    Array.isArray(base) && base.every((x: unknown) => typeof x === 'string') ? (base as string[]) : undefined;

  if (secondaryAccounts && secondaryAccounts.length > 0) {
    const primary = (fromArgs?.[0] ?? baseAccounts?.[0]) as string | undefined;
    return [primary, ...secondaryAccounts].filter(Boolean);
  }

  return fromArgs ?? baseAccounts;
}

function resolveEnabledChainIds(context: any) {
  const args = context.args ?? {};
  const mapping: Array<[keyof typeof args, number]> = [
    ['showMainnet', 1],
    ['showSepolia', 11155111],
    ['showPolygon', 137],
    ['showArbitrum', 42161],
    ['showAvalanche', 43114],
    ['showBase', 8453],
    ['showOptimism', 10],
    ['showFantom', 250],
  ];

  let sawAnyToggle = false;
  const enabled: number[] = [];
  for (const [key, chainId] of mapping) {
    if (typeof args[key] !== 'boolean') continue;
    sawAnyToggle = true;
    if (args[key]) enabled.push(chainId);
  }

  return sawAnyToggle ? enabled : undefined;
}

function resolveViewChainId(context: any) {
  const args = context.args ?? {};
  const fromArgs =
    resolveChainIdFromNetwork(args.viewNetwork) ??
    resolveChainIdFromNetwork(args.dappNetwork) ??
    resolveChainIdFromNetwork(args.walletNetwork);
  const base = context.parameters?.mockDappChain?.chainId;
  if (typeof base === 'number') return base;
  return fromArgs;
}

function resolveMockDappChain(context: any) {
  const chainId = resolveViewChainId(context);
  return typeof chainId === 'number' ? { chainId } : undefined;
}

function resolveMockWallet(context: any) {
  const base = context.parameters?.mockWallet ?? {};
  const args = context.args ?? {};
  const resolved: Record<string, unknown> = { ...base };

  if (typeof args.walletConnected === 'boolean') resolved.connected = args.walletConnected;

  if (typeof args.walletNetwork === 'string') {
    const chainId = resolveChainIdFromNetwork(args.walletNetwork);
    if (typeof chainId === 'number') resolved.chainId = chainId;
  }

  const accounts = resolveAccounts(context);
  if (accounts) resolved.accounts = accounts;

  const enabledChainIds = resolveEnabledChainIds(context);
  const viewChainId = resolveViewChainId(context);
  if (enabledChainIds) {
    const activeChainId = getTargetChainId();
    if (!enabledChainIds.includes(activeChainId)) enabledChainIds.push(activeChainId);
    const chainId = typeof resolved.chainId === 'number' ? resolved.chainId : undefined;
    if (chainId && !enabledChainIds.includes(chainId)) enabledChainIds.push(chainId);
    if (viewChainId && !enabledChainIds.includes(viewChainId)) enabledChainIds.push(viewChainId);
    resolved.enabledChainIds = enabledChainIds;
  }

  return Object.keys(resolved).length > 0 ? resolved : undefined;
}

function resolveMockEns(context: any) {
  const base = context.parameters?.mockEns ?? {};
  const args = context.args ?? {};
  const resolved: Record<string, unknown> = { ...base };

  if (typeof args.ensEnabled === 'boolean') resolved.enabled = args.ensEnabled;
  if (typeof args.ensName === 'string') resolved.name = args.ensName;

  return Object.keys(resolved).length > 0 ? resolved : undefined;
}

function resolveMockBalance(context: any) {
  const base = context.parameters?.mockBalance ?? {};
  const args = context.args ?? {};
  const resolved: Record<string, unknown> = { ...base };

  if (typeof args.balanceEnabled === 'boolean') resolved.enabled = args.balanceEnabled;
  if (typeof args.balanceEth === 'string') resolved.eth = args.balanceEth;

  return Object.keys(resolved).length > 0 ? resolved : undefined;
}

const preview: Preview = {
  decorators: [
    (Story) => <Story />,
    (Story, context) => (
      <MockAppProviders
        key={JSON.stringify({
          storyId: context.id,
          mockWallet: resolveMockWallet(context) ?? {},
          mockEns: resolveMockEns(context) ?? {},
          mockBalance: resolveMockBalance(context) ?? {},
          mockDappChain: resolveMockDappChain(context) ?? {},
        })}
        mockWallet={resolveMockWallet(context)}
        mockEns={resolveMockEns(context)}
        mockBalance={resolveMockBalance(context)}
        mockDappChain={resolveMockDappChain(context)}
      >
        <Story />
      </MockAppProviders>
    ),
  ],
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    nextjs: {
      appDirectory: true,
    },
    docs: {
      theme: RitoTheme,
    },
  },
  tags: ['autodocs'],
};

export default preview;

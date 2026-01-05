'use client';

import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';
import { useAccount, useConnect } from 'wagmi';
import { formatUnits, parseEther } from 'viem';

import { ChainInfoProvider } from '@components/providers/ChainInfoProvider';
import { RateLimitModalProvider } from '@/components/utilities/rateLimitModal/RateLimitModal';
import { DappChainProvider, useDappChain } from '@/components/providers/DappChainProvider';

import {
  createMockWagmiConfig,
  MOCK_DEFAULT_ACCOUNTS,
  MOCK_DEFAULT_ENS_AVATAR,
  MOCK_DEFAULT_ENS_NAME,
  type MockDappChainParameters,
  type MockBalanceParameters,
  type MockEnsParameters,
  type MockWalletParameters,
} from '../mocks/mockWagmiConfig';

function AutoConnect({ enabled, chainId }: { enabled: boolean; chainId?: number }) {
  const attemptedRef = React.useRef(false);
  const { isConnected } = useAccount();
  const { connect, connectors } = useConnect();

  React.useEffect(() => {
    if (!enabled) return;
    if (isConnected) return;
    if (attemptedRef.current) return;
    const connector = connectors[0];
    if (!connector) return;

    attemptedRef.current = true;
    connect({ connector, chainId });
  }, [enabled, isConnected, connect, connectors, chainId]);

  return null;
}

function getEnsNameQueryKey(parameters: { address: `0x${string}`; chainId?: number }) {
  return ['ensName', { ...parameters }] as const;
}

function getEnsAvatarQueryKey(parameters: { name: string; chainId?: number }) {
  return ['ensAvatar', { ...parameters }] as const;
}

function getBalanceQueryKey(parameters: { address: `0x${string}`; chainId: number }) {
  return ['balance', { ...parameters }] as const;
}

function applyEnsMocks(queryClient: QueryClient, mockEns?: MockEnsParameters, mockWallet?: MockWalletParameters) {
  if (!mockEns) return;
  const walletAccounts = (mockWallet?.accounts ?? MOCK_DEFAULT_ACCOUNTS) as readonly string[];
  const addresses = (mockEns.addresses ?? walletAccounts).filter(Boolean);
  const targets = mockEns.allAddresses ? addresses : addresses.slice(0, 1);

  queryClient.setQueryDefaults(['ensName'], { staleTime: Number.POSITIVE_INFINITY, retry: false });
  queryClient.setQueryDefaults(['ensAvatar'], { staleTime: Number.POSITIVE_INFINITY, retry: false });

  const ensNameValue = mockEns?.enabled ? mockEns.name ?? MOCK_DEFAULT_ENS_NAME : null;
  for (const address of addresses) {
    const value = targets.includes(address) ? ensNameValue : null;
    queryClient.setQueryData(getEnsNameQueryKey({ address: address as `0x${string}`, chainId: 1 }), value);
  }

  if (mockEns?.enabled && typeof ensNameValue === 'string') {
    const avatar = mockEns.avatar ?? MOCK_DEFAULT_ENS_AVATAR;
    queryClient.setQueryData(getEnsAvatarQueryKey({ name: ensNameValue, chainId: 1 }), avatar);
  }
}

function safeParseEther(value: string | undefined) {
  if (!value) return 0n;
  try {
    return parseEther(value);
  } catch {
    return 0n;
  }
}

function applyBalanceMocks(
  queryClient: QueryClient,
  mockBalance?: MockBalanceParameters,
  mockWallet?: MockWalletParameters,
  mockDappChain?: MockDappChainParameters,
) {
  if (!mockBalance) return;
  const walletAccounts = (mockWallet?.accounts ?? MOCK_DEFAULT_ACCOUNTS) as readonly string[];
  const addresses = (mockBalance.addresses ?? walletAccounts).filter(Boolean);
  queryClient.setQueryDefaults(['balance'], { staleTime: Number.POSITIVE_INFINITY, retry: false });
  const ethByAddress = mockBalance.ethByAddress
    ? Object.fromEntries(Object.entries(mockBalance.ethByAddress).map(([k, v]) => [k.toLowerCase(), v]))
    : undefined;

  const chainIdSet = new Set<number>();
  if (typeof mockBalance.chainId === 'number') {
    chainIdSet.add(mockBalance.chainId);
  } else {
    const walletChainId = typeof mockWallet?.chainId === 'number' ? mockWallet.chainId : 1;
    chainIdSet.add(walletChainId);
    for (const id of mockWallet?.enabledChainIds ?? []) {
      if (typeof id === 'number') chainIdSet.add(id);
    }
  }
  if (typeof mockDappChain?.chainId === 'number') chainIdSet.add(mockDappChain.chainId);
  const chainIds = Array.from(chainIdSet);

  for (const address of addresses) {
    for (const chainId of chainIds) {
      if (mockBalance.enabled) {
        const decimals = mockBalance.decimals ?? 18;
        const symbol = mockBalance.symbol ?? 'ETH';
        const ethOverride = ethByAddress?.[address.toLowerCase()];
        const value = safeParseEther(ethOverride ?? mockBalance.eth);
        const formatted = formatUnits(value, decimals);
        queryClient.setQueryData(getBalanceQueryKey({ address: address as `0x${string}`, chainId }), {
          decimals,
          formatted,
          symbol,
          value,
        });
      } else {
        queryClient.setQueryData(getBalanceQueryKey({ address: address as `0x${string}`, chainId }), null);
      }
    }
  }
}

function DappChainSeed({ chainId }: { chainId?: number }) {
  const { dappChainId, setDappChainId } = useDappChain();
  const { isConnected, chainId: walletChainId } = useAccount();
  React.useEffect(() => {
    if (typeof chainId !== 'number') return;
    if (dappChainId === chainId) return;
    // Defer to run after the provider's connect/reset effect.
    const timer = setTimeout(() => {
      setDappChainId(chainId);
    }, 0);
    return () => clearTimeout(timer);
  }, [chainId, dappChainId, isConnected, walletChainId, setDappChainId]);
  return null;
}

export default function MockAppProviders({
  children,
  mockWallet,
  mockEns,
  mockBalance,
  mockDappChain,
}: {
  children: React.ReactNode;
  mockWallet?: MockWalletParameters;
  mockEns?: MockEnsParameters;
  mockBalance?: MockBalanceParameters;
  mockDappChain?: MockDappChainParameters;
}) {
  const [queryClient] = React.useState(() => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    applyEnsMocks(qc, mockEns, mockWallet);
    applyBalanceMocks(qc, mockBalance, mockWallet, mockDappChain);
    return qc;
  });
  const [wagmiConfig] = React.useState(() => createMockWagmiConfig(mockWallet));

  return (
    <QueryClientProvider client={queryClient}>
      <WagmiProvider config={wagmiConfig}>
        <AutoConnect enabled={!!mockWallet?.connected} chainId={mockWallet?.chainId} />
        <RateLimitModalProvider>
          <ChainInfoProvider>
            <DappChainProvider>
              <DappChainSeed chainId={mockDappChain?.chainId} />
              {children}
            </DappChainProvider>
          </ChainInfoProvider>
        </RateLimitModalProvider>
      </WagmiProvider>
    </QueryClientProvider>
  );
}

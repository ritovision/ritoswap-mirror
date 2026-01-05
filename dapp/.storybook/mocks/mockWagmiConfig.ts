import { createConfig, createConnector, custom } from 'wagmi';
import { arbitrum, avalanche, base, fantom, mainnet, optimism, polygon, sepolia } from 'wagmi/chains';
import { defineChain, type Address, type Chain } from 'viem';
import { CHAIN_IDS } from '@config/chain';

export const MOCK_DEFAULT_CHAIN_ID = mainnet.id;
export const MOCK_DEFAULT_ACCOUNTS = [
  '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
] as const satisfies readonly Address[];
export const MOCK_WALLETCONNECT_URI = 'wc:test-walletconnect-session-id-0123456789abcdef0123456789abcdef@2?relay-protocol=irn&symKey=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
export const MOCK_DEFAULT_ENS_NAME = 'ritorhymes.eth';
export const MOCK_DEFAULT_ENS_AVATAR =
  'data:image/svg+xml;charset=utf-8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><rect width="48" height="48" rx="24" fill="#111827"/><text x="24" y="28" text-anchor="middle" font-family="system-ui, -apple-system, Segoe UI, Roboto, sans-serif" font-size="18" fill="#F9FAFB">R</text></svg>`,
  );

const ritonet = defineChain({
  id: CHAIN_IDS.ritonet,
  name: 'RitoNet',
  nativeCurrency: { decimals: 18, name: 'Ether', symbol: 'ETH' },
  rpcUrls: {
    default: {
      http: ['http://127.0.0.1:8545'],
      webSocket: ['ws://127.0.0.1:8545'],
    },
  },
  testnet: true,
});

export type MockWalletParameters = {
  connected?: boolean;
  chainId?: number;
  accounts?: readonly string[];
  enabledChainIds?: readonly number[];
  connectorId?: string;
  connectorName?: string;
  connectorType?: string;
  /**
   * When true, adds a WalletConnect-style connector (still fully mocked).
   * Leave false by default to avoid accidental wc: navigation in narrow viewports.
   */
  includeWalletConnect?: boolean;
  /**
   * When true, also includes a second injected connector (Trust Wallet) for UI testing.
   */
  includeTrustWallet?: boolean;
};

export type MockDappChainParameters = {
  chainId?: number;
};

export type MockEnsParameters = {
  enabled?: boolean;
  /**
   * When true, applies the ENS name/avatar to all connected addresses.
   * When false/undefined, only applies to the primary (first) address.
   */
  allAddresses?: boolean;
  name?: string;
  avatar?: string | null;
  addresses?: readonly string[];
};

export type MockBalanceParameters = {
  enabled?: boolean;
  /**
   * Balance in ETH units (string so it can be edited in Storybook Controls).
   * Example: "1.2345"
   */
  eth?: string;
  /**
   * Per-address overrides (ETH units). Keys are compared case-insensitively.
   * Example: { "0xabc...": "0.42" }
   */
  ethByAddress?: Record<string, string>;
  /**
   * Optional override for chain id to seed balance under.
   * If omitted, uses the mock wallet chain id.
   */
  chainId?: number;
  /**
   * Optional override addresses to seed balance for.
   * If omitted, uses mock wallet accounts.
   */
  addresses?: readonly string[];
  /**
   * Optional symbol/decimals overrides (native currency defaults).
   */
  symbol?: string;
  decimals?: number;
};

type Eip1193RequestArgs = { method: string; params?: unknown[] | Record<string, unknown> };

function toHexChainId(chainId: number) {
  return `0x${chainId.toString(16)}`;
}

type ConnectResult<withCapabilities extends boolean> = {
  accounts: withCapabilities extends true
    ? readonly { address: Address; capabilities: Record<string, unknown> }[]
    : readonly Address[];
  chainId: number;
};

function normalizeAccounts(accounts?: readonly string[]) {
  const filtered = (accounts ?? []).filter((a) => typeof a === 'string' && a.startsWith('0x') && a.length >= 42);
  return (filtered.length > 0 ? filtered : [...MOCK_DEFAULT_ACCOUNTS]) as readonly Address[];
}

type DisplayUriListener = (uri: string) => void;

function createDisplayUriEmitter() {
  const listeners = new Set<DisplayUriListener>();
  return {
    on(event: string, cb: DisplayUriListener) {
      if (event !== 'display_uri') return;
      listeners.add(cb);
    },
    emit(uri: string) {
      for (const cb of listeners) cb(uri);
    },
  };
}

function resolveInjectedConnectorDefaults(connectorId: string) {
  if (connectorId === 'trust') {
    return { name: 'Trust Wallet', icon: '/images/wallets/trust-wallet-logo.png' };
  }
  return { name: 'MetaMask', icon: '/images/wallets/metamask-logo.png' };
}

function createMockRpcRequest(state: { chainId: number; connected: boolean; accounts: readonly Address[] }) {
  return async ({ method, params }: Eip1193RequestArgs) => {
    switch (method) {
      case 'eth_chainId':
        return toHexChainId(state.chainId);
      case 'eth_accounts':
        return state.connected ? [...state.accounts] : [];
      case 'eth_requestAccounts':
        state.connected = true;
        return [...state.accounts];
      case 'eth_blockNumber':
        return '0x0';
      case 'eth_getBalance':
        return '0x0';
      case 'eth_getTransactionCount':
        return '0x0';
      case 'eth_gasPrice':
        return '0x0';
      case 'eth_estimateGas':
        return '0x5208';
      case 'eth_call':
        return '0x';
      case 'eth_getCode':
        return '0x';
      case 'eth_getLogs':
        return [];
      case 'eth_getTransactionReceipt':
        return null;
      case 'wallet_switchEthereumChain': {
        if (!Array.isArray(params) || params.length < 1) return null;
        const p0 = params[0] as { chainId?: string };
        if (typeof p0?.chainId === 'string') {
          const next = Number.parseInt(p0.chainId, 16);
          if (Number.isFinite(next)) state.chainId = next;
        }
        return null;
      }
      case 'personal_sign':
      case 'eth_sign':
      case 'eth_signTypedData_v4':
        return `0x${'1'.repeat(130)}`;
      default:
        throw new Error(`Mock Web3 RPC method not implemented: ${method}`);
    }
  };
}

export function createMockWagmiConfig(mockWallet?: MockWalletParameters) {
  const accounts = normalizeAccounts(mockWallet?.accounts);
  const requestedChainId = mockWallet?.chainId ?? MOCK_DEFAULT_CHAIN_ID;
  const injectedId = mockWallet?.connectorId ?? 'metamask';
  const injectedDefaults = resolveInjectedConnectorDefaults(injectedId);
  const injectedName = mockWallet?.connectorName ?? injectedDefaults.name;
  const injectedIcon = injectedDefaults.icon;
  const injectedType = (mockWallet?.connectorType ?? 'injected') as string;

  const allChains: Chain[] = [mainnet, sepolia, polygon, arbitrum, avalanche, base, optimism, fantom, ritonet];
  const enabledChainIds = mockWallet?.enabledChainIds?.length ? [...mockWallet.enabledChainIds] : undefined;
  if (enabledChainIds && !enabledChainIds.includes(requestedChainId)) enabledChainIds.push(requestedChainId);

  const chains = enabledChainIds ? allChains.filter((c) => enabledChainIds.includes(c.id)) : allChains;
  const nonEmptyChains: Chain[] = chains.length > 0 ? chains : [mainnet];

  const state: { connected: boolean; chainId: number; accounts: readonly Address[] } = {
    connected: !!mockWallet?.connected,
    chainId: requestedChainId,
    accounts,
  };
  const request = createMockRpcRequest(state);

  const displayUriEmitter = createDisplayUriEmitter();
  const walletConnectProvider = {
    request,
    on: (event: string, cb: DisplayUriListener) => displayUriEmitter.on(event, cb),
  };

  const injectedConnector = createConnector(() => ({
    id: injectedId,
    name: injectedName,
    type: injectedType,
    async connect<withCapabilities extends boolean = false>(
      parameters?: {
        chainId?: number | undefined;
        isReconnecting?: boolean | undefined;
        withCapabilities?: withCapabilities | boolean | undefined;
      },
    ): Promise<ConnectResult<withCapabilities>> {
      state.connected = true;
      if (typeof parameters?.chainId === 'number') state.chainId = parameters.chainId;

      const accounts = parameters?.withCapabilities
        ? state.accounts.map((address) => ({ address, capabilities: {} as Record<string, unknown> }))
        : [...state.accounts];

      return {
        accounts: accounts as unknown as ConnectResult<withCapabilities>['accounts'],
        chainId: state.chainId,
      };
    },
    async disconnect() {
      state.connected = false;
    },
    async getAccounts() {
      return state.connected ? [...state.accounts] : [];
    },
    async getChainId() {
      return state.chainId;
    },
    async isAuthorized() {
      return state.connected;
    },
    async switchChain({ chainId }) {
      state.chainId = chainId;
      const chain = nonEmptyChains.find((c) => c.id === chainId);
      if (!chain) throw new Error(`Mock chain not configured: ${chainId}`);
      return chain;
    },
    async getProvider(_parameters?: { chainId?: number | undefined }) {
      return { request } as unknown as { request: (args: Eip1193RequestArgs) => Promise<unknown> };
    },
    onAccountsChanged(accounts) {
      state.connected = accounts.length > 0;
    },
    onChainChanged(chainId) {
      const next = Number.parseInt(chainId, 16);
      if (Number.isFinite(next)) state.chainId = next;
    },
    onDisconnect(_error?: Error) {
      state.connected = false;
    },
  }));
  (injectedConnector as unknown as { icon?: string }).icon = injectedIcon;

  const trustConnector = createConnector(() => ({
    id: 'trust',
    name: 'Trust Wallet',
    type: 'injected',
    async connect<withCapabilities extends boolean = false>(parameters?: {
      chainId?: number | undefined;
      isReconnecting?: boolean | undefined;
      withCapabilities?: withCapabilities | boolean | undefined;
    }): Promise<ConnectResult<withCapabilities>> {
      state.connected = true;
      if (typeof parameters?.chainId === 'number') state.chainId = parameters.chainId;

      const accounts = parameters?.withCapabilities
        ? state.accounts.map((address) => ({ address, capabilities: {} as Record<string, unknown> }))
        : [...state.accounts];

      return {
        accounts: accounts as unknown as ConnectResult<withCapabilities>['accounts'],
        chainId: state.chainId,
      };
    },
    async disconnect() {
      state.connected = false;
    },
    async getAccounts() {
      return state.connected ? [...state.accounts] : [];
    },
    async getChainId() {
      return state.chainId;
    },
    async isAuthorized() {
      return state.connected;
    },
    async switchChain({ chainId }) {
      state.chainId = chainId;
      const chain = nonEmptyChains.find((c) => c.id === chainId);
      if (!chain) throw new Error(`Mock chain not configured: ${chainId}`);
      return chain;
    },
    async getProvider(_parameters?: { chainId?: number | undefined }) {
      return { request } as unknown as { request: (args: Eip1193RequestArgs) => Promise<unknown> };
    },
    onAccountsChanged(accounts) {
      state.connected = accounts.length > 0;
    },
    onChainChanged(chainId) {
      const next = Number.parseInt(chainId, 16);
      if (Number.isFinite(next)) state.chainId = next;
    },
    onDisconnect(_error?: Error) {
      state.connected = false;
    },
  }));
  (trustConnector as unknown as { icon?: string }).icon = '/images/wallets/trust-wallet-logo.png';

  const walletConnectConnector = createConnector(() => ({
    id: 'walletconnect',
    name: 'WalletConnect',
    type: 'walletConnect',
    async connect<withCapabilities extends boolean = false>(
      parameters?: {
        chainId?: number | undefined;
        isReconnecting?: boolean | undefined;
        withCapabilities?: withCapabilities | boolean | undefined;
      },
    ): Promise<ConnectResult<withCapabilities>> {
      // Trigger the same event the real WalletConnect provider emits so the ConnectModal can show a QR.
      displayUriEmitter.emit(MOCK_WALLETCONNECT_URI);

      state.connected = true;
      if (typeof parameters?.chainId === 'number') state.chainId = parameters.chainId;

      const accounts = parameters?.withCapabilities
        ? state.accounts.map((address) => ({ address, capabilities: {} as Record<string, unknown> }))
        : [...state.accounts];

      return {
        accounts: accounts as unknown as ConnectResult<withCapabilities>['accounts'],
        chainId: state.chainId,
      };
    },
    async disconnect() {
      state.connected = false;
    },
    async getAccounts() {
      return state.connected ? [...state.accounts] : [];
    },
    async getChainId() {
      return state.chainId;
    },
    async isAuthorized() {
      return state.connected;
    },
    async switchChain({ chainId }) {
      state.chainId = chainId;
      const chain = nonEmptyChains.find((c) => c.id === chainId);
      if (!chain) throw new Error(`Mock chain not configured: ${chainId}`);
      return chain;
    },
    async getProvider(_parameters?: { chainId?: number | undefined }) {
      return walletConnectProvider as unknown as { request: (args: Eip1193RequestArgs) => Promise<unknown> };
    },
    onAccountsChanged(accounts) {
      state.connected = accounts.length > 0;
    },
    onChainChanged(chainId) {
      const next = Number.parseInt(chainId, 16);
      if (Number.isFinite(next)) state.chainId = next;
    },
    onDisconnect(_error?: Error) {
      state.connected = false;
    },
  }));

  const connectors = [
    injectedConnector,
    ...(mockWallet?.includeTrustWallet ? [trustConnector] : []),
    ...(mockWallet?.includeWalletConnect ? [walletConnectConnector] : []),
  ];

  const transports = Object.fromEntries(
    nonEmptyChains.map((chain) => [chain.id, custom({ request }, { retryCount: 0 })]),
  ) as Record<number, unknown>;

  return createConfig({
    // wagmi expects a readonly non-empty tuple, but for Storybook we can keep it simple.
    chains: nonEmptyChains as any,
    connectors,
    transports: transports as any,
    ssr: false,
  });
}

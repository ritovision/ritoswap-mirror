"use client";

import { ReactNode, useMemo } from "react";
import { WagmiProvider, createConfig } from "wagmi";
import { mainnet, sepolia, polygon, arbitrum, avalanche, base, optimism, fantom } from "wagmi/chains";
import { http, webSocket, fallback } from "wagmi";
import { walletConnect, injected } from "wagmi/connectors";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { defineChain, type Chain, type Transport } from "viem";
import { RateLimitModalProvider } from "@/components/utilities/rateLimitModal/RateLimitModal";
import { DappChainProvider } from "@/components/providers/DappChainProvider";
import { publicEnv, publicConfig } from "@config/public.env";
import { getChainConfig, getActiveChain, CHAIN_IDS } from "@config/chain";
import { useWalletConnectGuards } from "@hooks/useWalletConnectGuards";

const queryClient = new QueryClient();

export function Providers({ children }: { children: ReactNode }) {
  const isClient = typeof window !== "undefined";
  useWalletConnectGuards(isClient);

  const activeChain = getActiveChain();
  const activeChainConfig = getChainConfig(activeChain);
  const ALCHEMY_API_KEY = publicEnv.NEXT_PUBLIC_ALCHEMY_API_KEY ?? "";
  const wcProjectId = publicEnv.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID?.trim();
  const BASE_URL = `${publicConfig.isDevelopment ? "http" : "https"}://${publicEnv.NEXT_PUBLIC_DOMAIN}`;

  const ritonet =
    activeChain === "ritonet"
      ? defineChain({
          id: CHAIN_IDS.ritonet,
          name: publicEnv.NEXT_PUBLIC_LOCAL_BLOCKCHAIN_NAME,
          nativeCurrency: { decimals: 18, name: "Ether", symbol: "ETH" },
          rpcUrls: {
            default: {
              http: [activeChainConfig.rpcUrl],
              webSocket: activeChainConfig.wssUrl ? [activeChainConfig.wssUrl] : undefined,
            },
          },
          blockExplorers: activeChainConfig.explorerUrl
            ? { default: { name: activeChainConfig.explorerName, url: activeChainConfig.explorerUrl } }
            : undefined,
          testnet: true,
        })
      : null;

  const chains = useMemo(
    (): readonly [Chain, ...Chain[]] => {
      const all: Chain[] = [
        mainnet,
        ...(activeChain === "sepolia" ? [sepolia] : []),
        ...(ritonet ? [ritonet] : []),
        polygon,
        arbitrum,
        avalanche,
        base,
        optimism,
        fantom,
      ];

      // Keep the app's active/target chain as the default (index 0). This influences the
      // default wagmi chain when disconnected, and the initial WalletConnect session chain.
      const target: Chain =
        activeChain === "ritonet"
          ? (ritonet as Chain)
          : activeChain === "sepolia"
            ? sepolia
            : mainnet;

      const ordered = [target, ...all.filter((c) => c.id !== target.id)];
      return ordered as unknown as readonly [Chain, ...Chain[]];
    },
    [ritonet, activeChain]
  );

  const transports = useMemo<Record<number, Transport>>(() => {
    const t: Record<number, Transport> = {
      [mainnet.id]: fallback([
        ...(ALCHEMY_API_KEY
          ? [
              http(`https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`),
              webSocket(`wss://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`),
            ]
          : []),
        http("https://eth.llamarpc.com"),
        http("https://rpc.ankr.com/eth"),
        http("https://cloudflare-eth.com"),
      ]),
      [polygon.id]: fallback([
        ...(ALCHEMY_API_KEY
          ? [
              http(`https://polygon-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`),
              webSocket(`wss://polygon-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`),
            ]
          : []),
        http("https://polygon-rpc.com"),
        http("https://rpc.ankr.com/polygon"),
        http("https://polygon.llamarpc.com"),
      ]),
      [arbitrum.id]: fallback([
        ...(ALCHEMY_API_KEY
          ? [
              http(`https://arb-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`),
              webSocket(`wss://arb-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`),
            ]
          : []),
        http("https://arb1.arbitrum.io/rpc"),
        http("https://rpc.ankr.com/arbitrum"),
        http("https://arbitrum.llamarpc.com"),
      ]),
      [avalanche.id]: fallback([
        ...(ALCHEMY_API_KEY
          ? [
              http(`https://avax-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`),
              webSocket(`wss://avax-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`),
            ]
          : []),
        http("https://api.avax.network/ext/bc/C/rpc"),
        http("https://rpc.ankr.com/avalanche"),
        http("https://avalanche.drpc.org"),
      ]),
      [base.id]: fallback([
        ...(ALCHEMY_API_KEY
          ? [
              http(`https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`),
              webSocket(`wss://base-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`),
            ]
          : []),
        http("https://mainnet.base.org"),
        http("https://base.llamarpc.com"),
        http("https://rpc.ankr.com/base"),
      ]),
      [optimism.id]: fallback([
        ...(ALCHEMY_API_KEY
          ? [
              http(`https://opt-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`),
              webSocket(`wss://opt-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`),
            ]
          : []),
        http("https://mainnet.optimism.io"),
        http("https://rpc.ankr.com/optimism"),
        http("https://optimism.llamarpc.com"),
      ]),
      [fantom.id]: fallback([
        ...(ALCHEMY_API_KEY
          ? [
              http(`https://fantom-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`),
              webSocket(`wss://fantom-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`),
            ]
          : []),
        http("https://rpc.ftm.tools"),
        http("https://rpc.ankr.com/fantom"),
        http("https://fantom.drpc.org"),
      ]),
    };

    if (ritonet) {
      t[ritonet.id] = http(activeChainConfig.rpcUrl);
    }

    if (activeChain === "sepolia") {
      t[sepolia.id] = fallback([
        ...(ALCHEMY_API_KEY
          ? [
              http(`https://eth-sepolia.g.alchemy.com/v2/${ALCHEMY_API_KEY}`),
              webSocket(`wss://eth-sepolia.g.alchemy.com/v2/${ALCHEMY_API_KEY}`),
            ]
          : []),
        http("https://rpc.sepolia.org"),
        http("https://sepolia.drpc.org"),
        http("https://rpc.ankr.com/eth_sepolia"),
      ]);
    }

    return t;
  }, [ritonet, activeChain, ALCHEMY_API_KEY, activeChainConfig.rpcUrl]);

  const connectors = useMemo(() => {
    if (isClient && wcProjectId) {
      return [
        injected({ shimDisconnect: true }),
        walletConnect({
          projectId: wcProjectId,
          showQrModal: false,
          isNewChainsStale: false,
          metadata: {
            name: publicEnv.NEXT_PUBLIC_APP_NAME,
            description: publicEnv.NEXT_PUBLIC_APP_DESCRIPTION,
            url: BASE_URL,
            icons: [`${BASE_URL}/icon.png`],
          },
        }),
      ] as const;
    }
    return [injected({ shimDisconnect: true })] as const;
  }, [isClient, wcProjectId, BASE_URL]);

  const config = useMemo(
    () =>
      createConfig({
        chains,
        transports,
        connectors,
        ssr: false,
      }),
    [chains, transports, connectors]
  );

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <DappChainProvider>
          <RateLimitModalProvider>{children}</RateLimitModalProvider>
        </DappChainProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

// dapp/app/lib/mcp/tools/keynft-manage.ts
//
// Manage the "OnePerWalletKeyToken" NFT using the chatbot's signer (AI_PRIVATE_KEY).
// Actions:
//  - query: read current token + color props for the signer (no tx)
//  - burn:  if a token exists, burn it; else return "no NFT"
//  - mint:  if a token exists, burn it first, then mint a new one; return new token + colors
//
// Works on both local RitoNet and public chains (Sepolia/Mainnet) because:
//  - Reads (eth_call) use the existing callContract helper (active RPC from chain config)
//  - Writes use viem wallet/public clients bound to getChainConfig().rpcUrl (Alchemy for public chains, local RPC for RitoNet)
//  - Explorer URLs come from getChainConfig().explorerUrl when available
//
// Security: JWT-gated (same as send-crypto). Never exposes the private key.

import { createLogger } from '@logger';
import type { Tool } from '@schemas/domain/tool';
import { createTool, jsonResult, textResult } from './types';
import { fail, errorResultShape } from './tool-errors';

import { aiServerConfig } from '@config/ai.server';
import { KEY_TOKEN_ADDRESS, fullKeyTokenAbi } from '@config/contracts';
import { getChainConfig } from '@config/chain';
import { callContract } from '../utils/contracts';

import {
  createWalletClient,
  createPublicClient,
  http,
  type Hex,
  type Abi,
  type Chain,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import type { ToolInputMap } from '../generated/tool-catalog-types';

const logger = createLogger('keynft-manage');

type Action = ToolInputMap['manage_key_nft']['action'];

type Params = { action: Action };

const InputSchema: Record<string, unknown> = {
  type: 'object',
  additionalProperties: false,
  properties: {
    action: {
      type: 'string',
      description: 'One of "mint" | "burn" | "query"',
      enum: ['mint', 'burn', 'query'],
    },
  },
  required: ['action'],
};

type TimelineEvent = {
  phase: 'query' | 'burn' | 'mint' | 'result' | 'error';
  message: string;
  hash?: string;
  url?: string;
  tokenId?: string;
};

function toTimeline(phase: TimelineEvent['phase'], message: string, extra?: Partial<TimelineEvent>): TimelineEvent {
  return { phase, message, ...(extra || {}) };
}

function shortAddr(addr: string): string {
  return /^0x[a-fA-F0-9]{40}$/i.test(addr) ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : addr;
}

async function getOwnedToken(owner: `0x${string}`): Promise<{ hasToken: boolean; tokenId?: bigint }> {
  // getTokenOfOwner(address) → (tokenId, hasToken)
  try {
    const [tokenId, hasToken] = await callContract<[bigint, boolean]>({
      abi: fullKeyTokenAbi as unknown as Abi,
      address: KEY_TOKEN_ADDRESS,
      functionName: 'getTokenOfOwner',
      args: [owner],
    });
    return hasToken ? { hasToken: true, tokenId } : { hasToken: false };
  } catch {
    // Fallback path if contract doesn’t have getTokenOfOwner (defensive):
    // tokensOfOwner(address) → uint256[]
    const arr = await callContract<bigint[]>({
      abi: fullKeyTokenAbi as unknown as Abi,
      address: KEY_TOKEN_ADDRESS,
      functionName: 'tokensOfOwner',
      args: [owner],
    });
    if (arr && arr.length > 0) return { hasToken: true, tokenId: arr[0] };
    return { hasToken: false };
  }
}

async function getTokenColors(tokenId: bigint): Promise<{ backgroundColor?: string; keyColor?: string }> {
  try {
    const [backgroundColor, keyColor] = await callContract<[string, string]>({
      abi: fullKeyTokenAbi as unknown as Abi,
      address: KEY_TOKEN_ADDRESS,
      functionName: 'getTokenColors',
      args: [tokenId],
    });
    return { backgroundColor, keyColor };
  } catch {
    // If colors aren’t implemented, return empty
    return {};
  }
}

function buildExplorerUrl(hash: Hex | string | undefined | null): string | undefined {
  if (!hash) return undefined;
  const { explorerUrl } = getChainConfig();
  if (!explorerUrl) return undefined;
  const base = explorerUrl.replace(/\/+$/, '');
  return `${base}/tx/${hash}`;
}

async function getSignerClients() {
  type SecretsLike = { aiPrivateKey?: `0x${string}` };
  const priv = (aiServerConfig.secrets as unknown as SecretsLike).aiPrivateKey;
  if (!priv) fail('keynft-manage is unavailable: AI_PRIVATE_KEY not configured.');

  const chainCfg = getChainConfig(); // active chain (RitoNet or public)
  const rpcUrl = chainCfg.rpcUrl;
  const chainId: number | undefined = (chainCfg as { chainId?: number }).chainId;

  const account = privateKeyToAccount(priv);
  const walletClient = createWalletClient({ account, transport: http(rpcUrl) });
  const publicClient = createPublicClient({ transport: http(rpcUrl) });

  const chainParam: Chain | undefined = chainId ? ({ id: chainId } as unknown as Chain) : undefined;
  return { account, walletClient, publicClient, chainParam, chainCfg };
}

const tool: Tool<Params> = {
  name: 'manage_key_nft',
  description:
    'Manage the Key NFT for the chatbot signer (AI_PRIVATE_KEY). Actions: "query" (read), "burn" (burn existing), "mint" (burn existing if any, then mint new). Returns concise text and JSON with timeline + tx URLs.',
  requiresJwt: true, // gate like send-crypto
  inputSchema: InputSchema,

  async handler({ action }: Params) {
    try {
      const { account, walletClient, publicClient, chainParam } = await getSignerClients();
      const who = account.address as `0x${string}`;
      const timeline: TimelineEvent[] = [];

      // Always start by checking ownership so we can narrate properly
      timeline.push(toTimeline('query', `Querying NFT for ${shortAddr(who)}…`));
      const own = await getOwnedToken(who);

      if (action === 'query') {
        if (!own.hasToken) {
          const text = textResult(`No Key NFT found for ${shortAddr(who)}.`);
          const json = jsonResult({
            address: KEY_TOKEN_ADDRESS,
            owner: who,
            hasToken: false,
            timeline,
          });
          return { content: [...text.content, ...json.content] };
        }

        const tokenId = own.tokenId!;
        const colors = await getTokenColors(tokenId);
        timeline.push(toTimeline('result', `Found token #${tokenId}`, { tokenId: tokenId.toString() }));

        const summary = `Key NFT exists for ${shortAddr(who)} — token #${tokenId}` +
          (colors.backgroundColor || colors.keyColor
            ? ` (bg: ${colors.backgroundColor ?? '—'}, key: ${colors.keyColor ?? '—'})`
            : '');

        const text = textResult(summary);
        const json = jsonResult({
          address: KEY_TOKEN_ADDRESS,
          owner: who,
          hasToken: true,
          tokenId: tokenId.toString(),
          colors,
          timeline,
        });
        return { content: [...text.content, ...json.content] };
      }

      if (action === 'burn') {
        if (!own.hasToken) {
          const text = textResult(`No Key NFT to burn for ${shortAddr(who)}.`);
          const json = jsonResult({
            address: KEY_TOKEN_ADDRESS,
            owner: who,
            hasToken: false,
            timeline,
          });
          return { content: [...text.content, ...json.content] };
        }

        const tokenId = own.tokenId!;
        timeline.push(toTimeline('burn', `Burning token #${tokenId}…`));

        const burnHash = await walletClient.writeContract({
          address: KEY_TOKEN_ADDRESS,
          abi: fullKeyTokenAbi as unknown as Abi,
          functionName: 'burn',
          args: [tokenId],
          chain: chainParam,
        });

        const burnRcpt = await publicClient.waitForTransactionReceipt({ hash: burnHash, timeout: 90_000 });
        const burnUrl = buildExplorerUrl(burnHash);
        timeline.push(toTimeline('result', `Burned token #${tokenId}`, { hash: burnHash, url: burnUrl, tokenId: tokenId.toString() }));

        const text = textResult(
          `Burned Key NFT #${tokenId} for ${shortAddr(who)}.\nTx: ${burnUrl ?? burnHash}`
        );
        const json = jsonResult({
          address: KEY_TOKEN_ADDRESS,
          owner: who,
          action: 'burn',
          burnedTokenId: tokenId.toString(),
          burn: {
            hash: burnHash,
            url: burnUrl,
            status: burnRcpt.status,
          },
          timeline,
        });
        return { content: [...text.content, ...json.content] };
      }

      // action === 'mint'
      let burnedTokenId: bigint | undefined;
      let burnHash: Hex | undefined;
      let burnUrl: string | undefined;

      if (own.hasToken) {
        burnedTokenId = own.tokenId!;
        timeline.push(toTimeline('burn', `Existing token #${burnedTokenId} found — burning before mint…`));

        burnHash = await walletClient.writeContract({
          address: KEY_TOKEN_ADDRESS,
          abi: fullKeyTokenAbi as unknown as Abi,
          functionName: 'burn',
          args: [burnedTokenId],
          chain: chainParam,
        });
        await publicClient.waitForTransactionReceipt({ hash: burnHash, timeout: 120_000 });
        burnUrl = buildExplorerUrl(burnHash);
        timeline.push(toTimeline('result', `Burned token #${burnedTokenId}`, { hash: burnHash, url: burnUrl, tokenId: burnedTokenId.toString() }));
      } else {
        timeline.push(toTimeline('burn', `No existing token — skipping burn.`));
      }

      timeline.push(toTimeline('mint', `Minting new Key NFT…`));

      const mintHash = await walletClient.writeContract({
        address: KEY_TOKEN_ADDRESS,
        abi: fullKeyTokenAbi as unknown as Abi,
        functionName: 'mint',
        args: [],
        chain: chainParam,
      });

      const mintRcpt = await publicClient.waitForTransactionReceipt({ hash: mintHash, timeout: 120_000 });
      const mintUrl = buildExplorerUrl(mintHash);

      // Re-query to learn the new tokenId & colors
      const after = await getOwnedToken(who);
      let newTokenId: bigint | undefined;
      let colors: { backgroundColor?: string; keyColor?: string } = {};

      if (after.hasToken && after.tokenId !== undefined) {
        newTokenId = after.tokenId;
        colors = await getTokenColors(newTokenId);
        timeline.push(
          toTimeline('result', `Minted token #${newTokenId}`, {
            hash: mintHash,
            url: mintUrl,
            tokenId: newTokenId.toString(),
          }),
        );
      } else {
        // Extremely unlikely if tx succeeded; still narrate something meaningful.
        timeline.push(
          toTimeline('result', `Mint transaction confirmed, but token not detected on re-query.`, {
            hash: mintHash,
            url: mintUrl,
          }),
        );
      }

      // Build outputs
      const colorStr =
        colors.backgroundColor || colors.keyColor
          ? ` (bg: ${colors.backgroundColor ?? '—'}, key: ${colors.keyColor ?? '—'})`
          : '';

      const textLines: string[] = [];
      textLines.push(`Key NFT minted for ${shortAddr(who)}.`);
      if (burnedTokenId) textLines.push(`Previous token #${burnedTokenId} burned. Tx: ${burnUrl ?? burnHash}`);
      if (newTokenId !== undefined) textLines.push(`New token #${newTokenId}${colorStr}. Tx: ${mintUrl ?? mintHash}`);

      const text = textResult(textLines.join('\n'));
      const json = jsonResult({
        address: KEY_TOKEN_ADDRESS,
        owner: who,
        action: 'mint',
        burnedTokenId: burnedTokenId?.toString(),
        burn: burnedTokenId
          ? { hash: burnHash, url: burnUrl, status: 'success' }
          : null,
        mint: { hash: mintHash, url: mintUrl, status: mintRcpt.status },
        tokenId: newTokenId?.toString(),
        colors,
        timeline,
      });

      return { content: [...text.content, ...json.content] };
    } catch (err: unknown) {
      // For non-Error throwables, return the generic message expected by tests.
      const message = err instanceof Error ? err.message : undefined;
      logger.error('keynft-manage failed', { error: message ?? err });
      return errorResultShape(message || 'Key NFT manage failed');
    }
  },
};

export default createTool(tool);

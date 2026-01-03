/* dapp/app/lib/mcp/tools/send-crypto-agent.ts */
import { createLogger } from '@logger';
import type { Tool } from '@schemas/domain/tool';
import { createTool } from './types';
import { fail, errorResultShape } from './tool-errors';
import { aiServerConfig } from '@config/ai.server';
import { providerRegistry } from '@lib/llm/providers/registry';

import { getChainConfig } from '@config/chain';
import { CHAIN_IDS, formatChainName } from '../utils/chains';
import type { SupportedChain } from '@schemas/domain/chains';

import { getTokenModel, prisma } from '@lib/prisma/prismaNetworkUtils';

const logger = createLogger('send-crypto-agent');

const AGENT_MODEL_INDEX = 2;

// Input schema includes optional messages array for fallback extraction of user reason.
const InputSchema: Record<string, unknown> = {
  type: 'object',
  additionalProperties: false,
  properties: {
    reason: {
      type: 'string',
      description: 'Optional justification from the user for receiving crypto; can be empty.',
    },
    userAddress: {
      type: 'string',
      description: 'Ethereum address of the user (for display only).',
    },
    messages: {
      type: 'array',
      description: 'Optional chat history; used as fallback to extract the user message if reason is not provided.',
      items: {
        type: 'object',
        properties: {
          role: { type: 'string', enum: ['user', 'assistant', 'system'] },
          content: { type: 'string' },
        },
        required: ['role', 'content'],
      },
    },
  },
};

type Message = { role: 'user' | 'assistant' | 'system'; content: string };
type Params = {
  reason?: string;
  userAddress?: string;
  messages?: Message[];
  __jwt?: Record<string, unknown>; // injected
};

type LLMInvoker = { invoke: (messages: unknown) => Promise<unknown> };
type ActiveChainLike = {
  chainId?: number;
  chain?: { id?: number; chainId?: number };
};
type TokenModel = {
  findUnique: (args: { where: { tokenId: number }; select: { used: true; usedBy: true; usedAt: true } }) => Promise<{ used: boolean } | null>;
};

// Helper: LLM selection (agent model index)
function getAgentLLM(): LLMInvoker {
  const p = providerRegistry.getProvider({
    modelIndex: AGENT_MODEL_INDEX,
    streaming: false,
    maxTokens: Math.min(aiServerConfig.limits.maxOutputTokens ?? 1024, 256),
  }) as unknown as LLMInvoker;
  return p;
}

type ToolContentItem = { type?: unknown; text?: unknown; data?: unknown };
type ToolResultLike = { content?: ToolContentItem[]; isError?: unknown };

async function callMCPTool(
  toolName: string,
  args: Record<string, unknown>,
  jwt?: Record<string, unknown>
): Promise<{ text: string; data: unknown; isError?: boolean }> {
  const { toolRegistry } = await import('../tools');
  const def = toolRegistry.get(toolName);
  if (!def) throw new Error(`Tool not found: ${toolName}`);

  const merged = jwt ? { ...args, __jwt: jwt } : args;
  const result = (await def.handler(merged)) as unknown as ToolResultLike;

  const content = Array.isArray(result?.content) ? result.content : [];

  const text = content
    .filter((c) => c?.type === 'text' && typeof c.text === 'string')
    .map((c) => String(c.text))
    .join('\n');

  const jsonItem = content.find((c) => c?.type === 'json');
  const json = (jsonItem && (jsonItem.data as unknown)) ?? undefined;

  return { text, data: json ?? null, isError: Boolean(result?.isError) };
}

// ---- Persona helpers (paired spectra) --------------------------------------

/** random integer in [min, max] inclusive */
function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Sample a paired spectrum where A + B = 10, with both in 1..9 (no zeros).
 * Returns { a, b } where a in 1..9 and b = 10 - a in 1..9.
 */
function pairedSpectrum(): { a: number; b: number } {
  const a = randInt(1, 9);
  const b = 10 - a;
  return { a, b };
}

/**
 * Persona with two axes:
 * - grumpy vs kind
 * - greedy vs generous
 * Each axis sums to 10, each side is in 1..9.
 */
function samplePersona() {
  const gk = pairedSpectrum();    // grumpy/kind
  const gg = pairedSpectrum();    // greedy/generous
  return {
    // Important: keep names stable for logs & policies
    grumpy: gk.a,
    kind: gk.b,
    greedy: gg.a,
    generous: gg.b,
    meta: { // optional meta if you want to display the invariant
      pairSum: 10,
    },
  };
}

// ---------------------------------------------------------------------------

function short(addr?: string) {
  if (!addr || typeof addr !== 'string') return '';
  return /^0x[a-fA-F0-9]{40}$/.test(addr) ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : addr;
}

function chainKeyFromId(id: number): SupportedChain | null {
  for (const [k, v] of Object.entries(CHAIN_IDS)) {
    if (v === id) return k as SupportedChain;
  }
  return null;
}

function clampAmount(a: unknown): number | null {
  const n = Number(a);
  if (!Number.isFinite(n)) return null;
  if (n < 0.1) return 0.1;
  if (n > 0.3) return 0.3;
  return Number(n.toFixed(6));
}

function parseJsonLoose(s: string): unknown | null {
  if (!s) return null;
  try { return JSON.parse(s); } catch {}
  const m = s.match(/```json\s*([\s\S]*?)```/i);
  if (m) {
    try { return JSON.parse(m[1]); } catch {}
  }
  const i = s.indexOf('{');
  const j = s.lastIndexOf('}');
  if (i >= 0 && j >= i) {
    try { return JSON.parse(s.slice(i, j + 1)); } catch {}
  }
  return null;
}

function coerceToText(raw: unknown): string {
  if (typeof raw === 'string') return raw;
  if (raw && typeof raw === 'object') {
    const maybeContent = (raw as { content?: unknown }).content;
    if (typeof maybeContent === 'string') return maybeContent;
    if (Array.isArray(maybeContent)) {
      const first = maybeContent[0] as { text?: unknown } | undefined;
      if (first && typeof first.text === 'string') return first.text;
    }
  }
  try { return JSON.stringify(raw); } catch { return String(raw); }
}

const tool: Tool<Params> = {
  name: 'send_crypto_agent',
  description:
    'Autonomous role-playing agent that decides whether to send ETH to the authenticated user. ' +
    'Pass user justification in "reason" (optional). If absent, pass "messages" (chat history) and the agent will extract the last user message. ' +
    'Agent performs read-only membership checks and may send 0.1–0.3 ETH if it decides to approve. ' +
    'Wealth alone never determines eligibility. Persona spectra are paired: (grumpy, kind) and (greedy, generous) each sum to 10.',
  requiresJwt: true,
  inputSchema: InputSchema,

  async handler(params: Params) {
    try {
      const jwt = params.__jwt;
      const userAddress: string | undefined =
        params.userAddress ||
        (jwt && typeof jwt === 'object'
          ? (jwt as Record<string, unknown>).address?.toString?.() ||
            (jwt as Record<string, unknown>).addr?.toString?.() ||
            (jwt as Record<string, unknown>).sub?.toString?.()
          : undefined);

      if (!userAddress) fail('User address not available from JWT or parameters');

      // Persona (session-scoped for this call) — paired spectra
      const persona = samplePersona();

      // Log persona disposition immediately (structured)
      logger.info('Persona disposition sampled', { persona, userAddress });

      // Determine reason: explicit param -> fallback to last user message in messages -> empty
      let reason = (params.reason ?? '').toString().trim();

      if (!reason && Array.isArray(params.messages)) {
        const msgs = params.messages as Message[];
        for (let i = msgs.length - 1; i >= 0; i--) {
          const m = msgs[i];
          if (m?.role === 'user' && typeof m.content === 'string' && m.content.trim().length > 0) {
            reason = m.content.trim();
            logger.info('Extracted reason from messages fallback', { userAddress, reason: reason.slice(0, 200) });
            break;
          }
        }
      }

      logger.info('Agent execution start', {
        userAddress,
        hasReason: Boolean(reason),
        reasonPreview: reason ? `${reason.slice(0,120)}${reason.length>120?'…':''}` : null,
        agentModel: aiServerConfig.getModel(AGENT_MODEL_INDEX),
        persona,
      });

      const traces: string[] = [];

      // Quick heuristic: harsh persona + weak reason -> immediate decline (fast path)
      // (still compatible with paired spectra since fields remain the same)
      const harsh = persona.greedy >= 8 && persona.grumpy >= 7;
      const weakReason = !reason || reason.length < 12;

      if (harsh && weakReason) {
        const output = `Declined. Reason too weak; persona leaned harsh (greedy ${persona.greedy}/10, grumpy ${persona.grumpy}/10). Wealth alone never determines eligibility.`;
        const json = {
          success: true,
          decision: 'deny' as const,
          reason: 'Reason provided was too weak; skipped checks due to harsh persona.',
          persona,
          considered: { usedBalanceCheck: false, usedMembershipCheck: false },
          trace: [...traces, 'skipped_checks_persona+weak_reason'],
          userAddress,
          facts: { userReason: reason || null },
          timestamp: new Date().toISOString(),
        };
        logger.info('Agent quick-decline', { userAddress, persona, reasonProvided: Boolean(reason) });
        return { content: [{ type: 'text', text: output }, { type: 'json', data: json }] };
      }

      // Determine active chain
      const activeUnknown = getChainConfig() as unknown;
      const active = (activeUnknown ?? {}) as Partial<ActiveChainLike>;
      const chainId: number | undefined =
        typeof active.chainId === 'number'
          ? active.chainId
          : typeof active.chain?.id === 'number'
          ? active.chain.id
          : typeof active.chain?.chainId === 'number'
          ? active.chain.chainId
          : undefined;
      const chainKey = chainId ? chainKeyFromId(chainId) : null;
      const chainName = chainKey ? formatChainName(chainKey) : `Chain ${chainId ?? '?'}`;

      // 1) Check balance (active chain) - read-only tool call
      traces.push('check_balance:start');
      let balanceEth: number | null = null;
      try {
        const balanceRes = await callMCPTool(
          'get_eth_balance',
          { address: userAddress, chain: chainKey ?? 'sepolia' },
          jwt
        );
        const data = balanceRes.data as { balanceEth?: unknown } | null;
        if (data && data.balanceEth != null) balanceEth = Number(data.balanceEth);
        else {
          const m = (balanceRes.text ?? '').match(/(\d+\.?\d*)\s*(ETH|MATIC|AVAX|FTM)/i);
          if (m) balanceEth = parseFloat(m[1]);
        }
        traces.push(`check_balance:done:${balanceEth ?? 'unknown'}`);
        logger.info('Balance check', { userAddress, chainName, balanceEth, persona });
      } catch (e) {
        traces.push('check_balance:error');
        logger.warn('Balance check failed', { userAddress, err: e instanceof Error ? e.message : String(e), persona });
      }

      // 2) Membership: call key_nft_read then read prisma token used flag (read-only)
      traces.push('check_membership:start');
      let hasKey = false;
      let tokenId: string | null = null;
      let used: boolean | null = null;

      try {
        const keyRes = await callMCPTool(
          'key_nft_read',
          { action: 'get_key_nft_token_of_owner', owner: userAddress },
          jwt
        );
        const k = keyRes.data as { hasToken?: unknown; tokenId?: unknown } | null;
        hasKey = Boolean(k && k.hasToken);
        tokenId = hasKey ? String(k?.tokenId ?? '') : null;

        if (hasKey && tokenId && /^\d+$/.test(tokenId)) {
          const Token = getTokenModel(prisma) as unknown as TokenModel;
          const rec = await Token.findUnique({
            where: { tokenId: Number(tokenId) },
            select: { used: true, usedBy: true, usedAt: true },
          });
          used = rec?.used ?? false;
        } else {
          used = null;
        }

        traces.push(`check_membership:done:hasKey=${hasKey}${used !== null ? `,used=${used}` : ''}`);
        logger.info('Membership check', { userAddress, hasKey, tokenId, used, persona });
      } catch (e) {
        traces.push('check_membership:error');
        logger.warn('Membership check failed', { userAddress, err: e instanceof Error ? e.message : String(e), persona });
      }

      // 3) LLM deliberation (short, JSON-only preference)
      const llm = getAgentLLM();
      const system = [
        'You are Send-Crypto Agent, a fair but decisive on-chain benefactor.',
        'You neither gain nor lose from sending or withholding crypto.',
        'Persona values influence tone but do NOT determine final outcome.',
        'Rules:',
        '- If user has NO key NFT → decline (not a member).',
        '- If user has a key NFT BUT it is USED → decline (no longer a member).',
        // balance is soft:
        '- If user balance > 2 ETH → treat as a negative factor (user is not broke). Do NOT auto-deny. Eligibility is NOT determined solely by wealth.',
        'If you decide to send, choose 0.1–0.3 ETH (inclusive).',
        'Return ONLY JSON: {"decision":"send"|"deny","reason":"...","amountEth": optional number}',
      ].join('\n');

      const facts = {
        userAddress,
        chain: { id: chainId, name: chainName },
        balanceEth,
        membership: { hasKey, tokenId, used },
        persona,
        userReason: reason || null,
      };

      traces.push('deliberate:start');
      logger.info('Deliberation start', { userAddress, persona, shortFacts: { balanceEth, hasKey, used } });

      let decision: 'send' | 'deny' = 'deny';
      let decisionReason = 'No decision made.';
      let amountEth: number | null = null;

      try {
        const msg = [
          { role: 'system', content: system },
          {
            role: 'user',
            content:
              'Facts:\n' +
              JSON.stringify(facts) +
              '\nRespond ONLY with JSON: {"decision": "...", "reason": "...", "amountEth": optional number}\n',
          },
        ];

        const raw = await llm.invoke(msg);
        const text = coerceToText(raw);

        const parsed = parseJsonLoose(text) ?? {};
        const json = (parsed && typeof parsed === 'object') ? (parsed as Record<string, unknown>) : {};
        const d = String(json['decision'] || '').toLowerCase();
        if (d === 'send' || d === 'deny') decision = d as 'send' | 'deny';
        decisionReason = typeof json['reason'] === 'string' && json['reason'].trim()
          ? (json['reason'] as string).trim()
          : 'No reason provided.';
        amountEth = clampAmount(json['amountEth']);

        traces.push('deliberate:done');
        logger.info('Deliberation result', { userAddress, decision, amountEth, persona });
      } catch (e) {
        traces.push('deliberate:error');
        logger.warn('Deliberation failed', { userAddress, err: e instanceof Error ? e.message : String(e), persona });
      }

      // 4) Constraints bucket: HARD vs SOFT
      const hardReasons: string[] = [];
      const softSignals: string[] = [];

      // HARD (non-negotiable)
      if (hasKey === false) hardReasons.push('No key NFT (not a member).');
      if (used === true) hardReasons.push('Key NFT is marked as used (no longer a member).');

      // SOFT (advisory)
      if (balanceEth != null && balanceEth > 2) {
        softSignals.push('User balance > 2 ETH (user is not broke). Eligibility is NOT determined solely by wealth.');
      }

      if (hardReasons.length > 0) {
        decision = 'deny';
        decisionReason = `${decisionReason} | Hard constraint(s): ${hardReasons.join(' ')}`;
        logger.info('Hard constraint enforced', { userAddress, hardReasons, persona });
      }

      if (softSignals.length > 0) {
        decisionReason = `${decisionReason} | Considerations: ${softSignals.join(' ')}`;
        logger.info('Soft factor noted', { userAddress, softSignals, persona });
      }

      // 5) If send -> call send_crypto_to_signed_in_user
      let actionText = '';
      let extra: Record<string, unknown> = {};

      if (decision === 'send') {
        const amt = clampAmount(amountEth ?? 0.2) ?? 0.2;
        traces.push(`send:start:${amt}`);
        logger.info('Attempting to send ETH', { userAddress, amountEth: amt, persona });

        try {
          const sendRes = await callMCPTool(
            'send_crypto_to_signed_in_user',
            { amountEth: amt },
            jwt
          );

          if (sendRes.isError) {
            actionText = `Attempted to send ${amt} ETH on ${chainName} but failed: ${sendRes.text || 'unknown error'}`;
            traces.push('send:error');
            logger.warn('Send failed', { userAddress, amountEth: amt, sendResult: sendRes.text, persona });
          } else {
            const tx = (sendRes.data ?? {}) as Record<string, unknown>;
            const to = (tx['to'] as string | undefined) ?? userAddress;
            const net = (tx['network'] as string | undefined) ?? chainName;
            const hash = tx['hash'];
            actionText = `Sent ${amt} ETH on ${net} to ${short(to)}${hash ? ` (tx ${String(hash).slice(0,10)}…${String(hash).slice(-8)})` : ''}.`;

            extra = {
              txHash: hash,
              to,
              from: tx['from'],
              chainId: (tx['chainId'] as number | undefined) ?? chainId,
              network: net,
              sentAmountEth: Number(amt.toFixed(6)),
              explorerUrl: tx['explorerUrl'],
            };
            traces.push('send:done');
            logger.info('Send succeeded', { userAddress, amountEth: amt, txHash: hash, persona });
          }
        } catch (e) {
          actionText = `Failed to send ETH: ${e instanceof Error ? e.message : String(e)}`;
          traces.push('send:error');
          logger.error('Send exception', { userAddress, err: e instanceof Error ? e.message : String(e), persona });
        }
      } else {
        actionText = 'Declined. No crypto sent.';
        logger.info('Decision to deny', { userAddress, decisionReason, persona });
      }

      const headline =
        decision === 'send'
          ? `Approved: ${actionText}`
          : `Declined: ${decisionReason}`;

      const jsonOut: Record<string, unknown> = {
        success: true,
        decision,
        reason: decisionReason,
        persona,
        considered: {
          usedBalanceCheck: traces.some(t => t.startsWith('check_balance:')),
          usedMembershipCheck: traces.some(t => t.startsWith('check_membership:')),
        },
        facts: {
          userAddress,
          chainId,
          chainName,
          balanceEth: balanceEth ?? null,
          membership: { hasKey, tokenId, used },
          userReason: reason || null,
        },
        output: actionText,
        timestamp: new Date().toISOString(),
        agentModel: aiServerConfig.getModel(AGENT_MODEL_INDEX),
        trace: traces,
        ...extra,
      };

      logger.info('Agent execution complete', { userAddress, decision, persona, traceSummary: traces.slice(-5) });

      return {
        content: [{ type: 'text', text: headline }, { type: 'json', data: jsonOut }],
      };
    } catch (error) {
      logger.error('send-crypto-agent failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return errorResultShape(error instanceof Error ? error.message : 'Agent failed');
    }
  },
};

export default createTool(tool);

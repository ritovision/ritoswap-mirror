// dapp/app/lib/mcp/tools/keynft-read/actions/owner-summary.ts
import {
  logger,
  KEY_TOKEN_ADDRESS,
  fullKeyTokenAbi,
  onePerWalletAbi,
  callContract,
  OWNER_REGEX,
  fmtColor,
} from '../shared';
import { fail, errorResultShape } from '../../tool-errors';

type Params = {
  owner?: string;
  includeColors?: boolean;
  includeURI?: boolean;
  maxTokens?: number | string;
};

type CallArg<T> = Parameters<typeof callContract<T>>[0];

export async function handleOwnerSummary({
  owner,
  includeColors = true,
  includeURI = true,
  maxTokens = 50,
}: Params) {
  if (typeof owner !== 'string' || !OWNER_REGEX.test(owner)) {
    fail('Invalid owner address (must be 0x-prefixed 40-hex characters)');
  }
  if (/^0x0{40}$/i.test(owner)) {
    fail('Invalid owner address (zero address)');
  }

  try {
    const [balance, tokenIdsRaw, onePerRes] = await Promise.all([
      callContract<bigint>({
        abi: fullKeyTokenAbi as unknown as CallArg<bigint>['abi'],
        address: KEY_TOKEN_ADDRESS,
        functionName: 'balanceOf',
        args: [owner],
      }),
      callContract<bigint[]>({
        abi: fullKeyTokenAbi as unknown as CallArg<bigint[]>['abi'],
        address: KEY_TOKEN_ADDRESS,
        functionName: 'tokensOfOwner',
        args: [owner],
      }),
      callContract<[bigint, boolean]>({
        abi: onePerWalletAbi as unknown as CallArg<[bigint, boolean]>['abi'],
        address: KEY_TOKEN_ADDRESS,
        functionName: 'getTokenOfOwner',
        args: [owner],
      }).catch(() => [0n, false] as [bigint, boolean]),
    ]);

    const singleTokenId = onePerRes?.[0];
    const hasToken = onePerRes?.[1] ?? false;

    let tokenIds: bigint[] = tokenIdsRaw ?? [];
    if ((tokenIds.length ?? 0) === 0 && hasToken && typeof singleTokenId === 'bigint') {
      tokenIds = [singleTokenId];
    }

    // ⬅️ explicit type for the mapper parameter
    const tokenIdsStr = (tokenIds || []).map((x: bigint) => x.toString());

    const cap = Math.max(1, Math.min(Number(maxTokens) || 50, tokenIds.length));
    const idsToEnrich = tokenIds.slice(0, cap);

    const tokens =
      idsToEnrich.length === 0
        ? []
        : await Promise.all(
            // ⬅️ explicit type for `id`
            idsToEnrich.map(async (id: bigint) => {
              const [colors, uri] = await Promise.all([
                includeColors
                  ? callContract<[string, string]>({
                      abi: fullKeyTokenAbi as unknown as CallArg<[string, string]>['abi'],
                      address: KEY_TOKEN_ADDRESS,
                      functionName: 'getTokenColors',
                      args: [id],
                    })
                  : Promise.resolve(undefined),
                includeURI
                  ? callContract<string>({
                      abi: fullKeyTokenAbi as unknown as CallArg<string>['abi'],
                      address: KEY_TOKEN_ADDRESS,
                      functionName: 'tokenURI',
                      args: [id],
                    })
                  : Promise.resolve(undefined),
              ]);
              const backgroundColor = colors?.[0];
              const keyColor = colors?.[1];
              return {
                tokenId: id.toString(),
                tokenURI: uri,
                colors: colors ? { backgroundColor, keyColor } : undefined,
              };
            }),
          );

    const payload = {
      address: KEY_TOKEN_ADDRESS,
      owner,
      balance: balance.toString(),
      tokenIds: tokenIdsStr,
      enrichedCount: tokens.length,
      tokens,
    };

    const count = tokenIdsStr.length;
    const lines = [`Fetched Owner Summary.`, `${owner} has ${count} token${count === 1 ? '' : 's'}`];

    if (tokens.length > 0 && tokens[0]) {
      const first = tokens[0];
      const bg = fmtColor(first.colors?.backgroundColor) ?? 'N/A';
      const key = fmtColor(first.colors?.keyColor) ?? 'N/A';
      lines[1] += `\nProperties: TokenID #${first.tokenId}, BG ${bg}, KeyColor ${key} (${KEY_TOKEN_ADDRESS})`;
    }

    const summary = lines.join('\n');
    return { content: [{ type: 'text', text: summary }, { type: 'json', data: payload }] };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to build owner summary';
    logger.error('owner summary failed', { owner, err: String(e) });
    return errorResultShape(msg);
  }
}

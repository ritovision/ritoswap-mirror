/*
// dapp/app/lib/mcp/tools/keynft-read/actions/token-metadata.ts
*/
import {
  logger,
  KEY_TOKEN_ADDRESS,
  fullKeyTokenAbi,
  callContract,
} from '../shared';
import { fail, errorResultShape } from '../../tool-errors';

type Params = { tokenId?: string; includeColors?: boolean; includeURI?: boolean };
type CallArg<T> = Parameters<typeof callContract<T>>[0];

export async function handleTokenMetadata({
  tokenId,
  includeColors = true,
  includeURI = true,
}: Params) {
  if (typeof tokenId !== 'string' || !/^\d+$/.test(tokenId)) {
    fail('Invalid tokenId (must be a non-negative integer string)');
  }

  try {
    const id = BigInt(tokenId);

    const colorsPromise = includeColors
      ? callContract<[string, string]>({
          abi: fullKeyTokenAbi as unknown as CallArg<[string, string]>['abi'],
          address: KEY_TOKEN_ADDRESS,
          functionName: 'getTokenColors',
          args: [id],
        })
      : Promise.resolve(undefined);

    const uriPromise = includeURI
      ? callContract<string>({
          abi: fullKeyTokenAbi as unknown as CallArg<string>['abi'],
          address: KEY_TOKEN_ADDRESS,
          functionName: 'tokenURI',
          args: [id],
        })
      : Promise.resolve(undefined);

    const [colors, uri] = await Promise.all([colorsPromise, uriPromise]);

    const [backgroundColor, keyColor] = (colors ?? []) as [string | undefined, string | undefined];

    const parts: string[] = [];
    parts.push(`Token #${id.toString()}`);
    parts.push(includeURI ? (uri ? 'URI ✓' : 'URI missing') : 'URI —');
    parts.push(includeColors ? (colors ? 'Colors ✓' : 'Colors missing') : 'Colors —');
    const summary = `Fetched Token Metadata.\n${parts.join(', ')}`;

    const payload = {
      address: KEY_TOKEN_ADDRESS,
      tokenId: id.toString(),
      tokenURI: uri,
      colors: colors ? { backgroundColor, keyColor } : undefined,
    };

    return { content: [{ type: 'text', text: summary }, { type: 'json', data: payload }] };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to read token metadata';
    logger.error('token metadata failed', { tokenId, err: String(e) });
    return errorResultShape(msg);
  }
}

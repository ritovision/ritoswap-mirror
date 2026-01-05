// dapp/app/lib/mcp/tools/keynft-read/actions/holders.ts
import {
  logger,
  KEY_TOKEN_ADDRESS,
  fullKeyTokenAbi,
  callContract,
  parseDec,
  ZERO,
} from '../shared';
import { errorResultShape } from '../../tool-errors';

type Params = {
  startIndex?: number | string;
  maxTokens?: number | string;
  concurrency?: number;
};

type CallArg<T> = Parameters<typeof callContract<T>>[0];

export async function handleHolders({
  startIndex,
  maxTokens,
  concurrency = 25,
}: Params) {
  try {
    const start = parseDec(startIndex, 0n);
    const conc = Math.max(1, Math.min(200, Number(concurrency) || 25));

    const totalSupply = await callContract<bigint>({
      abi: fullKeyTokenAbi as unknown as CallArg<bigint>['abi'],
      address: KEY_TOKEN_ADDRESS,
      functionName: 'totalSupply',
    });

    if (totalSupply === 0n) {
      const payload = {
        address: KEY_TOKEN_ADDRESS,
        totalSupply: '0',
        scanned: '0',
        method: 'enumerable',
        holders: [] as Array<{ address: string; balance: string }>,
        totalHolders: 0,
      };
      const summary = `Fetched Key Holders.\n0 holders (scanned 0/0)`;
      return { content: [{ type: 'text', text: summary }, { type: 'json', data: payload }] };
    }

    const remaining = totalSupply > start ? totalSupply - start : 0n;
    const limit = maxTokens ? parseDec(maxTokens as unknown as number | string | undefined, remaining) : remaining;
    const toScan = limit > remaining ? remaining : limit;

    if (toScan <= 0n) {
      const payload = {
        address: KEY_TOKEN_ADDRESS,
        totalSupply: totalSupply.toString(),
        scanned: '0',
        method: 'enumerable',
        holders: [] as Array<{ address: string; balance: string }>,
        totalHolders: 0,
      };
      const summary = `Fetched Key Holders.\n0 holders (scanned 0/${totalSupply.toString()})`;
      return { content: [{ type: 'text', text: summary }, { type: 'json', data: payload }] };
    }

    let enumerableSupported = true;
    try {
      await callContract<bigint>({
        abi: fullKeyTokenAbi as unknown as CallArg<bigint>['abi'],
        address: KEY_TOKEN_ADDRESS,
        functionName: 'tokenByIndex',
        args: [start],
      });
    } catch {
      enumerableSupported = false;
      logger.warn('tokenByIndex unsupported; falling back to sequential ownerOf() over assumed dense IDs', {
        startIndex: start.toString(),
      });
    }

    const balances = new Map<string, bigint>();
    const total = Number(toScan);
    const baseIndex = start;
    const concClamp = Math.max(1, Math.min(200, conc));

    for (let offset = 0; offset < total; offset += concClamp) {
      const batchCount = Math.min(concClamp, total - offset);
      const tasks: Array<Promise<void>> = [];

      for (let j = 0; j < batchCount; j++) {
        const idx = BigInt(offset + j);
        tasks.push(
          (async () => {
            try {
              let tokenId: bigint;

              if (enumerableSupported) {
                tokenId = await callContract<bigint>({
                  abi: fullKeyTokenAbi as unknown as CallArg<bigint>['abi'],
                  address: KEY_TOKEN_ADDRESS,
                  functionName: 'tokenByIndex',
                  args: [baseIndex + idx],
                });
              } else {
                tokenId = baseIndex + idx;
              }

              const owner = await callContract<string>({
                abi: fullKeyTokenAbi as unknown as CallArg<string>['abi'],
                address: KEY_TOKEN_ADDRESS,
                functionName: 'ownerOf',
                args: [tokenId],
              }).catch(() => ZERO);

              if (!owner || owner === ZERO) return;

              balances.set(owner, (balances.get(owner) ?? 0n) + 1n);
            } catch (e) {
              logger.debug?.('owner lookup skipped', {
                error: e instanceof Error ? e.message : String(e),
              });
            }
          })(),
        );
      }

      await Promise.all(tasks);
    }

    const holders = Array.from(balances.entries())
      .filter(([, bal]) => bal > 0n)
      .map(([address, balance]) => ({ address, balance: balance.toString() }))
      .sort((a, b) => {
        const diff = BigInt(b.balance) - BigInt(a.balance);
        return diff === 0n ? a.address.localeCompare(b.address) : diff > 0n ? 1 : -1;
      });

    const payload = {
      address: KEY_TOKEN_ADDRESS,
      totalSupply: totalSupply.toString(),
      scanned: toScan.toString(),
      method: enumerableSupported ? 'enumerable' : 'sequential',
      holders,
      totalHolders: holders.length,
    };

    const summary = `Fetched Key Holders.\n${holders.length} holders (scanned ${toScan.toString()}/${totalSupply.toString()}) via ${payload.method}`;
    return { content: [{ type: 'text', text: summary }, { type: 'json', data: payload }] };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logger.error('holders (enumerable) failed', { err: msg });
    return errorResultShape(msg || 'Failed to enumerate holders');
  }
}

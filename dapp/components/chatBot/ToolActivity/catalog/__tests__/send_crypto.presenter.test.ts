// components/chatBot/ToolActivity/catalog/__tests__/send_crypto.presenter.test.ts
import { presenter } from '../presenters/send_crypto.presenter';
import type { ToolChipContent } from '../types';

// helper: normalize ToolChipContent into an object shape for assertions
function norm(x: ToolChipContent): { label?: string; text: string } {
  return typeof x === 'string' ? { text: x } : x;
}

// helpers to build chip-like objects quickly
const chipBase = {
  toolCallId: 'c1',
  toolName: 'send_crypto_to_signed_in_user',
  createdAt: Date.now(),
} as const;

function mkOutputJson(data: any) {
  return { content: [{ type: 'json', data }] };
}
function mkOutputText(...lines: string[]) {
  return { content: lines.map((text) => ({ type: 'text', text })) };
}

describe('send_crypto.presenter', () => {
  it('pending: label-only (empty text)', () => {
    const res = norm(presenter.pending({ ...chipBase, status: 'pending' } as any));
    expect(res).toEqual({ label: 'Sending Crypto', text: '' });
  });

  it('success: formats amount, shortens address, normalizes network name', () => {
    const addr = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'; // 40 hex chars
    const out = presenter.success({
      ...chipBase,
      status: 'success',
      input: { amountEth: 0.5 },
      output: mkOutputJson({ amountEth: 1.23456789, to: addr, network: 'sepolia' }),
    } as any);

    const res = norm(out);
    expect(res.label).toBe('Sent Crypto.');

    // amount rounded to 6 dp
    expect(res.text).toMatch(/1\.234568 ETH sent to/i);

    // shortened address + capitalized network name
    const short = `${addr.slice(0, 6)}…${addr.slice(-4)}`;
    expect(res.text).toContain(short);
    expect(res.text).toMatch(/ on Sepolia$/i);
  });

  it('success: falls back to input amount when json has no amount', () => {
    const addr = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
    const out = presenter.success({
      ...chipBase,
      status: 'success',
      input: { amountEth: '0.1234567' },
      output: mkOutputJson({ to: addr, chainId: 11155111 }),
    } as any);

    const res = norm(out);

    // trimmed leading zero for 0.x -> ".x"
    expect(res.text.startsWith('.123457 ETH sent to')).toBe(true);

    const short = `${addr.slice(0, 6)}…${addr.slice(-4)}`;
    expect(res.text).toContain(short);
    expect(res.text).toMatch(/ on Chain 11155111$/);
  });

  it('success: falls back to legacy text content if no json', () => {
    const out = presenter.success({
      ...chipBase,
      status: 'success',
      output: mkOutputText('Transaction sent', 'Hash: 0x123'),
    } as any);

    const res = norm(out);
    expect(res).toEqual({ label: 'Sent Crypto.', text: 'Transaction sent\nHash: 0x123' });
  });

  it('error: wallet-friendly hint for wallet-like errors', () => {
    const friendly = norm(
      presenter.error({
        ...chipBase,
        status: 'error',
        errorText: 'Please connect wallet first',
      } as any)
    );
    expect(friendly).toEqual({
      label: 'Failed to Send Crypto.',
      text: 'Your wallet must be connected to use this',
    });

    const passthrough = norm(
      presenter.error({
        ...chipBase,
        status: 'error',
        errorText: 'RPC rate limited',
      } as any)
    );
    expect(passthrough).toEqual({
      label: 'Failed to Send Crypto.',
      text: 'RPC rate limited',
    });
  });
});

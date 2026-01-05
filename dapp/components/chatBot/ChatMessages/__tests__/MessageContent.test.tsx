// dapp/components/chatBot/ChatMessages/__tests__/MessageContent.test.tsx
import React from 'react';
import { render, screen } from '@testing-library/react';
import MessageContent from '../MessageContent';
import type { Message } from '../types';

// Mock parser to control segments per part
const parseMock = vi.fn();
vi.mock('../utils/parseContentWithMedia', () => ({
  parseContentWithMedia: (...args: any[]) => parseMock(...args),
}));

// Mock RenderSegment to a simple marker so we can count/inspect role
vi.mock('../RenderSegment', () => ({
  __esModule: true,
  default: ({ segment, role }: any) => (
    <div data-testid="seg" data-type={segment.type} data-role={role} />
  ),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('MessageContent', () => {
  it('maps parts -> segments using parseContentWithMedia and renders in order', () => {
    // two parts, each returning different segments
    parseMock
      .mockReturnValueOnce([
        { type: 'text', content: 'a' },
        { type: 'link', label: 'L', href: 'https://x' },
      ])
      .mockReturnValueOnce([
        { type: 'svg', content: '<svg/>' },
      ]);

    const parts: Message['parts'] = [
      { type: 'text', text: 'first part' },
      { type: 'text', text: 'second part' },
    ];

    render(<MessageContent parts={parts} role="assistant" />);

    // parse called for each part with the raw text
    expect(parseMock).toHaveBeenCalledTimes(2);
    expect(parseMock).toHaveBeenNthCalledWith(1, 'first part');
    expect(parseMock).toHaveBeenNthCalledWith(2, 'second part');

    // renders 3 segment nodes total, in order
    const nodes = screen.getAllByTestId('seg');
    expect(nodes).toHaveLength(3);
    expect(nodes[0]).toHaveAttribute('data-type', 'text');
    expect(nodes[1]).toHaveAttribute('data-type', 'link');
    expect(nodes[2]).toHaveAttribute('data-type', 'svg');

    // role is forwarded to each RenderSegment
    nodes.forEach((n) => expect(n).toHaveAttribute('data-role', 'assistant'));
  });

  it('supports empty parts array (renders nothing)', () => {
    render(<MessageContent parts={[]} role="user" />);
    expect(screen.queryByTestId('seg')).toBeNull();
    expect(parseMock).not.toHaveBeenCalled();
  });
});

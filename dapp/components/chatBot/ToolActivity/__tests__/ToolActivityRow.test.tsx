import React from 'react';
import { render, screen } from '@testing-library/react';
import ToolActivityRow from './../ToolActivityRow';
import { ToolCallChipData } from './../ToolCallChip';

// Mock CSS used by both Row and Chip
vi.mock('./../ToolActivity.module.css', () => ({
  default: {
    row: 'row',
    chip: 'chip',
    icon: 'icon',
    spinner: 'spinner',
    check: 'check',
    cross: 'cross',
    message: 'message',
    labelLine: 'labelLine',
    text: 'text',
  },
}));

// Mock catalog for ToolCallChip
vi.mock('./../catalog', () => ({
  renderToolChipContent: (chip: ToolCallChipData) => ({
    label: `Label for ${chip.toolName}`,
    text:
      chip.status === 'error'
        ? `Error: ${chip.errorText ?? 'unknown'}`
        : `OK from ${chip.toolName}`,
  }),
}));

// Minimal zustand store mock used by ToolActivityRow
type StoreState = {
  uiToGroup: Record<string, string>;
  groups: Record<
    string,
    {
      chips: Record<string, ToolCallChipData>;
    }
  >;
};

const mockState: StoreState = {
  uiToGroup: {},
  groups: {},
};

// The hook under test calls the selector we provide here.
vi.mock('@store/toolActivity', () => ({
  useToolActivityStore: (selector: (s: StoreState) => any) => selector(mockState),
}));

describe('ToolActivityRow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockState.uiToGroup = {};
    mockState.groups = {};
  });

  it('returns null when there are no chips for the message', () => {
    const { container } = render(<ToolActivityRow uiMessageId="msg-1" />);
    // no row div should be rendered
    expect(container.querySelector('.row')).toBeNull();
  });

  it('renders chips for a mapped group in insertion order', () => {
    const chipA: ToolCallChipData = {
      toolCallId: 'a',
      toolName: 'Alpha',
      status: 'pending',
      createdAt: 1,
    };
    const chipB: ToolCallChipData = {
      toolCallId: 'b',
      toolName: 'Beta',
      status: 'success',
      createdAt: 2,
    };

    mockState.uiToGroup = { 'msg-1': 'g1' };
    mockState.groups = {
      g1: {
        chips: {
          a: chipA,
          b: chipB, // insertion order a then b
        },
      },
    };

    const { container } = render(<ToolActivityRow uiMessageId="msg-1" />);
    const row = container.querySelector('.row');
    expect(row).toBeInTheDocument();

    // Two chips rendered
    const chips = container.querySelectorAll('.chip');
    expect(chips.length).toBe(2);

    // Labels reflect insertion order
    const labels = screen.getAllByText(/^Label for /).map((n) => n.textContent);
    expect(labels).toEqual(['Label for Alpha', 'Label for Beta']);
  });

  it('does not render when the group exists but has no chips', () => {
    mockState.uiToGroup = { 'msg-2': 'g2' };
    mockState.groups = { g2: { chips: {} as Record<string, ToolCallChipData> } };

    const { container } = render(<ToolActivityRow uiMessageId="msg-2" />);
    expect(container.querySelector('.row')).toBeNull();
  });
});

import React from 'react';
import { render, screen, act } from '@testing-library/react';
import ToolActivityRow from './../ToolActivityRow';
import { useToolActivityStore } from '@store/toolActivity';
import { ToolCallChipData } from './../ToolCallChip';

// Mock CSS used by Row and Chip to avoid CSS-loader issues
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

// Mock catalog to make content deterministic (we're integrating store+UI, not catalog)
vi.mock('./../catalog', () => ({
  renderToolChipContent: (chip: ToolCallChipData) => ({
    label: `Label for ${chip.toolName}`,
    text:
      chip.status === 'error'
        ? `Error: ${chip.errorText ?? 'unknown'}`
        : `OK from ${chip.toolName}`,
  }),
}));

const resetStore = () => {
  // Reset zustand store to initial shape before each test
  useToolActivityStore.setState(
    {
      groups: {},
      activeGroupKey: undefined,
      uiToGroup: {},
      callToGroup: {},
      anchors: {},
      seq: 0,
      // The actions are preserved by not replacing the function refs; we only reset state.
      // setState's 2nd param true would REPLACE the whole store (including actions), so omit it.
    } as any,
    false
  );
};

describe('ToolActivity (integration: store + UI)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStore();
  });

  it('renders a chip for a UI message and updates from pending → success', () => {
    render(<ToolActivityRow uiMessageId="ui-1" />);

    const store = useToolActivityStore.getState();

    act(() => {
      store.onSseStart('server-1');
      store.onToolInputStart('c1', 'Alpha');
      store.attachActiveGroupToUiMessage('ui-1', { partIndex: 0, charOffset: 0 });
    });

    // Row is visible with one pending chip
    const row = document.querySelector('.row') as HTMLDivElement;
    expect(row).toBeInTheDocument();
    expect(screen.getByText('Label for Alpha')).toBeInTheDocument();
    expect(screen.getByText('OK from Alpha')).toBeInTheDocument();

    const chipEl = row.querySelector('.chip') as HTMLElement;
    expect(chipEl.querySelector('.spinner')).toBeTruthy(); // pending icon
    expect(chipEl.querySelector('.check')).toBeNull();
    expect(chipEl.querySelector('.cross')).toBeNull();

    // Update to success
    act(() => {
      store.onToolOutputAvailable('c1', { isError: false });
    });

    expect(chipEl.querySelector('.spinner')).toBeNull();
    expect(chipEl.querySelector('.check')).toBeTruthy(); // success icon
    expect(chipEl.querySelector('.cross')).toBeNull();

    // sr-only status text
    const sr = chipEl.querySelector('.sr-only') as HTMLElement;
    expect(sr).toBeTruthy();
    expect(sr.textContent).toMatch(/success/i);
  });

  it('keeps error status (error wins) and uses errorText as title', () => {
    render(<ToolActivityRow uiMessageId="ui-err" />);

    const store = useToolActivityStore.getState();

    act(() => {
      store.onSseStart('server-err');
      store.onToolInputStart('c2', 'Beta');
      store.attachActiveGroupToUiMessage('ui-err');
    });

    // Mark as error first
    act(() => {
      store.onToolOutputAvailable('c2', { isError: true, errorText: 'Boom' });
    });

    const chipEl = document.querySelector('.row .chip') as HTMLElement;
    expect(chipEl).toBeInTheDocument();

    // Title should use errorText per component
    expect(chipEl.getAttribute('title')).toBe('Boom');

    // Cross icon visible, check/spinner hidden
    expect(chipEl.querySelector('.cross')).toBeTruthy();
    expect(chipEl.querySelector('.check')).toBeNull();
    expect(chipEl.querySelector('.spinner')).toBeNull();

    // Content lines from mocked catalog
    expect(screen.getByText('Label for Beta')).toBeInTheDocument();
    expect(screen.getByText('Error: Boom')).toBeInTheDocument();

    // Try to "downgrade" to success — should remain error
    act(() => {
      store.onToolOutputAvailable('c2', { isError: false });
    });

    expect(chipEl.querySelector('.cross')).toBeTruthy();
    expect(chipEl.querySelector('.check')).toBeNull();
    const sr = chipEl.querySelector('.sr-only') as HTMLElement;
    expect(sr).toBeTruthy();
    expect(sr.textContent).toMatch(/\berror\b/i);
  });

  it('renders multiple chips in insertion order', () => {
    render(<ToolActivityRow uiMessageId="ui-2" />);

    const store = useToolActivityStore.getState();

    act(() => {
      store.onSseStart('server-2');
      store.onToolInputStart('A', 'Alpha');
      store.onToolInputStart('B', 'Beta'); // inserted after Alpha
      store.attachActiveGroupToUiMessage('ui-2');
    });

    const labels = screen.getAllByText(/^Label for /).map((n) => n.textContent);
    expect(labels).toEqual(['Label for Alpha', 'Label for Beta']);
  });
});

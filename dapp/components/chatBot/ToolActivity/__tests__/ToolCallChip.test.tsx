// components/chatBot/ToolActivity/__tests__/ToolCallChip.test.tsx
import React from 'react';
import { render, screen } from '@testing-library/react';
import ToolCallChip, { ToolCallChipData } from './../ToolCallChip';

// Mock CSS module so import doesn't blow up
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

// Mock the catalog renderer so we control label/text output
vi.mock('./../catalog', () => ({
  renderToolChipContent: (chip: ToolCallChipData) => ({
    label: `Label for ${chip.toolName}`,
    text:
      chip.status === 'error'
        ? `Error: ${chip.errorText ?? 'unknown'}`
        : `OK from ${chip.toolName}`,
  }),
}));

describe('ToolCallChip', () => {
  const base: Omit<ToolCallChipData, 'status'> = {
    toolCallId: 't1',
    toolName: 'MyTool',
    createdAt: Date.now(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders pending state with spinner and uses toolName as title', () => {
    render(<ToolCallChip chip={{ ...base, status: 'pending' }} />);

    // outer chip with title "MyTool" (no errorText provided)
    const chipEl = screen.getByTitle('MyTool');
    expect(chipEl).toBeInTheDocument();

    // spinner visible, check/cross not present
    expect(chipEl.querySelector('.spinner')).toBeTruthy();
    expect(chipEl.querySelector('.check')).toBeNull();
    expect(chipEl.querySelector('.cross')).toBeNull();

    // label + text from the mocked catalog
    expect(screen.getByText('Label for MyTool')).toBeInTheDocument();
    expect(screen.getByText('OK from MyTool')).toBeInTheDocument();

    // sr-only status text present
    expect(screen.getByText(/pending/i)).toBeInTheDocument();
  });

  it('renders success state with check icon', () => {
    render(<ToolCallChip chip={{ ...base, status: 'success' }} />);
    const chipEl = screen.getByTitle('MyTool');

    expect(chipEl.querySelector('.spinner')).toBeNull();
    expect(chipEl.querySelector('.cross')).toBeNull();

    const check = chipEl.querySelector('.check');
    expect(check).toBeTruthy();

    // sr-only status text present
    expect(screen.getByText(/success/i)).toBeInTheDocument();

    // label/text lines still shown
    expect(screen.getByText('Label for MyTool')).toBeInTheDocument();
    expect(screen.getByText('OK from MyTool')).toBeInTheDocument();
  });

  it('renders error state with cross icon and uses errorText as title', () => {
    render(
      <ToolCallChip
        chip={{ ...base, status: 'error', errorText: 'Something went wrong' }}
      />
    );

    const chipEl = screen.getByTitle('Something went wrong');

    expect(chipEl.querySelector('.spinner')).toBeNull();
    expect(chipEl.querySelector('.check')).toBeNull();
    expect(chipEl.querySelector('.cross')).toBeTruthy();

    expect(screen.getByText('Label for MyTool')).toBeInTheDocument();
    expect(screen.getByText('Error: Something went wrong')).toBeInTheDocument();

    // specifically assert the sr-only status node to avoid duplicate "error" matches
    const sr = chipEl.querySelector('.sr-only') as HTMLElement;
    expect(sr).toBeTruthy();
    expect(sr).toHaveTextContent(/\berror\b/i);
  });
});

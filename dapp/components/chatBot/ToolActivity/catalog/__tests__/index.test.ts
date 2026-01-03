
// We’ll test two scenarios by re-importing the module with different mocks.
const mockEthPresenter = {
  presenter: {
    toolName: 'get_eth_balance',
    pending: () => ({ label: 'ETH', text: 'Pending' }),
    success: () => ({ label: 'ETH', text: 'Done' }),
    error: () => ({ label: 'ETH', text: 'Failed' }),
  },
};

describe('catalog/index (getPresenter & renderToolChipContent)', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('falls back to defaultPresenter when no presenter found', async () => {
    vi.doMock('../presenters/eth_balance.presenter', () => mockEthPresenter);
    vi.doMock('../generated-presenters', () => ({ presenters: {} }));

    const mod = await import('../index');
    const { renderToolChipContent, getPresenter } = mod;

    const unknown = getPresenter('not_a_tool');
    expect(unknown).toBeTruthy(); // defaultPresenter
    const content = renderToolChipContent({
      toolCallId: 'x',
      toolName: 'unknown',
      status: 'pending',
      createdAt: Date.now(),
    });
    expect(content).toEqual({ label: 'unknown', text: 'Running…' });
  });

  it('uses a generated presenter when available and normalizes content', async () => {
    vi.doMock('../presenters/eth_balance.presenter', () => mockEthPresenter);
    vi.doMock('../generated-presenters', () => ({
      presenters: {
        demo_tool: {
          toolName: 'demo_tool',
          pending: () => 'Just text',
          success: () => ({ label: 'OK', text: 'All good' }),
          error: () => ({ text: 'Oops' }),
        },
      },
    }));

    const mod = await import('../index');
    const { renderToolChipContent, getPresenter } = mod;

    const p = getPresenter('demo_tool');
    expect(p.toolName).toBe('demo_tool');

    const baseChip = {
      toolCallId: '1',
      toolName: 'demo_tool',
      createdAt: Date.now(),
    };

    expect(
      renderToolChipContent({ ...baseChip, status: 'pending' })
    ).toEqual({ text: 'Just text' });

    expect(
      renderToolChipContent({ ...baseChip, status: 'success' })
    ).toEqual({ label: 'OK', text: 'All good' });

    expect(
      renderToolChipContent({ ...baseChip, status: 'error' })
    ).toEqual({ text: 'Oops' });
  });
});

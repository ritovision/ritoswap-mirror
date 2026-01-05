import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ---- CSS module mock: MUST return { default: ... } ----
vi.mock('../modals.module.css', () => ({
  default: new Proxy({}, { get: (_, p) => String(p) }),
}));

// ---- mock BaseModal (relative to this test file) ----
vi.mock('../BaseModal', () => ({
  BaseModal: ({ isOpen, children }: any) =>
    isOpen ? <div data-testid="base-modal">{children}</div> : null,
}));

// ---- mock modeConfigs (hoisted to avoid TDZ) ----
const fakeModeConfigs = vi.hoisted(() => ({
  rapBattle: { id: 'rapBattle', title: 'Rap Battle', description: 'Battle mode' },
  freestyle: { id: 'freestyle', title: 'Freestyle', description: 'Free flow' },
  agentBattle: { id: 'agentBattle', title: 'Agent Battle', description: 'AI vs AI' },
}));
vi.mock('@lib/llm/modes/configs', () => ({ modeConfigs: fakeModeConfigs }));

// ---- mock stores ----
vi.mock('@store/modalStore', () => {
  let state = { open: 'mode' as string };
  const openModal = vi.fn();
  const closeModal = vi.fn();
  return {
    useModalStore: () => ({ ...state, openModal, closeModal }),
    __setModalState: (patch: Partial<typeof state>) => { state = { ...state, ...patch }; },
    __reset: () => { state = { open: 'mode' }; openModal.mockClear(); closeModal.mockClear(); },
  };
});

vi.mock('@store/chatModeStore', () => {
  const setMode = vi.fn();
  return {
    useChatModeStore: () => ({ setMode }),
    __getMocks: () => ({ setMode }),
    __reset: () => { setMode.mockClear(); },
  };
});

// SUT (after mocks)
import { ModeSelectModal } from '../ModeSelectModal';
const modalStore = await import('@store/modalStore') as any;
const chatStore = await import('@store/chatModeStore') as any;

describe('ModeSelectModal', () => {
  beforeEach(() => {
    modalStore.__reset();
    chatStore.__reset();
  });

  it('renders mode buttons from modeConfigs when open', () => {
    render(<ModeSelectModal />);
    expect(screen.getByTestId('base-modal')).toBeInTheDocument();

    expect(screen.getByRole('button', { name: /rap battle/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /freestyle/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /agent battle/i })).toBeInTheDocument();
  });

  it('clicking rapBattle opens battleForm with payload', async () => {
    const user = userEvent.setup();
    render(<ModeSelectModal />);
    await user.click(screen.getByRole('button', { name: /rap battle/i }));
    expect(modalStore.useModalStore().openModal)
      .toHaveBeenCalledWith('battleForm', { battleMode: 'rapBattle' });
    expect(chatStore.__getMocks().setMode).not.toHaveBeenCalled();
  });

  it('clicking agentBattle opens battleForm with payload', async () => {
    const user = userEvent.setup();
    render(<ModeSelectModal />);
    await user.click(screen.getByRole('button', { name: /agent battle/i }));
    expect(modalStore.useModalStore().openModal)
      .toHaveBeenCalledWith('battleForm', { battleMode: 'agentBattle' });
  });

  it('clicking freestyle sets mode and closes modal', async () => {
    const user = userEvent.setup();
    render(<ModeSelectModal />);
    await user.click(screen.getByRole('button', { name: /freestyle/i }));
    expect(chatStore.__getMocks().setMode).toHaveBeenCalledWith('freestyle', 'user');
    expect(modalStore.useModalStore().closeModal).toHaveBeenCalled();
  });

  it('does not render when not open', () => {
    modalStore.__setModalState({ open: 'somethingElse' });
    render(<ModeSelectModal />);
    expect(screen.queryByRole('button', { name: /rap battle/i })).not.toBeInTheDocument();
  });
});

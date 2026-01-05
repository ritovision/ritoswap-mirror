import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ---------- wagmi mock (hoisted to avoid TDZ) ----------
const wagmiMocks = vi.hoisted(() => ({
  useAccount: vi.fn(),
  useEnsName: vi.fn(),
  useEnsAvatar: vi.fn(),
}));
vi.mock('wagmi', () => wagmiMocks);

// ---------- stores (mocked safely inside factory) ----------
vi.mock('@store/modalStore', () => {
  let state = { open: 'battleForm', payload: { battleMode: 'rapBattle' as any } };
  const openModal = vi.fn();
  const closeModal = vi.fn();

  return {
    useModalStore: () => ({
      ...state,
      openModal,
      closeModal,
    }),
    __setModalState: (patch: Partial<typeof state>) => { state = { ...state, ...patch }; },
    __resetModalMock: () => {
      state = { open: 'battleForm', payload: { battleMode: 'rapBattle' } };
      openModal.mockClear();
      closeModal.mockClear();
    },
  };
});

vi.mock('@store/chatModeStore', () => {
  type Key =
    | 'favoriteBlockchains'
    | 'favoriteNftCollection'
    | 'placeOfOrigin'
    | 'careerJobTitles'
    | 'personalQuirks'
    | 'thingsToBragAbout'
    | 'thingsToBeAshamedOf';

  const empty = {
    favoriteBlockchains: '',
    favoriteNftCollection: '',
    placeOfOrigin: '',
    careerJobTitles: '',
    personalQuirks: '',
    thingsToBragAbout: '',
    thingsToBeAshamedOf: '',
  };

  let battleFormData = { user: { ...empty }, chatbot: { ...empty } };

  const updateUserField = vi.fn((key: Key, value: string) => { battleFormData.user[key] = value; });
  const updateChatbotField = vi.fn((key: Key, value: string) => { battleFormData.chatbot[key] = value; });
  const clearBattleForm = vi.fn(() => { battleFormData = { user: { ...empty }, chatbot: { ...empty } }; });
  const setMode = vi.fn();

  return {
    useChatModeStore: () => ({
      battleFormData,
      updateUserField,
      updateChatbotField,
      clearBattleForm,
      setMode,
    }),
    __prefill: (partial: Partial<typeof battleFormData>) => {
      battleFormData = {
        user: { ...battleFormData.user, ...(partial.user || {}) },
        chatbot: { ...battleFormData.chatbot, ...(partial.chatbot || {}) },
      };
    },
    __resetChatMock: () => {
      battleFormData = { user: { ...empty }, chatbot: { ...empty } };
      updateUserField.mockClear();
      updateChatbotField.mockClear();
      clearBattleForm.mockClear();
      setMode.mockClear();
    },
  };
});

// ---------- SUT AFTER mocks ----------
import { BattleFormModal } from '../BattleFormModal';

// access mocked modules for assertions / control
const modalStore = await import('@store/modalStore') as any;
const chatStore = await import('@store/chatModeStore') as any;

describe('BattleFormModal', () => {
  beforeEach(() => {
    wagmiMocks.useAccount.mockReturnValue({ isConnected: false, address: undefined } as any);
    wagmiMocks.useEnsName.mockReturnValue({ data: undefined } as any);
    wagmiMocks.useEnsAvatar.mockReturnValue({ data: undefined } as any);
    modalStore.__resetModalMock();
    chatStore.__resetChatMock();
  });

  it('renders when open and shows expected number of fields', () => {
    render(<BattleFormModal />);

    // 7 field groups × 2 sides = 14 textboxes total
    const textboxes = screen.getAllByRole('textbox');
    expect(textboxes).toHaveLength(14);

    // 3 textarea configs × 2 sides = 6
    const textareas = document.querySelectorAll('textarea');
    expect(textareas.length).toBe(6);
  });

  it('Back button goes to mode selection', async () => {
    const user = userEvent.setup();
    render(<BattleFormModal />);
    await user.click(screen.getByRole('button', { name: /back to mode selection/i }));
    expect(modalStore.useModalStore().openModal).toHaveBeenCalledWith('mode');
  });

  it('Done with pending mode sets mode and closes', async () => {
    const user = userEvent.setup();
    modalStore.__setModalState({ payload: { battleMode: 'rapBattle' } });
    render(<BattleFormModal />);
    await user.click(screen.getByRole('button', { name: /done/i }));

    expect(chatStore.useChatModeStore().setMode).toHaveBeenLastCalledWith('rapBattle', 'user');
    expect(modalStore.useModalStore().closeModal).toHaveBeenCalled();
  });

  it('Done without pending mode only closes', async () => {
    const user = userEvent.setup();
    modalStore.__setModalState({ payload: {} });
    render(<BattleFormModal />);
    await user.click(screen.getByRole('button', { name: /done/i }));

    expect(chatStore.useChatModeStore().setMode).not.toHaveBeenCalled();
    expect(modalStore.useModalStore().closeModal).toHaveBeenCalled();
  });

  it('Clear button disabled when empty, enabled when any content', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<BattleFormModal />);

    const clearBtn = screen.getByRole('button', { name: /clear form/i });
    expect(clearBtn).toBeDisabled();

    // mutate store and rerender (avoid duplicate trees)
    chatStore.__prefill({ user: { favoriteBlockchains: 'ETH' } });
    rerender(<BattleFormModal />);

    const enabledClear = screen.getByRole('button', { name: /clear form/i });
    expect(enabledClear).toBeEnabled();

    await user.click(enabledClear);
    expect(chatStore.useChatModeStore().clearBattleForm).toHaveBeenCalled();
  });

  it('typing updates user field via updateUserField (correct key, full typed string reconstructed)', async () => {
    const user = userEvent.setup();
    render(<BattleFormModal />);

    const input = screen.getByPlaceholderText(/your favorite blockchain\(s\)\.\.\./i);
    await user.type(input, 'ETH');

    const calls = chatStore.useChatModeStore().updateUserField.mock.calls
      .filter((c: any[]) => c[0] === 'favoriteBlockchains')
      .map((c: any[]) => c[1])
      .join('');
    expect(calls).toBe('ETH');
  });

  it('typing updates chatbot field via updateChatbotField (correct key, full typed string reconstructed)', async () => {
    const user = userEvent.setup();
    render(<BattleFormModal />);

    const input = screen.getByPlaceholderText(/rapbotrito's career\/job titles\.\.\./i);
    await user.type(input, 'MC Bot');

    const calls = chatStore.useChatModeStore().updateChatbotField.mock.calls
      .filter((c: any[]) => c[0] === 'careerJobTitles')
      .map((c: any[]) => c[1])
      .join('');
    expect(calls).toBe('MC Bot');
  });

  it('UserLabel shows "You" when disconnected (no avatar)', () => {
    render(<BattleFormModal />);
    expect(screen.queryByAltText(/you/i)).not.toBeInTheDocument();
    expect(screen.getAllByText('You').length).toBeGreaterThan(0);
  });

  it('UserLabel shows ENS avatar when connected', () => {
    wagmiMocks.useAccount.mockReturnValue({ isConnected: true, address: '0xabc' } as any);
    wagmiMocks.useEnsName.mockReturnValue({ data: 'matt.eth' } as any);
    wagmiMocks.useEnsAvatar.mockReturnValue({ data: 'https://example.com/avatar.png' } as any);

    render(<BattleFormModal />);
    const imgs = screen.getAllByAltText('matt.eth');
    expect(imgs.length).toBeGreaterThan(0);
  });
});

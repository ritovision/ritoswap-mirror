import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ✅ CSS module mock (must export default)
vi.mock('../../../utilities/chatBot/modals/modals.module.css', () => ({
  default: new Proxy({}, { get: (_, p) => String(p) }),
}));

// Mock BaseModal from utilities path
vi.mock('../../../utilities/chatBot/modals/BaseModal', () => ({
  BaseModal: ({ isOpen, children }: any) =>
    isOpen ? <div data-testid="base-modal">{children}</div> : null,
}));

// Mock store
vi.mock('@store/modalStore', () => {
  let state = { open: 'confirmReset' as string };
  const closeModal = vi.fn();
  return {
    useModalStore: () => ({ ...state, closeModal }),
    __set: (patch: Partial<typeof state>) => { state = { ...state, ...patch }; },
    __reset: () => { state = { open: 'confirmReset' }; closeModal.mockClear(); },
  };
});

// SUT (from utilities path!)
import { ConfirmResetModal } from '../../../chatBot/modals/ConfirmResetModal';
const modalStore = await import('@store/modalStore') as any;

describe('ConfirmResetModal', () => {
  beforeEach(() => {
    modalStore.__reset();
  });

  it('renders only when open === confirmReset', () => {
    const { rerender } = render(<ConfirmResetModal onConfirm={() => {}} />);
    // initially open
    expect(screen.getByText(/delete conversation\?/i)).toBeInTheDocument();

    // switch to a different modal state and rerender the same tree
    modalStore.__set({ open: 'somethingElse' });
    rerender(<ConfirmResetModal onConfirm={() => {}} />);

    // should no longer render
    expect(screen.queryByText(/delete conversation\?/i)).not.toBeInTheDocument();
    expect(screen.queryByTestId('base-modal')).not.toBeInTheDocument();
  });

  it('Delete calls onConfirm then closeModal', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<ConfirmResetModal onConfirm={onConfirm} />);

    await user.click(screen.getByRole('button', { name: /delete/i }));
    expect(onConfirm).toHaveBeenCalled();
    expect(modalStore.useModalStore().closeModal).toHaveBeenCalled();
  });

  it('Cancel only closes', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<ConfirmResetModal onConfirm={onConfirm} />);

    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(modalStore.useModalStore().closeModal).toHaveBeenCalled();
  });
});

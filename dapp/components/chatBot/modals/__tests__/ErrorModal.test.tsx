import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ✅ CSS module mock must return a default export
vi.mock('../modals.module.css', () => ({
  default: new Proxy({}, { get: (_, p) => String(p) }),
}));

// Mock BaseModal in same folder (relative to this test)
vi.mock('../BaseModal', () => ({
  BaseModal: ({ isOpen, children }: any) =>
    isOpen ? <div data-testid="base-modal">{children}</div> : null,
}));

// Mock store
vi.mock('@store/modalStore', () => {
  let state = { open: 'error' as string, payload: { error: undefined as any } };
  const closeModal = vi.fn();
  return {
    useModalStore: () => ({ ...state, closeModal }),
    __set: (patch: Partial<typeof state>) => { state = { ...state, ...patch }; },
    __reset: () => { state = { open: 'error', payload: { error: undefined } }; closeModal.mockClear(); },
  };
});

// SUT
import { ErrorModal } from '../ErrorModal';
const modalStore = await import('@store/modalStore') as any;

describe('ErrorModal', () => {
  beforeEach(() => {
    modalStore.__reset();
  });

  it('returns null when no error present', () => {
    modalStore.__set({ payload: { error: undefined } });
    render(<ErrorModal />);
    expect(screen.queryByTestId('base-modal')).not.toBeInTheDocument();
  });

  it('renders error message and details when present', () => {
    modalStore.__set({
      payload: { error: { message: 'Boom', details: 'stacktrace...' } },
    });
    render(<ErrorModal />);
    expect(screen.getByText(/error occurred/i)).toBeInTheDocument();
    expect(screen.getByText('Boom')).toBeInTheDocument();
    expect(screen.getByText('stacktrace...')).toBeInTheDocument();
  });

  it('jwt-like error shows Refresh + Dismiss; Refresh closes and reloads', async () => {
    const user = userEvent.setup();

    // mock window.location.reload and restore afterward
    const originalLocation = window.location;
    Object.defineProperty(window, 'location', {
      value: { ...originalLocation, reload: vi.fn() },
      configurable: true,
    });

    modalStore.__set({
      payload: { error: { message: '401 Unauthorized: jwt expired' } },
    });

    render(<ErrorModal />);
    const refreshBtn = screen.getByRole('button', { name: /refresh/i });
    const dismissBtn = screen.getByRole('button', { name: /dismiss/i });

    await user.click(refreshBtn);
    expect(modalStore.useModalStore().closeModal).toHaveBeenCalled();
    expect(window.location.reload).toHaveBeenCalled();

    expect(dismissBtn).toBeInTheDocument();

    // restore
    Object.defineProperty(window, 'location', {
      value: originalLocation,
      configurable: true,
    });
  });

  it('non-jwt error with retry shows Retry and calls it then closes', async () => {
    const user = userEvent.setup();
    const retry = vi.fn();
    modalStore.__set({
      payload: { error: { message: 'Oops', retry } },
    });

    render(<ErrorModal />);
    const retryBtn = screen.getByRole('button', { name: /retry/i });
    await user.click(retryBtn);

    expect(retry).toHaveBeenCalled();
    expect(modalStore.useModalStore().closeModal).toHaveBeenCalled();
  });
});

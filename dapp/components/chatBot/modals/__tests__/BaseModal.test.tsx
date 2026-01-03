import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../modals.module.css', () => ({
  default: new Proxy({}, { get: (_, p) => String(p) }),
}));

// SUT
import { BaseModal } from '../BaseModal';

describe('BaseModal', () => {
  it('does not render when isOpen is false', () => {
    const { container } = render(
      <BaseModal isOpen={false}><div>hidden</div></BaseModal>
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders children and dialog attributes when open', () => {
    render(
      <BaseModal isOpen labelledById="title-id" describedById="desc-id">
        <h2 id="title-id">Title</h2>
        <p id="desc-id">Desc</p>
      </BaseModal>
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(screen.getByText('Title')).toBeInTheDocument();
    expect(screen.getByText('Desc')).toBeInTheDocument();
  });

  it('clicking overlay triggers onClose when allowed', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<BaseModal isOpen onClose={onClose}><button>Btn</button></BaseModal>);
    const overlay = screen.getByRole('dialog');
    await user.click(overlay);
    expect(onClose).toHaveBeenCalled();
  });

  it('overlay click ignored when disableOverlayClose is true', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <BaseModal isOpen onClose={onClose} disableOverlayClose>
        <button>Btn</button>
      </BaseModal>
    );
    const overlay = screen.getByRole('dialog');
    await user.click(overlay);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('Escape key closes when onClose provided', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<BaseModal isOpen onClose={onClose}><button>Btn</button></BaseModal>);
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });

  it('focuses the first focusable element on open and traps Tab', async () => {
    const user = userEvent.setup();
    render(
      <BaseModal isOpen>
        <button data-testid="first">First</button>
        <button data-testid="second">Second</button>
      </BaseModal>
    );
    const first = screen.getByTestId('first');
    const second = screen.getByTestId('second');
    const modal = screen.getByTestId('base-modal');

    // Initial focus is on the modal container
    expect(document.activeElement).toBe(modal);

    // Shift+Tab from container wraps to last focusable element
    await user.keyboard('{Shift>}{Tab}{/Shift}');
    expect(document.activeElement).toBe(second);

    // Tab wraps to first
    await user.keyboard('{Tab}');
    expect(document.activeElement).toBe(first);

    // Tab goes to second
    await user.keyboard('{Tab}');
    expect(document.activeElement).toBe(second);

    // Tab from last wraps to first
    await user.keyboard('{Tab}');
    expect(document.activeElement).toBe(first);
  });
});

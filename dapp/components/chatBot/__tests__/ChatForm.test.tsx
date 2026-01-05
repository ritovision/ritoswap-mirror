import React, { useState } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import ChatForm from '../ChatForm';

// Polyfill for form.requestSubmit in JSDOM (used by Enter-to-submit)
beforeAll(() => {
  if (!HTMLFormElement.prototype.requestSubmit) {
    HTMLFormElement.prototype.requestSubmit = function () {
      this.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    };
  }
});

beforeEach(() => {
  // Silence console noise from the component logger during tests
  vi.spyOn(console, 'debug').mockImplementation(() => {});
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

function Harness({
  initialInput = '',
  status = 'ready',
  isLoading = false,
  onSubmit = vi.fn(),
  onStop = vi.fn(),
  setTextareaHeight = vi.fn(),
}: {
  initialInput?: string;
  status?: string;
  isLoading?: boolean;
  onSubmit?: (e: React.FormEvent<HTMLFormElement>) => void;
  onStop?: () => void;
  setTextareaHeight?: (h: string) => void;
}) {
  const [input, setInput] = useState(initialInput);
  return (
    <ChatForm
      input={input}
      setInput={setInput}
      status={status}
      isLoading={isLoading}
      onSubmit={onSubmit}
      onStop={onStop}
      textareaHeight="auto"
      setTextareaHeight={setTextareaHeight}
    />
  );
}

const getTextarea = () =>
  screen.getByPlaceholderText('Drop your message here...') as HTMLTextAreaElement;

describe('ChatForm', () => {
  it('renders textarea and Send button; enables Send only when ready and input is non-empty', async () => {
    render(<Harness />);
    const sendBtn = screen.getByRole('button', { name: /send/i });
    expect(sendBtn).toBeDisabled();

    await userEvent.type(getTextarea(), 'hello');
    expect(sendBtn).toBeEnabled();
  });

  it('submits on Enter (no Shift) when input is present and status is ready', async () => {
    const onSubmit = vi.fn((e: React.FormEvent<HTMLFormElement>) => e.preventDefault());
    render(<Harness initialInput="hello" onSubmit={onSubmit} />);

    fireEvent.keyDown(getTextarea(), {
      key: 'Enter',
      code: 'Enter',
      charCode: 13,
      shiftKey: false,
    });

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('does NOT submit on Enter when input is blank', async () => {
    const onSubmit = vi.fn((e: React.FormEvent<HTMLFormElement>) => e.preventDefault());
    render(<Harness onSubmit={onSubmit} />);

    fireEvent.keyDown(getTextarea(), {
      key: 'Enter',
      code: 'Enter',
      charCode: 13,
      shiftKey: false,
    });

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('does NOT submit on Enter when status is not ready', async () => {
    const onSubmit = vi.fn((e: React.FormEvent<HTMLFormElement>) => e.preventDefault());
    render(<Harness status="streaming" initialInput="text" onSubmit={onSubmit} />);

    fireEvent.keyDown(getTextarea(), {
      key: 'Enter',
      code: 'Enter',
      charCode: 13,
      shiftKey: false,
    });

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('does NOT submit on Shift+Enter (allows newline behavior)', async () => {
    const onSubmit = vi.fn((e: React.FormEvent<HTMLFormElement>) => e.preventDefault());
    render(<Harness initialInput="hello" onSubmit={onSubmit} />);

    fireEvent.keyDown(getTextarea(), {
      key: 'Enter',
      code: 'Enter',
      charCode: 13,
      shiftKey: true,
    });

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('shows Stop button during streaming and calls onStop when clicked', async () => {
    const onStop = vi.fn();
    render(<Harness status="streaming" initialInput="..." onStop={onStop} />);

    const stopBtn = screen.getByRole('button', { name: /stop/i });
    expect(stopBtn).toBeInTheDocument();

    await userEvent.click(stopBtn);
    expect(onStop).toHaveBeenCalledTimes(1);
  });

  it('respects --textarea-max-height and clamps height; calls setTextareaHeight', async () => {
    // Mock getComputedStyle to return a known CSS var max height
    const original = window.getComputedStyle;
    const getComputedStyleMock = vi
      .spyOn(window, 'getComputedStyle')
      .mockImplementation(((el: Element) => {
        return {
          getPropertyValue: (prop: string) =>
            prop === '--textarea-max-height' ? '120px' : '',
        } as any;
      }) as any);

    const setTextareaHeight = vi.fn();
    render(<Harness initialInput="" setTextareaHeight={setTextareaHeight} />);

    const textarea = getTextarea();

    // Fake a large scrollHeight to trigger clamping to 120px
    Object.defineProperty(textarea, 'scrollHeight', {
      value: 240,
      configurable: true,
    });

    // Typing will change input state, triggering the resize effect
    await userEvent.type(textarea, 'x');

    await waitFor(() => {
      expect(textarea.style.height).toBe('120px');
      expect(setTextareaHeight).toHaveBeenCalledWith('auto');
      expect(textarea.style.overflowY).toBe('auto');
    });

    getComputedStyleMock.mockRestore();
    expect(window.getComputedStyle).toBe(original);
  });

  it('falls back to default 240px when CSS var is invalid', async () => {
    const getComputedStyleMock = vi
      .spyOn(window, 'getComputedStyle')
      .mockImplementation(((el: Element) => {
        return {
          getPropertyValue: () => 'not-a-number',
        } as any;
      }) as any);

    render(<Harness initialInput="" />);

    const textarea = getTextarea();

    // Large content to ensure clamping at fallback 240px
    Object.defineProperty(textarea, 'scrollHeight', {
      value: 1000,
      configurable: true,
    });

    await userEvent.type(textarea, 'y');

    await waitFor(() => {
      expect(textarea.style.height).toBe('240px');
    });

    getComputedStyleMock.mockRestore();
  });

  it('adds and removes window resize listener on mount/unmount', async () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    const { unmount } = render(<Harness />);

    expect(addSpy).toHaveBeenCalledWith('resize', expect.any(Function));

    unmount();

    expect(removeSpy).toHaveBeenCalledWith('resize', expect.any(Function));
  });
});

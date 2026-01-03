// dapp/components/utilities/chatBot/ChatForm.tsx
'use client';

import { FormEvent, useRef, useEffect, useCallback } from 'react';
import styles from './ChatForm.module.css';
import { publicConfig } from '@config/public.env';

interface ChatFormProps {
  input: string;
  setInput: (value: string) => void;
  status: string;
  isLoading: boolean;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  onStop: () => void;
  textareaHeight: string;
  setTextareaHeight: (height: string) => void;

  inputDisabled?: boolean;
  onTrash?: () => void;
}

type Level = 'debug' | 'info' | 'warn' | 'error';
const LEVELS: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const ENV_LEVEL = publicConfig.logLevel as Level;

function createLogger(scope: string) {
  const should = (level: Level) => LEVELS[level] >= LEVELS[ENV_LEVEL];
  const fmt = (level: Level, ...args: unknown[]) => {
    const ts = new Date().toISOString();
    return [`${ts} ${scope} ${level.toUpperCase()}:`, ...args];
  };
  return {
    debug: (...args: unknown[]) => should('debug') && console.debug(...fmt('debug', ...args)),
    info:  (...args: unknown[]) => should('info')  && console.info (...fmt('info',  ...args)),
    warn:  (...args: unknown[]) => should('warn')  && console.warn (...fmt('warn',  ...args)),
    error: (...args: unknown[]) => should('error') && console.error(...fmt('error', ...args)),
  };
}
const log = createLogger('[ChatForm]');

export default function ChatForm({
  input,
  setInput,
  status,
  isLoading,
  onSubmit,
  onStop,
  setTextareaHeight,
  inputDisabled = false,
  onTrash,
}: ChatFormProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const getMaxHeight = useCallback((): number => {
    const el = textareaRef.current;
    if (!el) {
      log.warn('No textarea element found, using default max height 240px');
      return 240;
    }
    const styles = window.getComputedStyle(el);
    const varValue = styles.getPropertyValue('--textarea-max-height').trim();
    const px = varValue.endsWith('px') ? parseFloat(varValue) : Number(varValue);
    if (!Number.isFinite(px)) {
      log.warn('Invalid --textarea-max-height value:', varValue, '→ default 240px');
      return 240;
    }
    return px;
  }, []);

  const resizeToContent = useCallback(() => {
    try {
      const el = textareaRef.current;
      if (!el) return;
      el.style.height = 'auto';
      el.style.overflowY = 'hidden';
      const maxH = getMaxHeight();
      const next = Math.min(el.scrollHeight, maxH);
      el.style.height = `${next}px`;
      if (el.scrollHeight > maxH) el.style.overflowY = 'auto';
      setTextareaHeight('auto');
      log.debug('Resized textarea:', { scrollHeight: el.scrollHeight, appliedHeight: next });
    } catch (err) {
      log.error('Error in resizeToContent:', err);
    }
  }, [getMaxHeight, setTextareaHeight]);

  useEffect(() => {
    log.info('ChatForm mounted with status:', status);
    resizeToContent();
    const onResize = () => { log.debug('Window resized'); resizeToContent(); };
    window.addEventListener('resize', onResize);
    return () => { window.removeEventListener('resize', onResize); log.info('ChatForm unmounted'); };
  }, [input, resizeToContent, status]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const canSubmit = (status === 'ready' || status === 'error') && !inputDisabled;
      if (canSubmit && input.trim()) {
        const form = e.currentTarget.closest('form');
        if (form) {
          log.debug('Enter pressed → submitting form');
          form.requestSubmit();
        }
      } else {
        log.debug('Enter pressed but submission blocked', { input, inputDisabled, status });
      }
    }
  };

  const safeSubmit = (e: FormEvent<HTMLFormElement>) => {
    try {
      if (!(status === 'ready' || status === 'error')) {
        log.debug('Ignored submit because status is not ready/error:', status);
        e.preventDefault();
        return;
      }
      log.info('Form submitted, input length:', input.length);
      onSubmit(e);
    } catch (err) {
      log.error('Error during onSubmit:', err);
    }
  };

  const safeStop = () => {
    try {
      log.info('Stop button clicked');
      onStop();
    } catch (err) {
      log.error('Error during onStop:', err);
    }
  };

  const showStop = status === 'streaming' || status === 'submitted';

  return (
    <form onSubmit={safeSubmit} className={styles.inputForm}>
      <button
        type="button"
        className={`${styles.iconButton} ${styles.trashButton}`}
        aria-label="Delete conversation"
        onClick={onTrash}
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 875 1000" aria-hidden="true">
          <path
            fill="currentColor"
            d="M0 281.296l0 -68.355q1.953 -37.107 29.295 -62.496t64.449 -25.389l93.744 0l0 -31.248q0 -39.06 27.342 -66.402t66.402 -27.342l312.48 0q39.06 0 66.402 27.342t27.342 66.402l0 31.248l93.744 0q37.107 0 64.449 25.389t29.295 62.496l0 68.355q0 25.389 -18.553 43.943t-43.943 18.553l0 531.216q0 52.731 -36.13 88.862t-88.862 36.13l-499.968 0q-52.731 0 -88.862 -36.13t-36.13 -88.862l0 -531.216q-25.389 0 -43.943 -18.553t-18.553 -43.943zm62.496 0l749.952 0l0 -62.496q0 -13.671 -8.789 -22.46t-22.46 -8.789l-687.456 0q-13.671 0 -22.46 8.789t-8.789 22.46l0 62.496zm62.496 593.712q0 25.389 18.553 43.943t43.943 18.553l499.968 0q25.389 0 43.943 -18.553t18.553 -43.943l0 -531.216l-624.96 0l0 531.216zm62.496 -31.248l0 -406.224q0 -13.671 8.789 -22.46t22.46 -8.789l62.496 0q13.671 0 22.46 8.789t8.789 22.46l0 406.224q0 13.671 -8.789 22.46t-22.46 8.789l-62.496 0q-13.671 0 -22.46 -8.789t-8.789 -22.46zm31.248 0l62.496 0l0 -406.224l-62.496 0l0 406.224zm31.248 -718.704l374.976 0l0 -31.248q0 -13.671 -8.789 -22.46t-22.46 -8.789l-312.48 0q-13.671 0 -22.46 8.789t-8.789 22.46l0 31.248zm124.992 718.704l0 -406.224q0 -13.671 8.789 -22.46t22.46 -8.789l62.496 0q13.671 0 22.46 8.789t-8.789 22.46l0 406.224q0 13.671 -8.789 22.46t-22.46 8.789l-62.496 0q-13.671 0 -22.46 -8.789t-8.789 -22.46zm31.248 0l62.496 0l0 -406.224l-62.496 0l0 406.224zm156.24 0l0 -406.224q0 -13.671 8.789 -22.46t-22.46 -8.789l62.496 0q13.671 0 22.46 8.789t-8.789 22.46l0 406.224q0 13.671 -8.789 22.46t-22.46 8.789l-62.496 0q-13.671 0 -22.46 -8.789t-8.789 -22.46zm31.248 0l62.496 0l0 -406.224l-62.496 0l0 406.224z"
          />
        </svg>
      </button>

      <textarea
        ref={textareaRef}
        className={styles.input}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Drop your message here..."
        disabled={inputDisabled}
        rows={1}
      />

      {showStop ? (
        <button
          type="button"
          onClick={safeStop}
          className={styles.stopButton}
          data-testid="chat-stop-button"
        >
          Stop
        </button>
      ) : (
        <button
          type="submit"
          className={`${styles.iconButton} ${styles.sendButton}`}
          aria-label="Send message"
          disabled={inputDisabled || !input.trim()}
        >
          {isLoading ? (
            '...'
          ) : (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                fill="currentColor"
                d="M12 3l6.364 6.364-1.414 1.414L13 6.828V21h-2V6.828L7.05 10.778 5.636 9.364 12 3z"
              />
            </svg>
          )}
        </button>
      )}
    </form>
  );
}

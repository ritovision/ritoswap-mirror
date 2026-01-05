'use client';

import React, {
  forwardRef,
  useEffect,
  useRef,
  useLayoutEffect,
  useImperativeHandle,
} from 'react';
import styles from './ChatMessages.module.css';
import MessageContent from './MessageContent';
import WagmiBoundary from './components/WagmiBoundary';
import UserHeaderWithWagmi from './components/UserHeader/UserHeaderWithWagmi';
import UserHeaderFallback from './components/UserHeader/UserHeaderFallback';
import AssistantHeader from './components/AssistantHeader';
import AssistantAudioButton from './components/AssistantAudioButton';
import type { ChatMessagesProps, Message } from './types';

import ToolActivityRow from '../ToolActivity/ToolActivityRow';
import { useToolActivityStore } from '@store/toolActivity';
import { splitPartsAtAnchor } from './utils/splitPartsAtAnchor';

export type ChatMessagesHandle = {
  getEl: () => HTMLDivElement | null;
  jumpToBottomAndPin: () => void;
  pinToCurrent: () => void;
  jumpToLatestUserMessageBottomAndPin: (offset?: number) => void;
};

type Styles = typeof styles;

function MessageBubble({
  message,
  styles,
  streamingAssistantId,
}: {
  message: Message;
  styles: Styles;
  streamingAssistantId?: string | null;
}) {
  const anchor = useToolActivityStore((s) => s.anchors[message.id]);
  const { before, after } =
    message.role === 'assistant'
      ? splitPartsAtAnchor(message.parts, anchor)
      : { before: message.parts, after: [] };

  return (
    <div
      data-role={message.role}
      className={`${styles.message} ${
        message.role === 'user' ? styles.userMessage : styles.assistantMessage
      }`}
    >
      {message.role === 'assistant' ? (
        <AssistantHeader />
      ) : (
        <WagmiBoundary fallback={<UserHeaderFallback />}>
          <UserHeaderWithWagmi />
        </WagmiBoundary>
      )}

      <div className={styles.messageContent}>
        {/* content before the anchored chip */}
        <MessageContent parts={before} role={message.role} />

        {/* anchored tool chips (assistant only) */}
        {message.role === 'assistant' && <ToolActivityRow uiMessageId={message.id} />}

        {/* streamed content after the chip */}
        {after.length > 0 && <MessageContent parts={after} role={message.role} />}

        {message.role === 'assistant' && (
          <AssistantAudioButton
            messageId={message.id}
            parts={message.parts}
            disabled={message.id === streamingAssistantId}
          />
        )}
      </div>
    </div>
  );
}

const ChatMessages = forwardRef<ChatMessagesHandle, ChatMessagesProps>(
  (
    { messages, isLoading, status, error, onRegenerate, textareaExpanded, streamingAssistantId },
    ref
  ) => {
    const containerRef = useRef<HTMLDivElement>(null);

    const pinnedRef = useRef<{ top: number; height: number }>({ top: 0, height: 0 });

    useEffect(() => {
      const el = containerRef.current;
      if (!el) return;

      const onScroll = () => {
        pinnedRef.current.top = el.scrollTop;
      };

      pinnedRef.current.top = el.scrollTop;
      pinnedRef.current.height = el.scrollHeight;

      el.addEventListener('scroll', onScroll, { passive: true });
      return () => el.removeEventListener('scroll', onScroll);
    }, []);

    useLayoutEffect(() => {
      const el = containerRef.current;
      if (!el) return;

      const prevTop = pinnedRef.current.top;

      const maxTop = Math.max(0, el.scrollHeight - el.clientHeight);
      const targetTop = Math.min(prevTop, maxTop);

      const prevBehavior = el.style.scrollBehavior;
      el.style.scrollBehavior = 'auto';
      el.scrollTop = targetTop;
      el.style.scrollBehavior = prevBehavior;

      pinnedRef.current.height = el.scrollHeight;
      pinnedRef.current.top = el.scrollTop;
    }, [messages.length, textareaExpanded]);

    useEffect(() => {
      const el = containerRef.current;
      if (!el || !('MutationObserver' in window)) return;

      const applyPinned = () => {
        const prevTop = pinnedRef.current.top;
        const maxTop = Math.max(0, el.scrollHeight - el.clientHeight);
        const targetTop = Math.min(prevTop, maxTop);
        const prevBehavior = el.style.scrollBehavior;
        el.style.scrollBehavior = 'auto';
        el.scrollTop = targetTop;
        el.style.scrollBehavior = prevBehavior;
      };

      const observer = new MutationObserver(() => {
        applyPinned();
      });

      observer.observe(el, {
        childList: true,
        subtree: true,
        characterData: true,
      });

      return () => observer.disconnect();
    }, []);

    const scrollNodeBottomIntoViewAndPin = (node: HTMLElement, offset = 12) => {
      const el = containerRef.current;
      if (!el) return;
      const cRect = el.getBoundingClientRect();
      const mRect = node.getBoundingClientRect();

      const elemBottomInScrollSpace = el.scrollTop + (mRect.bottom - cRect.top);

      let desiredTop = elemBottomInScrollSpace - el.clientHeight + offset;

      const maxTop = Math.max(0, el.scrollHeight - el.clientHeight);
      desiredTop = Math.max(0, Math.min(desiredTop, maxTop));

      const prev = el.style.scrollBehavior;
      el.style.scrollBehavior = 'auto';
      el.scrollTop = desiredTop;
      el.style.scrollBehavior = prev;

      pinnedRef.current.top = el.scrollTop;
      pinnedRef.current.height = el.scrollHeight;
    };

    useImperativeHandle(
      ref,
      (): ChatMessagesHandle => ({
        getEl: () => containerRef.current,
        jumpToBottomAndPin: () => {
          const el = containerRef.current;
          if (!el) return;
          const prev = el.style.scrollBehavior;
          el.style.scrollBehavior = 'auto';
          el.scrollTop = el.scrollHeight;
          el.style.scrollBehavior = prev;
          pinnedRef.current.top = el.scrollTop;
          pinnedRef.current.height = el.scrollHeight;
        },
        pinToCurrent: () => {
          const el = containerRef.current;
          if (!el) return;
          pinnedRef.current.top = el.scrollTop;
          pinnedRef.current.height = el.scrollHeight;
        },
        jumpToLatestUserMessageBottomAndPin: (offset = 12) => {
          const el = containerRef.current;
          if (!el) return;
          const userNodes = el.querySelectorAll(`.${styles.userMessage}`);
          const last = userNodes[userNodes.length - 1] as HTMLElement | undefined;
          if (last) {
            scrollNodeBottomIntoViewAndPin(last, offset);
          } else {
            const prev = el.style.scrollBehavior;
            el.style.scrollBehavior = 'auto';
            el.scrollTop = el.scrollHeight;
            el.style.scrollBehavior = prev;
            pinnedRef.current.top = el.scrollTop;
            pinnedRef.current.height = el.scrollHeight;
          }
        },
      }),
      []
    );

    return (
      <div
        className={`${styles.messagesContainer} ${
          textareaExpanded ? styles.messagesContainerShrunk : ''
        }`}
        ref={containerRef}
      >
        {messages.map((message: Message) => (
          <MessageBubble
            key={message.id}
            message={message}
            styles={styles}
            streamingAssistantId={streamingAssistantId}
          />
        ))}

        {isLoading && (
          <div className={styles.loadingContainer}>
            <div className={styles.loadingDots}>
              <span></span>
              <span></span>
              <span></span>
            </div>
            <span className={styles.loadingText}>RapBotRito is cooking up bars...</span>
          </div>
        )}

        {status === 'error' && error && (
          <div className={styles.errorMessage}>
            <strong>Error:</strong> {error.message}
            <button onClick={onRegenerate} className={styles.retryButton}>
              Retry
            </button>
          </div>
        )}
      </div>
    );
  }
);

ChatMessages.displayName = 'ChatMessages';
export default ChatMessages;

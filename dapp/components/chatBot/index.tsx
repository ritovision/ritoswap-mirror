// dapp/components/chatBot/index.tsx
'use client';

import { useChat } from '@ai-sdk/react';
import { useState, useRef, useCallback, FormEvent, useEffect, useMemo } from 'react';
import { useAccount, useChainId, useEnsName } from 'wagmi';
import { useNFTStore } from '@store/nftStore';
import { useNFTData } from '@hooks/useNFTData';
import { CHAIN_IDS, getTargetChainId } from '@config/chain';
import { publicEnv } from '@config/public.env';
import { aiPublicConfig } from '@config/ai.public';
import { getStoredToken } from '@lib/jwt/client';

import { createToolAwareTransport } from '@/app/lib/llm/client/ToolAwareTransport';
import { useToolActivityStore } from '@store/toolActivity';

import { composeSystemPrompt } from '@lib/llm/modes/composePrompt';
import { composeWelcomeMessage } from '@lib/llm/modes/composeWelcome';
import { useModalStore } from '@store/modalStore';
import { useChatModeStore } from '@store/chatModeStore';
import { useTtsAudioStore } from '@store/ttsAudioStore';

import ChatContainer from './ChatContainer';
import ChatHeader from './ChatHeader';
import ChatMessages, { ChatMessagesHandle } from './ChatMessages/ChatMessages';
import ChatForm from './ChatForm';

import { MusicProvider, useMusic } from './MusicPlayer/MusicProvider';
import MusicBar from './MusicPlayer/MusicBar';

import { ModeSelectModal } from './modals/ModeSelectModal';
import { ErrorModal } from './modals/ErrorModal';
import { ConfirmResetModal } from './modals/ConfirmResetModal';
import { BattleFormModal } from './forms';

import stackStyles from './ChatWithPlayer.module.css';

// ⬇️ Hydrate generated images from MCP tool JSON into the client store
import useHydrateToolImages from '@hooks/useHydrateToolImages';
import type { UIMessage } from 'ai';

const CHAIN_NAME_BY_ID: Record<number, string> = {
  [CHAIN_IDS.ethereum]: 'Ethereum',
  [CHAIN_IDS.sepolia]: 'Sepolia',
  [CHAIN_IDS.ritonet]: publicEnv.NEXT_PUBLIC_LOCAL_BLOCKCHAIN_NAME || 'RitoNet',
};

type MinimalPart = { type?: string; text?: unknown };
type AssistantMsg = { id: string; role: 'assistant'; parts?: unknown[] };

type ChatBotInnerProps = {
  disableNftData?: boolean;
  initialMessages?: UIMessage[];
};

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const isPartLike = (p: unknown): p is MinimalPart => isObject(p);

function ChatBotInner({ disableNftData = false, initialMessages }: ChatBotInnerProps) {
  const messagesViewRef = useRef<ChatMessagesHandle>(null);
  const regenerateRef = useRef<(() => void) | null>(null);

  // Hydrate image bytes (from tool side-channel) into in-memory store.
  useHydrateToolImages();

  // Enforce pending hard reload if a Goodbye was triggered this session.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const STORAGE_KEY = 'ritoGoodbyeHardReloadAt';
    const TIMER_ID_KEY = '__ritoGoodbyeHardReloadTimerId';
    const w = window as unknown as Window & Record<string, number | undefined>;
    const goodbyeMode = (window as unknown as Window & { __RITO_GOODBYE_MODE__?: 'stub' | 'live' }).__RITO_GOODBYE_MODE__;
    if (goodbyeMode === 'stub') {
      try { sessionStorage.removeItem(STORAGE_KEY); } catch {}
      return;
    }

    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const at = parseInt(raw, 10);
      if (!Number.isFinite(at)) {
        sessionStorage.removeItem(STORAGE_KEY);
        return;
      }
      const now = Date.now();
      if (at <= now) {
        sessionStorage.removeItem(STORAGE_KEY);
        try { window.location.reload(); } catch {}
        return;
      }
      if (!w[TIMER_ID_KEY]) {
        w[TIMER_ID_KEY] = window.setTimeout(() => {
          try { window.location.reload(); }
          finally {
            sessionStorage.removeItem(STORAGE_KEY);
            w[TIMER_ID_KEY] = undefined;
          }
        }, at - now);
      }
    } catch {
      // ignore
    }
  }, []);

  // ✅ SINGLE declarations with string types (ChatForm expects string)
  const [input, setInput] = useState('');
  const [textareaHeight, setTextareaHeight] = useState('auto');

  const [jwt, setJwt] = useState<string | null>(null);
  const music = useMusic();

  useEffect(() => {
    setJwt(getStoredToken());
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'access_token') setJwt(getStoredToken());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // Get active mode from store for UI logic
  const { activeMode, lockedByProp, resetMode } = useChatModeStore();
  const { open, openModal, closeModal } = useModalStore();

  const handleSseError = useCallback((errorText: string) => {
    openModal('error', {
      error: {
        message: errorText,
        retry: () => regenerateRef.current?.(),
      },
    });
  }, [openModal]);

  // Create transport with metadata injection
  // IMPORTANT: getMetadata reads from store directly to avoid stale closures
  const transport = useMemo(() => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (aiPublicConfig.requiresJwt && jwt) headers['Authorization'] = `Bearer ${jwt}`;
    
    return createToolAwareTransport({ 
      api: aiPublicConfig.apiPath, 
      headers,
      onSseError: handleSseError,
      // Read mode fresh from store each time (no stale closures)
      getMetadata: () => {
        const currentMode = useChatModeStore.getState().activeMode;
        console.log('📤 Transport sending mode to server:', currentMode);
        return { mode: currentMode || 'choose' };
      },
    });
  }, [jwt, handleSseError]); // Only recreate on JWT/error handler changes; mode is read fresh each request

  const [nonce, setNonce] = useState(() => Math.random().toString(36).slice(2, 8));
  const chatId = useMemo(
    () => (aiPublicConfig.requiresJwt && jwt ? `chat-${jwt.slice(-8)}-${nonce}` : `chat-nojwt-${nonce}`),
    [jwt, nonce],
  );

  const chatInit = useMemo(
    () => (initialMessages ? { messages: initialMessages } : {}),
    [initialMessages]
  );

  const { messages, sendMessage, status, error, stop, regenerate, setMessages } = useChat({
    id: chatId,
    transport, // Transport now handles metadata injection automatically
    ...chatInit,
  });

  useEffect(() => {
    if (messages.length === 0) {
      useTtsAudioStore.getState().clear();
    }
  }, [messages.length]);

  useEffect(() => {
    regenerateRef.current = regenerate;
  }, [regenerate]);

  const lastAttachedRef = useRef<string | null>(null);
  useEffect(() => {
    if (status !== 'submitted' && status !== 'streaming') return;
    if (!messages || messages.length === 0) return;
    const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant' && m.id !== 'welcome');
    if (!lastAssistant) return;
    if (lastAttachedRef.current === lastAssistant.id) return;

    const store = useToolActivityStore.getState();
    if (store.uiToGroup[lastAssistant.id]) {
      lastAttachedRef.current = lastAssistant.id;
      return;
    }
    if (!store.activeGroupKey) return;

    const parts: unknown[] = (lastAssistant as AssistantMsg).parts || [];
    const partIndex = Math.max(0, parts.length - 1);
    const safeText = (val: unknown) => {
      if (typeof val === 'string') return val;
      if (val == null) return '';
      try { return String((val as { text?: unknown })?.text ?? val); } catch { try { return JSON.stringify(val); } catch { return ''; } }
    };
    const lastText = parts.length > 0 ? safeText(parts[partIndex]) : '';
    const anchor = { partIndex, charOffset: lastText.length };
    store.attachActiveGroupToUiMessage(lastAssistant.id, anchor);
    lastAttachedRef.current = lastAssistant.id;
  }, [messages, status]);

  useNFTData({ enabled: !disableNftData });
  const { address, isConnected } = useAccount();
  const activeChainId = useChainId();
  const { data: ensName } = useEnsName({ address, chainId: 1, query: { enabled: Boolean(address) } });
  const { hasNFT, tokenId, backgroundColor, keyColor, hasUsedTokenGate } = useNFTStore();

  const contractChainId = getTargetChainId();
  const connectedChainName =
    (activeChainId && CHAIN_NAME_BY_ID[activeChainId]) ||
    (activeChainId ? `chainId ${activeChainId}` : 'unknown');
  const contractChainName = CHAIN_NAME_BY_ID[contractChainId] || `chainId ${contractChainId}`;

  const buildNftContext = (): string => {
    const jsonContext = {
      connected: isConnected,
      walletAddress: isConnected ? address : null,
      connectedChainId: activeChainId ?? null,
      connectedChainName,
      contractChainId,
      contractChainName,
      ensName: ensName ?? null,
      nft: {
        hasNFT: !!hasNFT && tokenId != null,
        tokenId: tokenId ?? null,
        backgroundColor: backgroundColor ?? null,
        keyColor: keyColor ?? null,
        hasUsedTokenGate: !!hasUsedTokenGate,
      },
      jwtRequired: aiPublicConfig.requiresJwt,
    };

    const humanSummary = !isConnected
      ? 'User is not signed in via wagmi. Treat as having no NFT.'
      : !hasNFT || tokenId == null
      ? `User is signed in (wallet ${address}) on ${connectedChainName} but does not own the Key NFT.`
      : `User owns the Key NFT on ${contractChainName}: tokenId=${tokenId}, backgroundColor=${backgroundColor}, keyColor=${keyColor}.`;

    const ensInstruction = ensName
      ? `\nUser has ENS name: ${ensName}. Please address them as "${(ensName || '').replace('.eth', '')}".`
      : '';

    return [
      'NFT_CONTEXT_JSON:',
      JSON.stringify(jsonContext),
      'NFT_CONTEXT_HUMAN:',
      humanSummary,
      ensInstruction,
    ].filter(Boolean).join('\n');
  };

  useEffect(() => {
    if (!activeMode) openModal('mode');
  }, [activeMode, openModal]);

  // Insert system + synthetic welcome exactly once when a mode is chosen.
  useEffect(() => {
    if (!activeMode) return;
    const hasSystem = messages.some((m) => m.role === 'system');
    if (hasSystem) return;

    const nftContext = buildNftContext();
    const systemText = composeSystemPrompt(activeMode, nftContext);
    const welcomeText = composeWelcomeMessage(activeMode, nftContext);

    if (!systemText) return;

    // allow both system and assistant entries
    const next: { id: string; role: 'system' | 'assistant'; parts: { type: 'text'; text: string }[] }[] = [
     { id: 'system-mode', role: 'system', parts: [{ type: 'text', text: systemText }] },
    ];

    if (welcomeText && welcomeText.trim()) {
      next.push({ id: 'welcome', role: 'assistant', parts: [{ type: 'text', text: welcomeText }] });
      }


    // Cast the locally constructed array to the same type as `messages` to satisfy TS
    setMessages([...(next as unknown as typeof messages), ...messages]);
    if (open === 'mode') closeModal();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMode]);

  useEffect(() => {
    if (status === 'error' && error) {
      // Always pass retry; ErrorModal decides whether to show Refresh instead.
      openModal('error', { error: { message: error.message, retry: regenerate } });
    }
  }, [status, error, openModal, regenerate]);

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!input.trim()) return;
    if (!activeMode) { openModal('mode'); return; }
    if (!(status === 'ready' || status === 'error')) return;

    music.unlock();
    lastAttachedRef.current = null;

    sendMessage({ text: input });

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        messagesViewRef.current?.jumpToLatestUserMessageBottomAndPin(12);
      });
    });

    setInput('');
    setTextareaHeight('auto');
  };

  const onTrash = () => openModal('confirmReset');
  const handleConfirmDelete = () => {
    setMessages([]);
    useToolActivityStore.setState({
      groups: {},
      activeGroupKey: undefined,
      uiToGroup: {},
      callToGroup: {},
      anchors: {},
      seq: 0,
    });
    try { music.reset(); } catch {}
    try { useTtsAudioStore.getState().clear(); } catch {}
    setNonce(Math.random().toString(36).slice(2, 8));
    if (!lockedByProp) {
      resetMode();
      openModal('mode');
    }
  };

  const normalizePartText = (part: unknown): string => {
    if (typeof (part as { text?: unknown })?.text === 'string') return (part as { text?: string }).text as string;
    if (part == null) return '';
    try { return String(part); } catch { try { return JSON.stringify(part); } catch { return ''; } }
  };

  const displayMessages = useMemo(() =>
    messages.length === 0
      ? [{ id: 'welcome-neutral', role: 'assistant' as const, parts: [{ type: 'text' as const, text: `Pick a mode to get started.` }] }]
      : messages
          .filter((m) => m.role !== 'system')
          .map((m) => ({
            id: m.id,
            role: m.role as 'user' | 'assistant',
            parts: (m.parts || [])
              .filter((part) => isPartLike(part) && (((part.type as string | undefined) === 'text') || part.type === undefined))
              .map((part) => ({ type: 'text' as const, text: normalizePartText(part) })),
          }))
  , [messages]);

  const streamingAssistantId = useMemo(() => {
    if (status === 'ready') return null;
    const lastAssistant = [...displayMessages].reverse().find((m) => m.role === 'assistant');
    return lastAssistant?.id ?? null;
  }, [displayMessages, status]);

  const isLoading = status === 'streaming' || status === 'submitted';
  const inputDisabled = !activeMode || open !== 'none';

  return (
    <div className={stackStyles.stack}>
      <div className={stackStyles.fullWidthRow}>
        <ChatContainer>
          <ChatHeader />
          <ChatMessages
            ref={messagesViewRef}
            messages={displayMessages}
            isLoading={isLoading}
            status={status}
            error={null}
            onRegenerate={regenerate}
            textareaExpanded={textareaHeight !== 'auto'}
            streamingAssistantId={streamingAssistantId}
          />
          <ChatForm
            input={input}
            setInput={setInput}
            status={status}
            isLoading={isLoading}
            onSubmit={handleSubmit}
            onStop={stop}
            textareaHeight={textareaHeight}
            setTextareaHeight={setTextareaHeight}
            inputDisabled={inputDisabled}
            onTrash={onTrash}
          />

          <ModeSelectModal />
          <BattleFormModal />
          <ErrorModal />
          <ConfirmResetModal onConfirm={handleConfirmDelete} />
        </ChatContainer>
      </div>
      <MusicBar />
    </div>
  );
}

type ChatBotProps = ChatBotInnerProps;

export default function ChatBot({ disableNftData, initialMessages }: ChatBotProps) {
  return (
    <MusicProvider>
      <ChatBotInner disableNftData={disableNftData} initialMessages={initialMessages} />
    </MusicProvider>
  );
}

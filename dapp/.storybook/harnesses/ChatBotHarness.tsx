'use client';

import React from 'react';
import type { ArgTypes } from '@storybook/react';
import type { UIMessage } from 'ai';

import ChatBot from '@/components/chatBot';
import FetchMock from './FetchMock';
import { createChatFetchHandlers, getScenarioById, type MockChatScenario } from '../mocks/mockChat';
import { createTtsFetchHandler, type TtsMockOptions } from '../mocks/mockTts';

import { useChatModeStore } from '@/app/store/chatModeStore';
import { useModalStore, type ModalMap, type ModalType } from '@/app/store/modalStore';
import { useNFTStore } from '@/app/store/nftStore';
import { useToolActivityStore, type ToolAnchor } from '@/app/store/toolActivity';
import type { ToolCallChipData } from '@/components/chatBot/ToolActivity/ToolCallChip';
import { useLocalImageStore } from '@/app/store/toolImageStore';
import { defaultFormData, type BattleFormData } from '@/components/chatBot/forms/battleFormSchema';
import type { ChatMode } from '@/app/lib/llm/modes/types';

type GoodbyeMode = 'stub' | 'live';

export type ChatBotStoryArgs = {
  walletConnected: boolean;
  walletAccountsCsv: string;
  walletNetwork: 'mainnet' | 'sepolia' | 'polygon' | 'arbitrum' | 'avalanche' | 'base' | 'optimism' | 'fantom';
  ensEnabled: boolean;
  ensName: string;
  nftHasNFT: boolean;
  nftTokenId: number;
  nftBackgroundColor: string;
  nftKeyColor: string;
  nftHasUsedTokenGate: boolean;
};

export const chatBotStoryArgTypes: ArgTypes<ChatBotStoryArgs> = {
  walletConnected: { control: { type: 'boolean' }, table: { category: 'Wallet' } },
  walletAccountsCsv: { control: { type: 'text' }, table: { category: 'Wallet' } },
  walletNetwork: {
    control: { type: 'select' },
    options: ['mainnet', 'sepolia', 'polygon', 'arbitrum', 'avalanche', 'base', 'optimism', 'fantom'],
    table: { category: 'Wallet' },
  },
  ensEnabled: { control: { type: 'boolean' }, table: { category: 'ENS' } },
  ensName: { control: { type: 'text' }, table: { category: 'ENS' } },
  nftHasNFT: { control: { type: 'boolean' }, table: { category: 'NFT' } },
  nftTokenId: { control: { type: 'number' }, table: { category: 'NFT' } },
  nftBackgroundColor: { control: { type: 'color' }, table: { category: 'NFT' } },
  nftKeyColor: { control: { type: 'color' }, table: { category: 'NFT' } },
  nftHasUsedTokenGate: { control: { type: 'boolean' }, table: { category: 'NFT' } },
};

export const chatBotStoryArgs: ChatBotStoryArgs = {
  walletConnected: true,
  walletAccountsCsv: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
  walletNetwork: 'mainnet',
  ensEnabled: true,
  ensName: 'ritorhymes.eth',
  nftHasNFT: true,
  nftTokenId: 123,
  nftBackgroundColor: '#0b1220',
  nftKeyColor: '#22d3ee',
  nftHasUsedTokenGate: false,
};

type HarnessProps = ChatBotStoryArgs & {
  scenarioId?: string;
  scenario?: MockChatScenario;
  initialMessages?: UIMessage[];
  activeMode?: ChatMode | null;
  modal?: ModalType;
  modalPayload?: ModalMap[ModalType];
  battleFormData?: Partial<BattleFormData>;
  goodbyeMode?: GoodbyeMode;
  disableNftData?: boolean;
  includeChainLogoMock?: boolean;
  ttsMock?: TtsMockOptions;
  toolActivitySeed?: {
    uiMessageId: string;
    chips: ToolCallChipData[];
    anchor?: ToolAnchor;
    groupKey?: string;
  };
};

function parseAccountsCsv(value: string): string[] {
  return value
    .split(/[,\s]+/g)
    .map((s) => s.trim())
    .filter(Boolean);
}

function mergeBattleFormData(overrides?: Partial<BattleFormData>): BattleFormData {
  if (!overrides) return defaultFormData;
  return {
    user: { ...defaultFormData.user, ...(overrides.user ?? {}) },
    chatbot: { ...defaultFormData.chatbot, ...(overrides.chatbot ?? {}) },
  };
}

function resetToolActivityStore() {
  useToolActivityStore.setState({
    groups: {},
    activeGroupKey: undefined,
    uiToGroup: {},
    callToGroup: {},
    anchors: {},
    seq: 0,
  });
}

function setGoodbyeMode(mode: GoodbyeMode | undefined) {
  if (typeof window === 'undefined') return;
  const win = window as unknown as Window & { __RITO_GOODBYE_MODE__?: GoodbyeMode; __ritoGoodbyeHardReloadTimerId?: number };
  win.__RITO_GOODBYE_MODE__ = mode ?? 'live';

  if (mode === 'stub') {
    try {
      sessionStorage.removeItem('ritoGoodbyeHardReloadAt');
    } catch {}
    if (win.__ritoGoodbyeHardReloadTimerId) {
      clearTimeout(win.__ritoGoodbyeHardReloadTimerId);
      win.__ritoGoodbyeHardReloadTimerId = undefined;
    }
  }
}

export default function ChatBotHarness({
  scenarioId,
  scenario,
  initialMessages,
  activeMode = 'freestyle',
  modal,
  modalPayload,
  battleFormData,
  goodbyeMode = 'live',
  disableNftData = true,
  includeChainLogoMock = true,
  ttsMock,
  toolActivitySeed,
  walletAccountsCsv,
  nftHasNFT,
  nftTokenId,
  nftBackgroundColor,
  nftKeyColor,
  nftHasUsedTokenGate,
}: HarnessProps) {
  const resolvedScenario = scenario ?? getScenarioById(scenarioId ?? 'default');
  const handlers = React.useMemo(() => {
    const chatHandlers = createChatFetchHandlers({
      scenario: resolvedScenario,
      includeChainLogo: includeChainLogoMock,
    });
    return [...chatHandlers, createTtsFetchHandler(ttsMock)];
  }, [resolvedScenario, includeChainLogoMock, ttsMock]);

  React.useLayoutEffect(() => {
    setGoodbyeMode(goodbyeMode);
  }, [goodbyeMode]);

  React.useEffect(() => {
    if (activeMode) {
      useChatModeStore.setState({
        activeMode,
        origin: 'prop',
        lockedByProp: true,
        battleFormData: mergeBattleFormData(battleFormData),
      });
    } else {
      useChatModeStore.setState({
        activeMode: null,
        origin: null,
        lockedByProp: false,
        battleFormData: mergeBattleFormData(battleFormData),
      });
    }

    return () => {
      useChatModeStore.setState({
        activeMode: null,
        origin: null,
        lockedByProp: false,
        battleFormData: defaultFormData,
      });
    };
  }, [activeMode, battleFormData]);

  React.useEffect(() => {
    const modalStore = useModalStore.getState();
    if (modal) modalStore.openModal(modal, modalPayload as ModalMap[ModalType]);
    else modalStore.closeModal();

    return () => modalStore.closeModal();
  }, [modal, modalPayload]);

  React.useEffect(() => {
    const primary = parseAccountsCsv(walletAccountsCsv)[0];
    const nftStore = useNFTStore.getState();
    nftStore.resetState();
    if (primary) nftStore.setCurrentAddress(primary as `0x${string}`);

    if (nftHasNFT) {
      const tokenId = Number.isFinite(nftTokenId) ? nftTokenId : 1;
      nftStore.setTokenData(tokenId, nftBackgroundColor || null, nftKeyColor || null);
    } else {
      nftStore.setTokenData(null, null, null);
    }

    nftStore.setHasUsedTokenGate(Boolean(nftHasUsedTokenGate));

    return () => {
      nftStore.resetState();
    };
  }, [
    walletAccountsCsv,
    nftHasNFT,
    nftTokenId,
    nftBackgroundColor,
    nftKeyColor,
    nftHasUsedTokenGate,
  ]);

  React.useEffect(() => {
    resetToolActivityStore();
    useLocalImageStore.getState().clear();
  }, [resolvedScenario.id]);

  React.useEffect(() => {
    if (!toolActivitySeed) return;
    const groupKey = toolActivitySeed.groupKey ?? `seed-${toolActivitySeed.uiMessageId}`;
    const chips = Object.fromEntries(toolActivitySeed.chips.map((chip) => [chip.toolCallId, chip]));
    const callToGroup = Object.fromEntries(toolActivitySeed.chips.map((chip) => [chip.toolCallId, groupKey]));

    useToolActivityStore.setState({
      groups: {
        [groupKey]: {
          key: groupKey,
          attachedUiMessageId: toolActivitySeed.uiMessageId,
          chips,
          createdAt: Date.now(),
        },
      },
      uiToGroup: { [toolActivitySeed.uiMessageId]: groupKey },
      callToGroup,
      anchors: toolActivitySeed.anchor ? { [toolActivitySeed.uiMessageId]: toolActivitySeed.anchor } : {},
      activeGroupKey: undefined,
      seq: 0,
    });
  }, [toolActivitySeed]);

  const mountKey = React.useMemo(
    () =>
      JSON.stringify({
        scenario: resolvedScenario.id,
        messages: initialMessages?.length ?? 0,
        activeMode,
        modal,
        goodbyeMode,
        nftHasNFT,
        nftTokenId,
        nftBackgroundColor,
        nftKeyColor,
      }),
    [
      resolvedScenario.id,
      initialMessages,
      activeMode,
      modal,
      goodbyeMode,
      nftHasNFT,
      nftTokenId,
      nftBackgroundColor,
      nftKeyColor,
    ]
  );

  return (
    <FetchMock handlers={handlers}>
      <div style={{ minHeight: '100vh', padding: 24, background: '#010a12' }}>
        <div style={{ maxWidth: 980, margin: '0 auto' }}>
          <ChatBot key={mountKey} disableNftData={disableNftData} initialMessages={initialMessages} />
        </div>
      </div>
    </FetchMock>
  );
}

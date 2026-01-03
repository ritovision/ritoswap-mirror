import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import type { UIMessage } from 'ai';

import ChatBotHarness, {
  chatBotStoryArgs,
  chatBotStoryArgTypes,
  type ChatBotStoryArgs,
} from '@/.storybook/harnesses/ChatBotHarness';
import type { MockChatScenario, MockRepeatMode, MockToolCall } from '@/.storybook/mocks/mockChat';
import { toolChipFixtures } from './toolChipFixtures';
import type { ToolCallChipData } from '../ToolActivity/ToolCallChip';

type ToolOutcome = 'success' | 'error';

type StoryArgs = ChatBotStoryArgs & {
  toolOutcome: ToolOutcome;
  toolErrorText: string;
  toolOutputDelayMs: number;
};
type ToolText = string | ((args: StoryArgs) => string);
type ToolTextList = ToolText[] | ((args: StoryArgs) => string[]);

const meta: Meta<StoryArgs> = {
  title: 'ChatBot/ToolChips/InChat',
  parameters: {
    layout: 'fullscreen',
  },
  args: {
    ...chatBotStoryArgs,
    toolOutcome: 'success',
    toolErrorText: 'Tool failed',
    toolOutputDelayMs: 1400,
  },
  argTypes: {
    ...chatBotStoryArgTypes,
    toolOutcome: {
      control: { type: 'inline-radio' },
      options: ['success', 'error'],
      table: { category: 'Tool' },
    },
    toolErrorText: { control: { type: 'text' }, table: { category: 'Tool' } },
    toolOutputDelayMs: {
      control: { type: 'number', min: 0, step: 100 },
      table: { category: 'Tool' },
    },
  },
};

export default meta;
type Story = StoryObj<StoryArgs>;

const seededMessages = (text: string, id = 'seeded-assistant'): UIMessage[] => [
  { id: 'system-seed', role: 'system', parts: [{ type: 'text', text: 'storybook-seed' }] },
  { id, role: 'assistant', parts: [{ type: 'text', text }] },
];

const CHAIN_NAME_BY_NETWORK: Record<ChatBotStoryArgs['walletNetwork'], string> = {
  mainnet: 'Ethereum',
  sepolia: 'Sepolia',
  polygon: 'Polygon',
  arbitrum: 'Arbitrum',
  avalanche: 'Avalanche',
  base: 'Base',
  optimism: 'Optimism',
  fantom: 'Fantom',
};

const RITO_IMAGE_TAG =
  '<img src="/images/rito/rito-thinker.jpg" alt="Rito visual" width="240" height="240" />';
const RAP_GIF_SIZE = { width: 320, height: 180 };
const RAP_GIFS = {
  palpatine: 'https://media1.tenor.com/m/a5BfMS5dzHkAAAAd/you.gif',
  pacman: 'https://media1.tenor.com/m/uCp62jbo-OEAAAAd/good-morning.gif',
  crowd: 'dave-chappelle-crack.gif',
};

function resolveToolText(text: ToolText, args: StoryArgs) {
  return typeof text === 'function' ? text(args) : text;
}

function resolveToolTextList(list: ToolTextList, args: StoryArgs) {
  if (typeof list === 'function') {
    return list(args);
  }
  return list.map((text) => resolveToolText(text, args));
}

function resolveToolTexts(base: ToolScenarioBase, args: StoryArgs) {
  if (base.textVariants) {
    const resolved = resolveToolTextList(base.textVariants, args);
    return resolved.length ? resolved : [''];
  }
  return [resolveToolText(base.text, args)];
}

function buildRapVerseVariants(args: StoryArgs) {
  const chainName = CHAIN_NAME_BY_NETWORK[args.walletNetwork] ?? 'Ethereum';
  const tokenId = Number.isFinite(args.nftTokenId) ? String(args.nftTokenId) : '??';
  const bgColor = args.nftBackgroundColor || '#0b1220';
  const keyColor = args.nftKeyColor || '#22d3ee';
  const keyNftTag = `<key-nft bgColor="${bgColor}" keyColor="${keyColor}" width="240" height="120" />`;
  const chainLogoTag = `<chain-logo chainName="${chainName}" size="64" />`;
  const gifTag = (src: string, alt: string) =>
    `<gif src="${src}" width="${RAP_GIF_SIZE.width}" height="${RAP_GIF_SIZE.height}" alt="${alt}" />`;

  const verseA = [
    `Rito on the mic, token #${tokenId} in the light,`,
    `Background ${bgColor}, key ${keyColor}, keep the aura tight.`,
    'Key flex:',
    keyNftTag,
    `Chain shine on ${chainName}:`,
    chainLogoTag,
    'Unlimited power:',
    gifTag(RAP_GIFS.palpatine, 'You'),
  ].join('\n');

  const verseB = [
    `Pac-man in the market, token #${tokenId} on the board,`,
    `Altcoins gettin' munched while ${chainName} keeps me scored.`,
    'Key flex:',
    keyNftTag,
    `Chain shine on ${chainName}:`,
    chainLogoTag,
    'Bitcoin chomps:',
    gifTag(RAP_GIFS.pacman, 'Good morning'),
  ].join('\n');

  const verseC = [
    `Rito with the key, token #${tokenId} in the mix,`,
    `Background ${bgColor}, key ${keyColor}, vault so slick.`,
    'Key flex:',
    keyNftTag,
    `Chain shine on ${chainName}:`,
    chainLogoTag,
    'Crowd reaction:',
    gifTag(RAP_GIFS.crowd, 'Crack'),
  ].join('\n');

  return [verseA, verseB, verseC];
}

function buildRapVerseSeedText(args: StoryArgs) {
  return buildRapVerseVariants(args)[0];
}

type ToolScenarioBase = {
  id: string;
  label: string;
  text: ToolText;
  textVariants?: ToolTextList;
  repeat?: MockRepeatMode;
  chip: ToolCallChipData;
};

type ToolSeed = {
  text: ToolText;
  uiMessageId: string;
  chip: ToolCallChipData;
};

type ToolScenarioMeta = Pick<ToolScenarioBase, 'id' | 'label' | 'chip'>;

const toolScenarioBases: Record<string, ToolScenarioBase> = {
  getEthBalance: {
    id: 'toolGetBalance',
    label: 'Tool: Get ETH Balance',
    text: 'Checking balance now.',
    chip: toolChipFixtures.getEthBalance.success,
  },
  generateRapVerse: {
    id: 'toolGenerateRapVerse',
    label: 'Tool: Generate Rap Verse',
    text: buildRapVerseSeedText,
    textVariants: buildRapVerseVariants,
    chip: toolChipFixtures.generateRapVerse.success,
  },
  generateImage: {
    id: 'toolGenerateImage',
    label: 'Tool: Generate Image',
    text: `Rendering a visual:\n${RITO_IMAGE_TAG}`,
    chip: toolChipFixtures.generateImage.success,
  },
  keyNftRead: {
    id: 'toolKeyNftRead',
    label: 'Tool: Key NFT Read',
    text: 'Pulling key stats.',
    chip: toolChipFixtures.keyNftRead.success,
  },
  keyNftManage: {
    id: 'toolKeyNftManage',
    label: 'Tool: Key NFT Manage',
    text: 'Handling key NFT transaction.',
    chip: toolChipFixtures.keyNftManage.success,
  },
  keyNftUsedCount: {
    id: 'toolKeyNftUsedCount',
    label: 'Tool: Key NFT Used Count',
    text: 'Counting used keys.',
    chip: toolChipFixtures.keyNftUsedCount.success,
  },
  markKeyUsed: {
    id: 'toolMarkKeyUsed',
    label: 'Tool: Mark Key Used',
    text: 'Marking key as used.',
    chip: toolChipFixtures.markKeyUsed.success,
  },
  pineconeSearch: {
    id: 'toolPineconeSearch',
    label: 'Tool: Pinecone Search',
    text: 'Searching the knowledge base.',
    chip: toolChipFixtures.pineconeSearch.success,
  },
  sendCrypto: {
    id: 'toolSendCrypto',
    label: 'Tool: Send Crypto',
    text: 'Sending crypto now.',
    chip: toolChipFixtures.sendCrypto.success,
  },
  sendCryptoAgent: {
    id: 'toolSendCryptoAgent',
    label: 'Tool: Send Crypto Agent',
    text: 'Agent checking the request.',
    chip: toolChipFixtures.sendCryptoAgent.success,
  },
};

const toolSeeds: Record<string, ToolSeed> = {
  getEthBalance: {
    text: 'Balance check is complete.',
    uiMessageId: 'tool-balance',
    chip: toolChipFixtures.getEthBalance.success,
  },
  generateRapVerse: {
    text: buildRapVerseSeedText,
    uiMessageId: 'tool-verse',
    chip: toolChipFixtures.generateRapVerse.success,
  },
  generateImage: {
    text: `Image is ready to view:\n${RITO_IMAGE_TAG}`,
    uiMessageId: 'tool-image',
    chip: toolChipFixtures.generateImage.success,
  },
  keyNftRead: {
    text: 'Key NFT summary delivered.',
    uiMessageId: 'tool-key-read',
    chip: toolChipFixtures.keyNftRead.success,
  },
  keyNftManage: {
    text: 'Key NFT action completed.',
    uiMessageId: 'tool-key-manage',
    chip: toolChipFixtures.keyNftManage.success,
  },
  keyNftUsedCount: {
    text: 'Used key count updated.',
    uiMessageId: 'tool-key-used',
    chip: toolChipFixtures.keyNftUsedCount.success,
  },
  markKeyUsed: {
    text: 'Key marked as used.',
    uiMessageId: 'tool-key-mark',
    chip: toolChipFixtures.markKeyUsed.success,
  },
  pineconeSearch: {
    text: 'Search results are in.',
    uiMessageId: 'tool-pinecone',
    chip: toolChipFixtures.pineconeSearch.success,
  },
  sendCrypto: {
    text: 'Payment confirmed.',
    uiMessageId: 'tool-send-crypto',
    chip: toolChipFixtures.sendCrypto.success,
  },
  sendCryptoAgent: {
    text: 'Agent decision logged.',
    uiMessageId: 'tool-send-crypto-agent',
    chip: toolChipFixtures.sendCryptoAgent.success,
  },
};

function buildToolScenario(
  base: ToolScenarioMeta,
  {
    texts,
    repeat,
    outcome,
    errorText,
    outputDelayMs,
    deferTextUntilTools,
  }: {
    texts: string[];
    repeat: MockRepeatMode;
    outcome: ToolOutcome;
    errorText: string;
    outputDelayMs: number;
    deferTextUntilTools?: boolean;
  }
): MockChatScenario {
  const safeDelay = Number.isFinite(outputDelayMs) ? Math.max(0, outputDelayMs) : 0;
  const toolCall: MockToolCall = {
    toolName: base.chip.toolName,
    input: base.chip.input,
    output: base.chip.output,
    outputDelayMs: safeDelay,
    outputType: outcome === 'error' ? 'error' : 'available',
    errorText: outcome === 'error' ? errorText : undefined,
  };

  return {
    id: base.id,
    label: base.label,
    description: 'Storybook tool call scenario',
    responses: texts.map((text) => ({
      text,
      toolCalls: [toolCall],
    })),
    repeat,
    deferTextUntilTools,
  };
}

function renderToolStory(base: ToolScenarioBase, seed?: ToolSeed) {
  const ToolChipStory = (args: StoryArgs) => {
    const { toolOutcome, toolErrorText, toolOutputDelayMs, ...rest } = args;
    const texts = resolveToolTexts(base, args);
    const repeat = base.repeat ?? (texts.length > 1 ? 'cycle' : 'last');
    const seedText = seed ? resolveToolText(seed.text, args) : undefined;
    const scenario = buildToolScenario(
      { id: base.id, label: base.label, chip: base.chip },
      {
        texts,
        repeat,
        outcome: toolOutcome,
        errorText: toolErrorText,
        outputDelayMs: toolOutputDelayMs,
        deferTextUntilTools: true,
      }
    );

    return (
      <ChatBotHarness
        {...rest}
        scenario={scenario}
        initialMessages={seedText ? seededMessages(seedText, seed!.uiMessageId) : undefined}
        toolActivitySeed={
          seed
            ? {
                uiMessageId: seed.uiMessageId,
                chips: [seed.chip],
              }
            : undefined
        }
      />
    );
  };
  ToolChipStory.displayName = `ChatBotToolChips_${base.id}`;
  return ToolChipStory;
}

export const GetEthBalance: Story = {
  render: renderToolStory(toolScenarioBases.getEthBalance, toolSeeds.getEthBalance),
};

export const GetEthBalanceInteractive: Story = {
  render: renderToolStory(toolScenarioBases.getEthBalance),
};

export const GenerateRapVerse: Story = {
  render: renderToolStory(toolScenarioBases.generateRapVerse, toolSeeds.generateRapVerse),
};

export const GenerateRapVerseInteractive: Story = {
  render: renderToolStory(toolScenarioBases.generateRapVerse),
};

export const GenerateImage: Story = {
  render: renderToolStory(toolScenarioBases.generateImage, toolSeeds.generateImage),
};

export const GenerateImageInteractive: Story = {
  render: renderToolStory(toolScenarioBases.generateImage),
};

export const KeyNftRead: Story = {
  render: renderToolStory(toolScenarioBases.keyNftRead, toolSeeds.keyNftRead),
};

export const KeyNftReadInteractive: Story = {
  render: renderToolStory(toolScenarioBases.keyNftRead),
};

export const KeyNftManage: Story = {
  render: renderToolStory(toolScenarioBases.keyNftManage, toolSeeds.keyNftManage),
};

export const KeyNftManageInteractive: Story = {
  render: renderToolStory(toolScenarioBases.keyNftManage),
};

export const KeyNftUsedCount: Story = {
  render: renderToolStory(toolScenarioBases.keyNftUsedCount, toolSeeds.keyNftUsedCount),
};

export const KeyNftUsedCountInteractive: Story = {
  render: renderToolStory(toolScenarioBases.keyNftUsedCount),
};

export const MarkKeyUsed: Story = {
  render: renderToolStory(toolScenarioBases.markKeyUsed, toolSeeds.markKeyUsed),
};

export const MarkKeyUsedInteractive: Story = {
  render: renderToolStory(toolScenarioBases.markKeyUsed),
};

export const PineconeSearch: Story = {
  render: renderToolStory(toolScenarioBases.pineconeSearch, toolSeeds.pineconeSearch),
};

export const PineconeSearchInteractive: Story = {
  render: renderToolStory(toolScenarioBases.pineconeSearch),
};

export const SendCrypto: Story = {
  render: renderToolStory(toolScenarioBases.sendCrypto, toolSeeds.sendCrypto),
};

export const SendCryptoInteractive: Story = {
  render: renderToolStory(toolScenarioBases.sendCrypto),
};

export const SendCryptoAgent: Story = {
  render: renderToolStory(toolScenarioBases.sendCryptoAgent, toolSeeds.sendCryptoAgent),
};

export const SendCryptoAgentInteractive: Story = {
  render: renderToolStory(toolScenarioBases.sendCryptoAgent),
};

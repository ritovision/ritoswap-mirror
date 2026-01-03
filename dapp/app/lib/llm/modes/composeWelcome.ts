// dapp/lib/llm/modes/composeWelcome.ts
import { ChatMode } from './types';
import { getModeConfig } from './configs';
import { useChatModeStore } from '@store/chatModeStore';

const FIELD_LABELS: Record<string, string> = {
  favoriteBlockchains: 'Favorite blockchain(s)',
  favoriteNftCollection: 'Favorite NFT collection',
  placeOfOrigin: 'Place of origin',
  careerJobTitles: 'Career/Job titles',
  personalQuirks: 'Personal quirks',
  thingsToBragAbout: 'Things to brag about',
  thingsToBeAshamedOf: 'Things to be ashamed of',
};

function formatBackgroundSection(nftContext?: string): string {
  const { user, chatbot } = useChatModeStore.getState().battleFormData;

  const hasUserContent = Object.values(user).some((v) => v && v.trim());
  const hasChatbotContent = Object.values(chatbot).some((v) => v && v.trim());

  if (!hasUserContent && !hasChatbotContent) {
    return '';
  }

  const lines: string[] = ['## Background', ''];

  if (hasChatbotContent) {
    lines.push('### RapBotRito');
    Object.entries(chatbot).forEach(([key, value]) => {
      if (value && value.trim()) {
        const label = FIELD_LABELS[key] || key;
        lines.push(`${label}: ${value}`);
      }
    });
    lines.push('');
  }

  if (hasUserContent) {
    let userName = 'You';
    if (nftContext) {
      const ensMatch = nftContext.match(/"ensName"\s*:\s*"([^"]+)"/);
      if (ensMatch && ensMatch[1]) {
        userName = ensMatch[1];
      }
    }

    lines.push(`### ${userName}`);
    Object.entries(user).forEach(([key, value]) => {
      if (value && value.trim()) {
        const label = FIELD_LABELS[key] || key;
        lines.push(`${label}: ${value}`);
      }
    });
    lines.push('');
  }

  return lines.join('\n');
}

export function composeWelcomeMessage(
  mode: ChatMode,
  nftContext?: string
): string | null {
  if (mode === 'choose') return null;
  const config = getModeConfig(mode);
  if (!config) return null;

  try {
    const baseWelcome = config.buildWelcome(nftContext);
    
    if (mode === 'rapBattle' || mode === 'agentBattle') {
      const backgroundSection = formatBackgroundSection(nftContext);
      if (backgroundSection) {
        return `${baseWelcome}\n\n${backgroundSection}`;
      }
    }
    
    return baseWelcome;
  } catch (err) {
    console.error('Error building welcome message:', err);
    return null;
  }
}
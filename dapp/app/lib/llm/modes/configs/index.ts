// dapp/lib/llm/modes/configs/index.ts
import { rapBattleConfig } from './rapBattle';
import { freestyleConfig } from './freestyle';
import { agentBattleConfig } from './agentBattle';
import { ChatMode, ModeConfig } from '../types';

export const modeConfigs: Record<Exclude<ChatMode, 'choose'>, ModeConfig> = {
  rapBattle: rapBattleConfig,
  freestyle: freestyleConfig,
  agentBattle: agentBattleConfig,
};

export function getModeConfig(mode: ChatMode): ModeConfig | null {
  if (mode === 'choose') return null;
  return modeConfigs[mode];
}

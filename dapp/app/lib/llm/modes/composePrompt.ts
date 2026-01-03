// dapp/lib/llm/modes/composePrompt.ts
import { ChatMode } from './types';
import { getModeConfig } from './configs';

export function composeSystemPrompt(
  mode: ChatMode,
  nftContext?: string
): string | null {
  if (mode === 'choose') {
    return null;
  }
  
  const config = getModeConfig(mode);
  if (!config) {
    console.error(`No config found for mode: ${mode}`);
    return null;
  }
  
  return config.buildPrompt(nftContext);
}

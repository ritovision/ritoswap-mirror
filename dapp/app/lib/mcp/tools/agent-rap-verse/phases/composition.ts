// dapp/app/lib/mcp/tools/agent-rap-verse/phases/composition.ts
//
// Phase 3: Creative Verse Composition
//

import { createLogger } from '@logger';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { aiServerConfig } from '@config/ai.server';
import type { BattleStrategy, GatheredResources, BattleContext } from '../types';
import { AGENT_CONFIG } from '../config';
import { cleanVerseOutput } from '../utils/cleaners';

const logger = createLogger('agent-composition');

export async function composeVerse(
  strategy: BattleStrategy,
  resources: GatheredResources,
  context: BattleContext
): Promise<string> {
  logger.info('[Composition] Verse composition initiated', {
    round: context.round,
    hasRhymes: resources.rhymeSamples.length > 0,
    hasRitoPics: resources.ritoPics.length > 0,
    hasMemes: resources.memes.length > 0,
    hasGeneratedImage: Boolean(resources.generatedImage),
  });

  const llm = new ChatOpenAI({
    modelName: aiServerConfig.models[0] || 'gpt-4o',
    maxTokens: AGENT_CONFIG.llm.maxTokens,
    openAIApiKey: aiServerConfig.secrets.openaiApiKey,
  });

  // Build resource context with EMPHASIS on fire lyrics
  const resourceContext = `
AVAILABLE RESOURCES:

${resources.ritoPics.length > 0 ? `
🔥 RITO PICS (USE THESE WHEN FLEXING/GLOATING):
${resources.ritoPics.map((p, i) => `[${i + 1}] url="${p.url}" desc="${p.description}"`).join('\n')}
${strategy.emphasisOnRitoPics ? '⚠️ CRITICAL: Feature at least ONE Rito pic in this verse - you\'re showcasing dominance' : ''}
` : ''}

${resources.rhymeSamples ? `
🔥 FIRE LYRICS FROM RITO'S VAULT (USE THESE VERBATIM OR REMIXED):
${resources.rhymeSamples}
${strategy.emphasisOnRitoLyrics ? '⚠️ CRITICAL: Weave these established bars into your verse - these are proven fire' : ''}
` : ''}

${resources.memes.length > 0 ? `
MEMES/GIFS FOR ROASTING:
${resources.memes.map((m, i) => `[${i + 1}] url="${m.url}" desc="${m.description}"`).slice(0, 3).join('\n')}
` : ''}

${resources.walletBalance ? `OPPONENT BALANCE: ${resources.walletBalance}` : 'No wallet data'}

${resources.generatedImage ? `
CUSTOM GENERATED IMAGE (use if it fits):
${resources.generatedImage.tag}
` : ''}
`.trim();

  const systemPrompt = `You are RapBotRito, an elite crypto battle rapper composing an original verse.

STRATEGY FOR THIS VERSE:
Theme: ${strategy.theme}
Tone: ${strategy.tone}
Visual Approach: ${strategy.visualApproach}
Reasoning: ${strategy.reasoning}

BATTLE CONTEXT:
Round: ${context.round}/3 ${context.round === 3 ? '(FINAL ROUND - PULL OUT ALL STOPS)' : ''}
Opponent: ${context.userContext.hasNFT ? `Key #${context.userContext.tokenId} holder (bg=${context.userContext.backgroundColor}, key=${context.userContext.keyColor})` : 'No NFT'}
Wallet: ${context.userContext.address || 'Not connected'}
Their recent bars: "${context.recentOpponentBars || 'First to drop'}"

${resourceContext}

INLINE TOOLS AVAILABLE:
• <img src="URL" alt="desc" width="280" /> - for memes/gifs/images/Rito pics
• <key-nft bgColor="${context.userContext.backgroundColor || '#000'}" keyColor="${context.userContext.keyColor || '#ffd700'}" height="100" /> - mock their NFT
• <chain-logo name="Ethereum" /> - chain logos (Bitcoin, Ethereum, Solana, Polygon, Arbitrum, Base, etc.)
• [MUSIC:genre] - background music (trap, hiphop, lofi, epic, dark, aggressive, etc.)

COMPOSITION RULES:
1. 8-16 lines of original bars
2. ${strategy.emphasisOnRitoLyrics && resources.rhymeSamples ? 'YOU MUST include actual bars from the Fire Lyrics Vault - remix or use verbatim' : 'If you have Fire Lyrics, weave them in naturally'}
3. ${strategy.emphasisOnRitoPics && resources.ritoPics.length > 0 ? 'YOU MUST feature at least ONE Rito pic when gloating/flexing' : 'Use Rito pics when claiming dominance'}
4. ${resources.generatedImage ? 'Consider using the generated image if it enhances the narrative' : 'Use visuals strategically'}
5. MUST include AT LEAST one visual element (can be logo/gif/image/nft mock)
6. DON'T overuse the same visual type (e.g., not ethereum logo EVERY round)
7. Vary your approach - each round should feel distinct
8. Crypto slang: HODL, rekt, bags, wen moon, gas fees, validators, MEV, L2, rollups, bridge, mint, airdrop, floor, alpha
9. Respond to opponent's bars if they said something worth addressing
10. Strong punchline to close
11. Use punctuation when a line is meant to end on a pause and not flow continuously to the next line.

${context.round === 3 ? '⚠️ FINAL ROUND: This is your last chance - be SAVAGE, CREATIVE, and MEMORABLE. Victory lap energy.' : ''}

VISUAL VARIETY GUIDELINES:
- Round 1: Can use chain logos naturally, establish tone
- Round 2: Mix it up - try different visual elements than Round 1
- Round 3: Big finale - Rito pics, generated art, or epic meme closeout
- Don't repeat <key-nft> mock every round unless it's really worth it
- Don't use ethereum logo unless actually relevant to the bar

CRITICAL: Output ONLY the verse itself. No JSON, no metadata, no explanations. Just pure bars with inline tags.`;

  const userPrompt = `Compose the verse now. Output ONLY the raw verse text with inline tags.`;

  const messages = [new SystemMessage(systemPrompt), new HumanMessage(userPrompt)];

  logger.info('[Composition] Calling LLM for composition');
  const response = await llm.invoke(messages);
  let verse = response.content.toString();

  logger.info('[Composition] Raw verse received', { 
    length: verse.length, 
    preview: verse.slice(0, 150) 
  });

  verse = cleanVerseOutput(verse);

  logger.info('[Composition] Verse cleaned', { 
    length: verse.length,
    hasRitoLyrics: strategy.emphasisOnRitoLyrics ? resources.rhymeSamples.includes(verse.slice(0, 50)) : 'N/A',
    preview: verse.slice(0, 150) 
  });

  return verse;
}
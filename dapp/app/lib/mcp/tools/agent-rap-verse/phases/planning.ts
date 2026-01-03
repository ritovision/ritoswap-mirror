// dapp/app/lib/mcp/tools/agent-rap-verse/phases/planning.ts
//
// Phase 1: Strategic Planning
//

import { createLogger } from '@logger';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { aiServerConfig } from '@config/ai.server';
import type { AgentParams, BattleStrategy, BattleContext } from '../types';
import { AGENT_CONFIG } from '../config';

const logger = createLogger('agent-planning');

export async function planBattleStrategy(
  params: AgentParams,
  context: BattleContext
): Promise<BattleStrategy> {
  logger.info('[Planning] Strategic planning initiated', { round: context.round });

  const llm = new ChatOpenAI({
    modelName: aiServerConfig.models[0] || 'gpt-4o',
    maxTokens: AGENT_CONFIG.llm.maxTokens,
    openAIApiKey: aiServerConfig.secrets.openaiApiKey,
  });

  const imageWeight = AGENT_CONFIG.planning.imageGenerationWeights[`round${context.round}` as keyof typeof AGENT_CONFIG.planning.imageGenerationWeights];
  const ritoWeight = AGENT_CONFIG.planning.ritoShowcaseWeights[`round${context.round}` as keyof typeof AGENT_CONFIG.planning.ritoShowcaseWeights];

  const systemPrompt = `You are RapBotRito's strategic AI brain. Analyze the battle context and decide the optimal approach.

BATTLE CONTEXT:
- Round: ${context.round}/3 ${context.round === 3 ? '(FINAL ROUND - GO NUCLEAR)' : ''}
- Opponent has NFT: ${context.userContext.hasNFT ? `Yes (Key #${context.userContext.tokenId})` : 'No'}
- Opponent wallet: ${context.userContext.address ? 'Connected' : 'Not connected'}
- Recent opponent bars: "${context.recentOpponentBars || 'No bars yet'}"

YOUR TASK:
Decide on a battle strategy that will maximize impact. Be creative and vary your approach - don't use the same strategy every round.

CRITICAL REQUIREMENTS:
1. ENSURE IMAGE GENERATION: With ${imageWeight * 100}% weight for this round, consider generating a custom image to enhance impact
2. RITO SHOWCASE: With ${ritoWeight * 100}% weight, consider featuring Rito pics when gloating/flexing
3. USE FIRE LYRICS: If searching rhymes, you MUST weave them into the verse verbatim or remixed
4. VARIETY: Don't repeat visual approaches from previous rounds
5. AT LEAST ONE RITO PIC should appear somewhere across all 3 rounds - be strategic about when

OUTPUT VALID JSON ONLY:
{
  "theme": "string - what angle to attack from (e.g., 'flex on bags', 'mock their NFT', 'crypto supremacy', 'lyrical dominance')",
  "tone": "aggressive | playful | technical | savage",
  "visualApproach": "meme-heavy | self-promo | minimal | generated-art | rito-showcase",
  "needsResourceSearch": {
    "memes": boolean,
    "ritoPics": boolean,
    "rhymes": boolean,
    "walletInfo": boolean
  },
  "shouldGenerateImage": boolean,
  "imagePromptIdea": "string - ONLY if shouldGenerateImage is true, describe a fire image concept",
  "emphasisOnRitoLyrics": boolean - true if you want to heavily feature Rito's established bars,
  "emphasisOnRitoPics": boolean - true if this round should showcase Rito imagery,
  "reasoning": "string - brief explanation of strategy"
}

DECISION GUIDELINES:
- Round 1: Can be more exploratory, set the tone
- Round 2: Respond to their first verse, escalate intensity
- Round 3: FINAL BLOW - be most aggressive, pull out all stops
- Mix up visualApproach between rounds (track what you used before)
- Generate images when they add real narrative value (not just decoration)
- Use ritoPics when claiming dominance/victory (especially Round 2-3)
- Search rhymes when you want to drop established legendary bars
- Search memes for humor/roasting with visual punch
- Get wallet info to roast their actual bags (if connected)
- emphasisOnRitoLyrics should be true if rhyme search is important to strategy
- emphasisOnRitoPics should be true if showcasing Rito is core to this round's flex

Remember: ORIGINALITY over templates. Every strategy should feel distinct. Each round should build on the last.`;

  const userPrompt = `Analyze the battle context and output your strategic decision as valid JSON.`;

  const messages = [new SystemMessage(systemPrompt), new HumanMessage(userPrompt)];

  try {
    const response = await llm.invoke(messages);
    let content = response.content.toString();
    
    // Extract JSON from markdown blocks if present
    const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      content = jsonMatch[1] || jsonMatch[0];
    }
    
    const strategy = JSON.parse(content) as BattleStrategy;
    
    logger.info('[Planning] Strategy decided', {
      theme: strategy.theme,
      tone: strategy.tone,
      visualApproach: strategy.visualApproach,
      willGenerateImage: strategy.shouldGenerateImage,
      emphasisOnRitoLyrics: strategy.emphasisOnRitoLyrics,
      emphasisOnRitoPics: strategy.emphasisOnRitoPics,
    });
    
    return strategy;
  } catch (err) {
    const error = err as Error;
    logger.error('[Planning] Strategy planning failed, using fallback', { error: error.message });
    
    // Fallback strategy with sensible defaults
    return {
      theme: context.round === 3 ? 'final victory' : 'crypto dominance',
      tone: context.round === 3 ? 'savage' : 'aggressive',
      visualApproach: context.round === 3 ? 'rito-showcase' : 'minimal',
      needsResourceSearch: {
        memes: context.round <= 2,
        ritoPics: context.round >= 2,
        rhymes: true,
        walletInfo: Boolean(context.userContext.address),
      },
      shouldGenerateImage: context.round === 2, // At least generate one in Round 2
      emphasisOnRitoLyrics: true,
      emphasisOnRitoPics: context.round >= 2,
      reasoning: 'Fallback strategy due to planning error',
    };
  }
}
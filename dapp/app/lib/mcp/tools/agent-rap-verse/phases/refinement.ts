// dapp/app/lib/mcp/tools/agent-rap-verse/phases/refinement.ts
//
// Phase 5: Optional Verse Refinement
//

import { createLogger } from '@logger';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { aiServerConfig } from '@config/ai.server';
import type { BattleStrategy, GatheredResources, VerseReview, BattleContext } from '../types';
import { AGENT_CONFIG } from '../config';
import { cleanVerseOutput } from '../utils/cleaners';

const logger = createLogger('agent-refinement');

export async function refineVerse(
  originalVerse: string,
  review: VerseReview,
  strategy: BattleStrategy,
  resources: GatheredResources,
  context: BattleContext
): Promise<string> {
  logger.info('[Refinement] Refinement initiated', { 
    focus: review.refinementFocus,
    round: context.round 
  });

  const llm = new ChatOpenAI({
    modelName: aiServerConfig.models[0] || 'gpt-4o',
    maxTokens: AGENT_CONFIG.llm.maxTokens,
    openAIApiKey: aiServerConfig.secrets.openaiApiKey,
  });

  const systemPrompt = `You are RapBotRito refining your verse based on feedback.

ORIGINAL VERSE:
${originalVerse}

REVIEW FEEDBACK:
Strengths: ${review.strengths.join(', ')}
Weaknesses: ${review.weaknesses.join(', ')}
Focus on: ${review.refinementFocus || 'general improvement'}

STRATEGY:
Theme: ${strategy.theme}
Tone: ${strategy.tone}
Round: ${context.round}/3

AVAILABLE RESOURCES REMINDER:
${resources.ritoPics.length > 0 ? `- ${resources.ritoPics.length} Rito pics available` : ''}
${resources.rhymeSamples ? `- Fire lyrics available (${resources.rhymeSamples.slice(0, 100)}...)` : ''}
${resources.memes.length > 0 ? `- ${resources.memes.length} memes/gifs available` : ''}
${resources.generatedImage ? `- Generated image: ${resources.generatedImage.tag}` : ''}

YOUR TASK:
Refine the verse to address the weaknesses while preserving the strengths. This is your ONE revision - make it count.

REFINEMENT PRIORITIES:
1. Address the specific weakness mentioned in feedback
2. Keep any strong bars from the original
3. If strategy emphasized Rito lyrics/pics and they're missing, add them now
4. Strengthen the punchline if weak
5. Improve flow if choppy

CRITICAL: Output ONLY the refined verse. No JSON, no explanations, just the improved bars with inline tags.`;

  const userPrompt = `Output the refined verse now.`;

  const messages = [new SystemMessage(systemPrompt), new HumanMessage(userPrompt)];

  logger.info('[Refinement] Calling LLM for refinement');
  const response = await llm.invoke(messages);
  let refinedVerse = response.content.toString();

  refinedVerse = cleanVerseOutput(refinedVerse);

  logger.info('[Refinement] Refinement complete', { 
    originalLength: originalVerse.length,
    refinedLength: refinedVerse.length,
    preview: refinedVerse.slice(0, 150) 
  });

  return refinedVerse;
}
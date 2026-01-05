// dapp/app/lib/mcp/tools/agent-rap-verse/phases/review.ts
//
// Phase 4: Self-Review & Quality Control
//

import { createLogger } from '@logger';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { aiServerConfig } from '@config/ai.server';
import type { BattleStrategy, VerseReview } from '../types';
import { AGENT_CONFIG } from '../config';

const logger = createLogger('agent-review');

export async function reviewVerse(
  verse: string,
  strategy: BattleStrategy,
  round: number
): Promise<VerseReview> {
  logger.info('[Review] Verse review initiated', { round, verseLength: verse.length });

  const llm = new ChatOpenAI({
    modelName: aiServerConfig.models[0] || 'gpt-4o',
    maxTokens: AGENT_CONFIG.llm.maxTokens,
    openAIApiKey: aiServerConfig.secrets.openaiApiKey,
  });

  const systemPrompt = `You are RapBotRito's quality control AI. Review the composed verse against quality criteria.

VERSE TO REVIEW:
${verse}

ORIGINAL STRATEGY:
Theme: ${strategy.theme}
Tone: ${strategy.tone}
Visual Approach: ${strategy.visualApproach}
Emphasis on Rito Lyrics: ${strategy.emphasisOnRitoLyrics}
Emphasis on Rito Pics: ${strategy.emphasisOnRitoPics}
Round: ${round}/3

EVALUATION CRITERIA:
1. ✅ Originality - Does it feel fresh or recycled?
2. ✅ Relevance - Does it fit the theme and strategy?
3. ✅ Visual Balance - Are visuals well-integrated (not forced)?
4. ✅ Impact - Does it have strong punchlines?
5. ✅ Technical Quality - Flow, rhyme scheme, wordplay?
6. ✅ Strategy Adherence - Did it follow the strategy (e.g., use Rito lyrics if emphasized)?
7. ✅ Variety - Does it avoid repetitive patterns?

OUTPUT VALID JSON ONLY:
{
  "isReadyToShip": boolean,
  "strengths": ["list", "of", "strengths"],
  "weaknesses": ["list", "of", "weaknesses"],
  "shouldRefine": boolean,
  "refinementFocus": "string - what specifically to improve (only if shouldRefine is true)"
}

REVIEW GUIDELINES:
- Be critical but fair
- Only recommend refinement for SIGNIFICANT issues (missing strategy elements, weak flow, no punchline)
- Minor issues are acceptable - don't be perfectionist
- Refinement costs tokens, so only refine when truly needed
- If the verse is 80%+ good, ship it
- Round 3 should have highest standards since it's the finale`;

  const userPrompt = `Review the verse and output your evaluation as valid JSON.`;

  const messages = [new SystemMessage(systemPrompt), new HumanMessage(userPrompt)];

  try {
    const response = await llm.invoke(messages);
    let content = response.content.toString();
    
    const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      content = jsonMatch[1] || jsonMatch[0];
    }
    
    const review = JSON.parse(content) as VerseReview;
    
    logger.info('[Review] Review complete', {
      isReadyToShip: review.isReadyToShip,
      shouldRefine: review.shouldRefine,
      strengths: review.strengths.length,
      weaknesses: review.weaknesses.length,
    });
    
    return review;
  } catch (err) {
    const error = err as Error;
    logger.error('[Review] Review failed, defaulting to ship', { error: error.message });
    
    // Default to shipping if review fails
    return {
      isReadyToShip: true,
      strengths: ['Verse composed successfully'],
      weaknesses: [],
      shouldRefine: false,
    };
  }
}
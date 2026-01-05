// dapp/app/lib/mcp/tools/agent-rap-verse/orchestrator.ts
//
// Main agent orchestration - coordinates all phases
//

import { createLogger } from '@logger';
import type { AgentParams, AgentOutput, BattleContext, StoreImagePayload } from './types';
import { getRecentOpponentBars } from './utils/cleaners';
import { planBattleStrategy } from './phases/planning';
import { gatherResources } from './phases/gathering';
import { composeVerse } from './phases/composition';
import { reviewVerse } from './phases/review';
import { refineVerse } from './phases/refinement';
import { AGENT_CONFIG } from './config';

const logger = createLogger('agent-orchestrator');

export async function runAgent(params: AgentParams): Promise<AgentOutput> {
  const round = params.roundNumber || 1;
  const userContext = params.userContext || {};
  const chatHistory = params.chatHistory || [];

  logger.info('[Agent] Starting battle rap agent', {
    round,
    hasUserContext: Boolean(params.userContext),
    historyLength: chatHistory.length,
  });

  // Build battle context
  const context: BattleContext = {
    round,
    userContext,
    recentOpponentBars: getRecentOpponentBars(chatHistory, AGENT_CONFIG.resources.maxOpponentBars),
    totalRounds: 3,
  };

  // ============================================================================
  // PHASE 1: STRATEGIC PLANNING
  // ============================================================================
  
  logger.info('[Agent] Phase 1: Strategic Planning');
  const strategy = await planBattleStrategy(params, context);

  // ============================================================================
  // PHASE 2: DYNAMIC RESOURCE GATHERING
  // ============================================================================
  
  logger.info('[Agent] Phase 2: Resource Gathering');
  const resources = await gatherResources(strategy, userContext);

  // Track resources used
  const resourcesUsed: string[] = [];
  if (resources.memes.length > 0) resourcesUsed.push('memes');
  if (resources.ritoPics.length > 0) resourcesUsed.push('ritoPics');
  if (resources.rhymeSamples) resourcesUsed.push('rhymes');
  if (resources.walletBalance) resourcesUsed.push('walletBalance');
  if (resources.generatedImage) resourcesUsed.push('generatedImage');

  // ============================================================================
  // PHASE 3: CREATIVE COMPOSITION
  // ============================================================================
  
  logger.info('[Agent] Phase 3: Verse Composition');
  let verse = await composeVerse(strategy, resources, context);

  // ============================================================================
  // PHASE 4: SELF-REVIEW
  // ============================================================================
  
  logger.info('[Agent] Phase 4: Self-Review');
  const review = await reviewVerse(verse, strategy, round);

  let refinementCount = 0;

  // ============================================================================
  // PHASE 5: OPTIONAL REFINEMENT (max 1)
  // ============================================================================
  
  if (review.shouldRefine && !review.isReadyToShip && refinementCount < AGENT_CONFIG.review.maxRefinements) {
    logger.info('[Agent] Phase 5: Refinement (verse needs improvement)');
    verse = await refineVerse(verse, review, strategy, resources, context);
    refinementCount = 1;
  } else {
    logger.info('[Agent] Phase 5: Skipped (verse is ready to ship)');
  }

  // ============================================================================
  // FINAL VALIDATION
  // ============================================================================
  
  if (verse.length < AGENT_CONFIG.composition.minVerseLength) {
    logger.error('[Agent] Final verse too short', { length: verse.length });
    throw new Error('Failed to generate acceptable verse - output too short');
  }

  // Collect image payloads for SSE forwarding
  const imagePayloads: StoreImagePayload[] = [];
  if (resources.generatedImage) {
    imagePayloads.push(resources.generatedImage.payload);
  }

  logger.info('[Agent] Agent execution complete', {
    round,
    verseLength: verse.length,
    resourcesUsed,
    refinementCount,
    imagePayloads: imagePayloads.length,
    isReadyToShip: review.isReadyToShip,
    hadRitoLyrics: strategy.emphasisOnRitoLyrics,
    hadRitoPics: strategy.emphasisOnRitoPics,
  });

  return {
    verse,
    metadata: {
      strategy,
      resourcesUsed,
      refinementCount,
      reviewResults: review,
      generatedAt: new Date().toISOString(),
    },
    imagePayloads,
  };
}
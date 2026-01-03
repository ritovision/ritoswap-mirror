// dapp/app/lib/mcp/tools/agent-rap-verse/config.ts
//
// Configuration and constants for rap battle agent
//

export const AGENT_CONFIG = {
  // LLM settings
  llm: {
    maxTokens: 8000,
  },

  // Resource limits
  resources: {
    maxMemes: 4,
    maxRitoPics: 3,
    maxRhymeSamples: 600, // characters
    maxOpponentBars: 400, // characters
  },

  // Planning settings
  planning: {
    // Ensure at least 1 generated image across 3 rounds
    imageGenerationWeights: {
      round1: 0.3, // 30% chance
      round2: 0.5, // 50% chance
      round3: 0.6, // 60% chance (final round, go big)
    },
    // Force Rito pics in at least one round
    ritoShowcaseWeights: {
      round1: 0.4,
      round2: 0.5,
      round3: 0.7, // Most likely in final round (victory lap)
    },
  },

  // Composition settings
  composition: {
    minVerseLength: 50,
    idealVerseLines: [8, 14], // 8-14 lines
    mustIncludeVisual: true,
  },

  // Review settings
  review: {
    maxRefinements: 1,
    criticalIssuesOnly: true, // Only refine for major problems
  },
} as const;

// Visual element variety tracker (to avoid repetition)
export const VISUAL_ELEMENT_TYPES = [
  'chain-logo',
  'key-nft',
  'meme-gif',
  'rito-pic',
  'generated-image',
  'music',
] as const;

export type VisualElementType = typeof VISUAL_ELEMENT_TYPES[number];
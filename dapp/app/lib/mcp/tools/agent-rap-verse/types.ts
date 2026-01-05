// dapp/app/lib/mcp/tools/agent-rap-verse/types.ts
//
// Type definitions for rap battle agent
//

export interface UserContext {
  address?: string;
  hasNFT?: boolean;
  tokenId?: string;
  backgroundColor?: string;
  keyColor?: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content?: string;
  text?: string;
}

export interface AgentParams {
  chatHistory?: ChatMessage[];
  userContext?: UserContext;
  roundNumber?: number;
}

export interface BattleStrategy {
  theme: string;
  tone: 'aggressive' | 'playful' | 'technical' | 'savage';
  visualApproach: 'meme-heavy' | 'self-promo' | 'minimal' | 'generated-art' | 'rito-showcase';
  needsResourceSearch: {
    memes: boolean;
    ritoPics: boolean;
    rhymes: boolean;
    walletInfo: boolean;
  };
  shouldGenerateImage: boolean;
  imagePromptIdea?: string;
  reasoning: string;
  emphasisOnRitoLyrics: boolean;
  emphasisOnRitoPics: boolean;
}

export interface VectorMatch {
  url?: string;
  id?: string;
  metadata?: {
    url?: string;
    description?: string;
    [key: string]: unknown;
  };
}

export interface GatheredResources {
  memes: Array<{ url: string; description: string }>;
  ritoPics: Array<{ url: string; description: string }>;
  rhymeSamples: string;
  walletBalance: string;
  generatedImage?: {
    tag: string;
    payload: StoreImagePayload;
  };
}

export interface StoreImagePayload {
  kind: 'store-image';
  name: string;
  mimeType: string;
  base64Data: string;
}

export interface ToolCallResult {
  content: Array<{
    type: 'text' | 'json';
    text?: string;
    data?: unknown;
  }>;
}

export interface VerseReview {
  isReadyToShip: boolean;
  strengths: string[];
  weaknesses: string[];
  shouldRefine: boolean;
  refinementFocus?: string;
}

export interface AgentOutput {
  verse: string;
  metadata: {
    strategy: BattleStrategy;
    resourcesUsed: string[];
    refinementCount: number;
    reviewResults: VerseReview;
    generatedAt: string;
  };
  imagePayloads: StoreImagePayload[];
}

export interface BattleContext {
  round: number;
  userContext: UserContext;
  recentOpponentBars: string;
  totalRounds: number;
}
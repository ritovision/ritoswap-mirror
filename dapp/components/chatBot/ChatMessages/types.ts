// dapp/components/utilities/chatBot/ChatMessages/types.ts

export interface MessagePart {
  type: 'text';
  text: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  parts: MessagePart[];
}

export interface ChatMessagesProps {
  messages: Message[];
  isLoading: boolean;
  status: string;
  error?: { message: string } | null;
  onRegenerate: () => void;
  textareaExpanded: boolean;
  streamingAssistantId?: string | null;
}

export type InlineRun = { type: 'text' | 'strong' | 'em'; content: string };

export type FormattedTextSegment = {
  type: 'formattedText';
  inline: InlineRun[];
};

export type HeadingSegment = {
  type: 'heading';
  level: 1 | 2 | 3 | 4;
  inline: InlineRun[];
};

export type MusicSegment = {
  type: 'music';
  song?: string;
  ext?: string;
  action?: 'play' | 'pause' | 'toggle';
  timeline?: number;
  autoplay?: boolean;
};

/** NEW: inline "refresh page" tool segment (<goodbye />) */
export type GoodbyeSegment = {
  type: 'goodbye';
  width?: number;
  height?: number;
  seconds?: number;
};

export type MediaSegment =
  | { type: 'text'; content: string }              // legacy plain text (still used for some fallbacks)
  | { type: 'link'; label: string; href: string }
  | { type: 'svg'; content: string }
  | { type: 'image'; content: string }
  | { type: 'gif'; src: string; width?: number; height?: number; alt?: string }
  | { type: 'chainLogo'; chainName: string; size?: number }
  | MusicSegment
  | GoodbyeSegment
  | FormattedTextSegment
  | HeadingSegment;

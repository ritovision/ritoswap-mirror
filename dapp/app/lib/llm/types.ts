// app/lib/llm/types.ts
export type DataStreamParts = {
  start: (messageId: string) => void;
  startStep: () => void;
  finishStep: () => void;

  textStart: (id: string) => void;
  textDelta: (id: string, delta: string) => void;
  textEnd: (id: string) => void;

  toolInputStart: (toolCallId: string, toolName: string) => void;
  toolInputDelta: (toolCallId: string, inputTextDelta: string) => void;
  toolInputAvailable: (toolCallId: string, toolName: string, input: unknown) => void;
  toolInputError: (toolCallId: string, errorText: string) => void;

  toolOutputAvailable: (toolCallId: string, output: unknown) => void;
  toolOutputError: (toolCallId: string, errorText: string) => void;

  error: (errorText: string) => void;
  finish: () => void;
  done: () => void;
};

export type SseInit = {
  stream: ReadableStream<Uint8Array>;
  parts: DataStreamParts;
  isClosed: () => boolean;
};

/**
 * Pieces the UI may send as message content.
 * Supports plain strings or small objects carrying text/delta fields.
 */
export type TextPiece =
  | string
  | {
      text?: string;
      delta?: string;
    };

/** Canonical content shape accepted by converters. */
export type MessageContent = string | TextPiece[] | { text?: string };

/** UI message as received from the client/UI layer. */
export interface UiMessage {
  role: 'system' | 'user' | 'assistant' | string;
  content?: MessageContent;
  parts?: MessageContent;
  text?: MessageContent;
}

/** Minimal logger surface used by streaming code. */
export interface LoggerLike {
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
}

export type StreamingContext = {
  parts: DataStreamParts;
  isClosed: () => boolean;
  logger: LoggerLike;
};

// dapp/components/utilities/chatBot/ToolActivity/catalog/types.ts

export type ChipLike = {
  toolCallId: string;
  toolName: string;
  status: 'pending' | 'success' | 'error';
  createdAt: number;
  errorText?: string;
  input?: unknown;
  output?: unknown;
};

/**
 * Presenters can return either:
 * - a simple string (rendered as the body text), or
 * - a structured object with an optional "label" (lightweight line above)
 *   and a "text" body line(s) below it.
 */
export type ToolChipContent =
  | string
  | {
      label?: string; // 300 weight, sits one line above
      text: string;   // regular-weight main content
    };

export interface ToolChipPresenter<TName extends string = string> {
  /** Tool name this presenter targets (compile-time checked by codegen types). */
  toolName: TName;
  pending: (chip: ChipLike) => ToolChipContent;
  success: (chip: ChipLike) => ToolChipContent;
  error: (chip: ChipLike) => ToolChipContent;
}

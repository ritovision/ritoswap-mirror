// app/store/toolActivity.ts
'use client';

import { create } from 'zustand';

export type ToolStatus = 'pending' | 'success' | 'error';

export type ToolChip = {
  toolCallId: string;
  toolName: string;
  status: ToolStatus;
  createdAt: number;
  errorText?: string;
  /** ⬇️ captured from tool-input-available */
  input?: unknown;
  /** ⬇️ captured from tool-output-available */
  output?: unknown;
};

export type ToolAnchor = {
  /** Which message part the tool should be anchored after */
  partIndex: number;
  /** Character offset inside that part's text where the tool sits */
  charOffset: number;
};

type Group = {
  key: string; // server messageId when available, else "seq-<n>"
  attachedUiMessageId?: string; // id from useChat messages[]
  chips: Record<string, ToolChip>;
  createdAt: number;
};

export type ToolActivityState = {
  groups: Record<string, Group>;
  activeGroupKey?: string;
  uiToGroup: Record<string, string>;
  callToGroup: Record<string, string>;
  /** Anchors per UI message (where the tool row should render within the text) */
  anchors: Record<string, ToolAnchor>;
  seq: number;

  onSseStart: (messageId?: string) => void;
  onToolInputStart: (toolCallId: string, toolName: string) => void;
  onToolInputAvailable: (toolCallId: string, toolName: string, input: unknown) => void;
  /**
   * Mark tool output availability.
   * - If opts.isError === true, we mark the chip as 'error' and store errorText.
   * - Otherwise we mark it as 'success'.
   * Note: 'error' status always wins; we never downgrade an error back to success.
   */
  onToolOutputAvailable: (toolCallId: string, opts?: { isError?: boolean; errorText?: string }) => void;
  onToolOutputPayload: (toolCallId: string, output: unknown) => void;
  onToolOutputError: (toolCallId: string, errorText: string) => void;
  onSseFinish: () => void;

  /** Attach current active group to a UI message, and (optionally) record an anchor once */
  attachActiveGroupToUiMessage: (uiMessageId: string, anchor?: ToolAnchor) => void;
};

export const useToolActivityStore = create<ToolActivityState>((set, get) => ({
  groups: {},
  activeGroupKey: undefined,
  uiToGroup: {},
  callToGroup: {},
  anchors: {},
  seq: 0,

  onSseStart: (messageId) => {
    const s = get();
    const nextSeq = s.seq + 1;
    const key = messageId || `seq-${nextSeq}`;

    if (!s.groups[key]) {
      set({
        groups: { ...s.groups, [key]: { key, chips: {}, createdAt: Date.now() } },
        activeGroupKey: key,
        seq: nextSeq,
      });
      return;
    }
    if (s.activeGroupKey !== key || s.seq !== nextSeq) {
      set({ activeGroupKey: key, seq: nextSeq });
    }
  },

  onToolInputStart: (toolCallId, toolName) => {
    const s = get();
    const key = s.activeGroupKey ?? `seq-${s.seq || 1}`;
    const current = s.groups[key] ?? { key, chips: {}, createdAt: Date.now() };

    if (current.chips[toolCallId]) return; // no-op

    const next: Group = {
      ...current,
      chips: {
        ...current.chips,
        [toolCallId]: {
          toolCallId,
          toolName,
          status: 'pending',
          createdAt: Date.now(),
        },
      },
    };

    set({
      groups: { ...s.groups, [key]: next },
      activeGroupKey: key,
      callToGroup: { ...s.callToGroup, [toolCallId]: key },
    });
  },

  onToolInputAvailable: (toolCallId, toolName, input) => {
    const s = get();
    const key = s.activeGroupKey ?? s.callToGroup[toolCallId] ?? `seq-${s.seq || 1}`;
    const g = s.groups[key] ?? { key, chips: {}, createdAt: Date.now() };
    const existing = g.chips[toolCallId];

    const chip: ToolChip = existing
      ? { ...existing, toolName: existing.toolName || toolName, input }
      : { toolCallId, toolName, status: 'pending', createdAt: Date.now(), input };

    set({
      groups: {
        ...s.groups,
        [key]: { ...g, chips: { ...g.chips, [toolCallId]: chip } },
      },
      callToGroup: { ...s.callToGroup, [toolCallId]: key },
      activeGroupKey: key,
    });
  },

  onToolOutputAvailable: (toolCallId, opts) => {
    const s = get();
    const key = s.callToGroup[toolCallId];
    if (!key) return;
    const g = s.groups[key];
    if (!g) return;
    const chip = g.chips[toolCallId];
    if (!chip) return;

    // Determine the new status based on isError flag.
    const incomingIsError = Boolean(opts?.isError);
    const errorText = opts?.errorText;

    // If already error, do not downgrade to success.
    const nextStatus: ToolStatus = incomingIsError ? 'error' : (chip.status === 'error' ? 'error' : 'success');

    set({
      groups: {
        ...s.groups,
        [key]: {
          ...g,
          chips: {
            ...g.chips,
            [toolCallId]: {
              ...chip,
              status: nextStatus,
              ...(incomingIsError ? { errorText } : {}),
            },
          },
        },
      },
    });
  },

  onToolOutputPayload: (toolCallId, output) => {
    const s = get();
    const key = s.callToGroup[toolCallId];
    if (!key) return;
    const g = s.groups[key];
    if (!g) return;
    const chip = g.chips[toolCallId];
    if (!chip) return;

    set({
      groups: {
        ...s.groups,
        [key]: {
          ...g,
          chips: { ...g.chips, [toolCallId]: { ...chip, output } },
        },
      },
    });
  },

  onToolOutputError: (toolCallId, errorText) => {
    const s = get();
    const key = s.callToGroup[toolCallId];
    if (!key) return;
    const g = s.groups[key];
    if (!g) return;
    const chip = g.chips[toolCallId];
    if (!chip) return;
    if (chip.status === 'error' && chip.errorText === errorText) return; // no change

    set({
      groups: {
        ...s.groups,
        [key]: {
          ...g,
          chips: { ...g.chips, [toolCallId]: { ...chip, status: 'error', errorText } },
        },
      },
    });
  },

  onSseFinish: () => {
    const s = get();
    if (s.activeGroupKey !== undefined) {
      set({ activeGroupKey: undefined });
    }
  },

  attachActiveGroupToUiMessage: (uiMessageId, anchor) => {
    const s = get();
    const key = s.activeGroupKey;
    if (!key) return;

    // If already mapped to this group and anchor recorded, no-op
    const alreadyMapped = s.uiToGroup[uiMessageId] === key;
    const alreadyAnchored = s.anchors[uiMessageId] != null;

    const g = s.groups[key];
    if (!g) return;

    const nextState: Partial<ToolActivityState> = {
      groups: { ...s.groups, [key]: { ...g, attachedUiMessageId: uiMessageId } },
      uiToGroup: { ...s.uiToGroup, [uiMessageId]: key },
    };

    // Record anchor only once (first time we attach)
    if (anchor && !alreadyAnchored) {
      nextState.anchors = { ...s.anchors, [uiMessageId]: anchor };
    }

    // Avoid set if truly nothing changes
    if (alreadyMapped && (alreadyAnchored || !anchor)) return;

    set(nextState as ToolActivityState);
  },
}));
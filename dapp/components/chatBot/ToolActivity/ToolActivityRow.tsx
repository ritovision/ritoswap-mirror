'use client';

import React from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useToolActivityStore } from '@store/toolActivity';
import ToolCallChip, { ToolCallChipData } from './ToolCallChip';
import styles from './ToolActivity.module.css';

type ChipGroup = { chips: Record<string, ToolCallChipData> };
type ToolActivityState = {
  uiToGroup: Record<string, string | undefined>;
  groups: Record<string, ChipGroup | undefined>;
};

type Props = { uiMessageId: string };

// shared empty to keep referential stability
const EMPTY: ToolCallChipData[] = [];

const ToolActivityRow: React.FC<Props> = ({ uiMessageId }) => {
  /**
   * IMPORTANT:
   * - Selector is PURE (no calling store methods that call get()).
   * - We use useShallow so returning a new array doesn't re-render
   *   unless its elements or length actually change.
   */
  const chips = useToolActivityStore(
    useShallow((s: unknown) => {
      const { uiToGroup, groups } = s as ToolActivityState;
      const key = uiToGroup[uiMessageId];
      if (!key) return EMPTY;
      const g = groups[key];
      if (!g) return EMPTY;

      // Object.values preserves insertion order; we don’t sort
      // to keep element identities/positions stable across renders.
      const arr = Object.values(g.chips);
      return arr.length ? arr : EMPTY;
    })
  );

  if (chips.length === 0) return null;

  return (
    <div className={styles.row} data-inline-tools="">
      {chips.map((chip) => (
        <ToolCallChip key={chip.toolCallId} chip={chip} />
      ))}
    </div>
  );
};

export default ToolActivityRow;

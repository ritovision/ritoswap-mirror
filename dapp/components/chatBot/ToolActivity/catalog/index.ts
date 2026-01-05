// dapp/components/utilities/chatBot/ToolActivity/catalog/index.ts
import type { ToolChipPresenter, ToolChipContent, ChipLike } from './types';
import type { ToolCallChipData } from '../ToolCallChip';
import { defaultPresenter } from './defaultPresenter';

// Generated map of discovered presenters (by filename). Updated by codegen.
import { presenters } from './generated-presenters';

// Optional manual imports for critical presenters (if you want them even without codegen)
import { presenter as getEthBalancePresenter } from './presenters/eth_balance.presenter';

// Merge manual must-haves over generated
const registry: Record<string, ToolChipPresenter<string>> = {
  'get_eth_balance': getEthBalancePresenter,
  ...presenters,
};

export function getPresenter(toolName: string): ToolChipPresenter<string> {
  return registry[toolName] || defaultPresenter;
}

/** Normalize string or object into a consistent shape for rendering. */
function normalizeContent(content: ToolChipContent): { label?: string; text: string } {
  if (typeof content === 'string') {
    return { text: content };
  }
  return {
    label: content.label,
    text: content.text ?? '',
  };
}

/** New API used by the chip renderer. */
export function renderToolChipContent(chip: ToolCallChipData): { label?: string; text: string } {
  const p = getPresenter(chip.toolName);
  switch (chip.status) {
    case 'pending':
      return normalizeContent(p.pending(chip as ChipLike));
    case 'success':
      return normalizeContent(p.success(chip as ChipLike));
    case 'error':
      return normalizeContent(p.error(chip as ChipLike));
    default:
      return normalizeContent(defaultPresenter.pending(chip as ChipLike));
  }
}

/**
 * Back-compat helper: if any legacy code expects a single string,
 * we join label + text with a newline.
 */
export function renderToolChipLabel(chip: ToolCallChipData): string {
  const { label, text } = renderToolChipContent(chip);
  return label ? `${label}\n${text}` : text;
}

// dapp/components/utilities/chatBot/ToolActivity/catalog/defaultPresenter.ts
import type { ChipLike, ToolChipPresenter } from './types';

export const defaultPresenter: ToolChipPresenter<string> = {
  toolName: '*',

  pending: (chip: ChipLike) => ({
    label: chip.toolName,
    text: 'Running…',
  }),

  success: (chip: ChipLike) => ({
    label: chip.toolName,
    text: 'Complete',
  }),

  error: (chip: ChipLike) => ({
    label: chip.toolName,
    text: chip.errorText ? `Failed: ${chip.errorText}` : 'Failed',
  }),
};

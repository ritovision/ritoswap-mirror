// dapp/components/utilities/chatBot/ToolActivity/catalog/presenters/agent_rap_verse.presenter.ts
import type { ChipLike, ToolChipPresenter } from '../types';

/** Wire shapes returned by tools. */
type TextContent = { type: 'text'; text: string };
type JsonContent = { type: 'json'; data: Record<string, unknown> };
type ToolWireContent = TextContent | JsonContent;

interface ToolWireResult {
  content?: ToolWireContent[];
  isError?: boolean;
}

/** Minimal input passed to tool. */
interface GenerateRapVerseInput {
  roundNumber?: number;
  round?: number;
}

/** Type guard for tool input. */
function isGenerateRapVerseInput(x: unknown): x is GenerateRapVerseInput {
  return typeof x === 'object' && x !== null;
}

/** Extract the first JSON `data` object from a tool result. */
function extractJsonFromOutput(output: unknown): Record<string, unknown> | undefined {
  const res = output as ToolWireResult | undefined;
  if (!res?.content) return undefined;
  const json = res.content.find((c): c is JsonContent => c.type === 'json');
  return json?.data;
}

/** Read the intended round from input or fallback to 1. */
function getRoundFromInput(input: unknown): number | undefined {
  if (!isGenerateRapVerseInput(input)) return undefined;
  const val = (input as GenerateRapVerseInput).roundNumber ?? (input as GenerateRapVerseInput).round;
  return typeof val === 'number' ? val : undefined;
}

export const presenter: ToolChipPresenter<'generate_rap_verse'> = {
  toolName: 'generate_rap_verse',

  pending: (chip: ChipLike) => {
    const round = getRoundFromInput(chip.input) ?? 1;
    return {
      label: `Cooking Verse ${round}/3`,
      text: '',
    };
  },

  success: (chip: ChipLike) => {
    const json = extractJsonFromOutput(chip.output);
    const roundFromJson = typeof json?.round === 'number' ? (json.round as number) : undefined;
    const round = roundFromJson ?? getRoundFromInput(chip.input) ?? 1;

    return {
      label: `Verse ${round}/3 Ready`,
      text: '🔥 Bars dropped',
    };
  },

  error: (chip: ChipLike) => {
    const round = getRoundFromInput(chip.input) ?? 1;
    return {
      label: `Verse ${round}/3 Failed`,
      text: chip.errorText ?? 'Agent choked on the mic',
    };
  },
};

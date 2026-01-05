// dapp/components/utilities/chatBot/ToolActivity/catalog/presenters/pinecone_search.presenter.ts
import type { ChipLike, ToolChipPresenter } from '../types';

type SearchInputObj = Record<string, unknown>;

type MatchMeta = { title?: unknown; name?: unknown; [k: string]: unknown };
type MatchObj = { score?: unknown; metadata?: MatchMeta } & Record<string, unknown>;
type SearchJson = {
  query?: unknown;
  index?: unknown;
  namespace?: unknown;
  totalMatches?: unknown;
  topK?: unknown;
  matches?: unknown;
};

function getSearchDetailsFromInput(input: unknown): { query?: string; index?: string; namespace?: string; topK?: number } {
  try {
    if (input && typeof input === 'object') {
      const obj = input as SearchInputObj;
      return {
        query: typeof obj.query === 'string' ? obj.query : undefined,
        index: typeof obj.index === 'string' ? obj.index : undefined,
        namespace: typeof obj.namespace === 'string' ? obj.namespace : undefined,
        topK: typeof obj.topK === 'number' ? obj.topK : undefined,
      };
    }
  } catch {}
  return {};
}

type JsonContent = { type: string; text?: string; data?: unknown };
type ToolWireResult = { content?: JsonContent[]; isError?: boolean };

function extractJsonFromOutput(output: unknown): unknown | undefined {
  const res = output as ToolWireResult;
  const json = Array.isArray(res?.content) ? res.content.find((c) => c?.type === 'json') : undefined;
  return json?.data;
}

function extractTextFromOutput(output: unknown): string | undefined {
  const res = output as ToolWireResult;
  const texts = Array.isArray(res?.content)
    ? res.content
        .filter((c) => c?.type === 'text' && typeof c.text === 'string')
        .map((c) => (c.text as string).trim())
    : [];
  return texts.length ? texts.join('\n') : undefined;
}

function truncateQuery(query?: string, maxLength: number = 50): string {
  if (!query) return '';
  if (query.length <= maxLength) return query;
  return query.slice(0, maxLength - 3) + '...';
}

export const presenter: ToolChipPresenter<'pinecone_search'> = {
  toolName: 'pinecone_search',

  pending: (chip: ChipLike) => {
    const { query, index, namespace } = getSearchDetailsFromInput(chip.input);
    const truncatedQuery = truncateQuery(query, 30);
    let label = 'Searching';
    if (index) {
      label += ` ${index}`;
      if (namespace) {
        label += `/${namespace}`;
      }
    }
    return {
      label,
      text: truncatedQuery ? `"${truncatedQuery}"` : '',
    };
  },

  success: (chip: ChipLike) => {
    const json = extractJsonFromOutput(chip.output);
    if (json && typeof json === 'object') {
      const data = json as SearchJson;

      const totalMatches = typeof data.totalMatches === 'number' ? data.totalMatches : 0;
      const index = typeof data.index === 'string' ? data.index : 'index';
      const namespace = typeof data.namespace === 'string' ? data.namespace : undefined;
      const query = typeof data.query === 'string' ? data.query : undefined;
      const truncatedQuery = truncateQuery(query, 40);

      let label = `Found ${totalMatches} result${totalMatches !== 1 ? 's' : ''}`;
      let text = '';

      if (index) {
        label += ` in ${index}`;
        if (namespace && namespace !== 'default') {
          label += `/${namespace}`;
        }
      }

      if (truncatedQuery) {
        text = `Query: "${truncatedQuery}"`;
      }

      const matchesArr = Array.isArray(data.matches) ? (data.matches as unknown[]) : [];
      if (matchesArr.length > 0) {
        const topMatch = matchesArr[0] as MatchObj | undefined;
        const scoreVal = topMatch && typeof topMatch.score === 'number' ? topMatch.score : undefined;
        if (typeof scoreVal === 'number') {
          text += text ? `\nTop score: ${scoreVal.toFixed(3)}` : `Top score: ${scoreVal.toFixed(3)}`;
        }

        const meta = topMatch?.metadata;
        let titleOrName: string | undefined;
        if (meta && typeof meta === 'object') {
          const mm = meta as MatchMeta;
          if (typeof mm.title === 'string') {
            titleOrName = mm.title;
          } else if (typeof mm.name === 'string') {
            titleOrName = mm.name;
          }
        }

        if (titleOrName) {
          const truncatedTitle = titleOrName.length > 50 ? titleOrName.slice(0, 47) + '...' : titleOrName;
          text += `\nBest match: ${truncatedTitle}`;
        }
      }

      return {
        label,
        text: text || `${totalMatches} result${totalMatches !== 1 ? 's' : ''}`,
      };
    }

    const text = extractTextFromOutput(chip.output);
    return {
      label: 'Search Complete',
      text: text ?? '',
    };
  },

  error: (chip: ChipLike) => {
    const { index } = getSearchDetailsFromInput(chip.input);

    let friendlyError = chip.errorText ?? 'Search failed';
    
    if (friendlyError.includes('API key')) {
      friendlyError = 'Pinecone API key not configured';
    } else if (friendlyError.includes('not found')) {
      friendlyError = `Index "${index}" not found`;
    } else if (friendlyError.includes('Authentication')) {
      friendlyError = 'Authentication required';
    }
    
    return {
      label: 'Search Failed',
      text: friendlyError,
    };
  },
};

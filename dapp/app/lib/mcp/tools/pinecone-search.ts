// dapp/app/lib/mcp/tools/pinecone-search.ts
//
// Pinecone vector search MCP tool with static namespace configuration
// NOTE: This version explicitly surfaces `metadata.url` in both the JSON results
// and the human-readable text summary. For the `gifs` namespace it also emits a
// ready-to-render `<gif .../>` tag in the text summary so LLMs and downstream
// renderers can find and use the URL easily.

import { createLogger } from '@logger';
import { Pinecone } from '@pinecone-database/pinecone';
import type { Tool } from '../../../schemas/domain/tool';
import { createTool, textResult, jsonResult } from './types';
import { fail, errorResultShape } from './tool-errors';
import { pineconeConfig } from '@config/pinecone.config';

const logger = createLogger('pinecone-search-tool');

// Build the input schema with available indexes and namespaces
function buildInputSchema(): Record<string, unknown> {
  const indexNames = pineconeConfig.getIndexNames();
  const indexNamespaceMap: Record<string, string[]> = {};
  
  // Build a map of index to namespaces for the schema description
  for (const index of pineconeConfig.indexes) {
    indexNamespaceMap[index.name] = index.namespaces;
  }
  
  // Create enum descriptions
  const indexDescription = indexNames.length > 0
    ? `Available indexes: ${indexNames.join(', ')}`
    : 'No indexes configured';
    
  const namespaceDescription = Object.entries(indexNamespaceMap)
    .map(([idx, ns]) => `${idx}: [${ns.join(', ')}]`)
    .join('; ');

  return {
    type: 'object',
    additionalProperties: false,
    properties: {
      query: {
        type: 'string',
        description: 'The semantic search query text',
        minLength: 1,
      },
      index: {
        type: 'string',
        description: `The Pinecone index to search. ${indexDescription}`,
        enum: indexNames.length > 0 ? indexNames : ['none'],
      },
      namespace: {
        type: 'string',
        description: `The namespace within the index. Available namespaces per index: ${namespaceDescription}. If not specified, defaults to "__default__"`,
        // We list ALL possible namespaces across all indexes
        enum: Array.from(new Set(pineconeConfig.indexes.flatMap(idx => idx.namespaces))),
        default: '__default__',
      },
      topK: {
        type: 'integer',
        description: 'Number of top results to return',
        minimum: 1,
        maximum: 100,
        default: 5,
      },
      includeMetadata: {
        type: 'boolean',
        description: 'Whether to include metadata in results',
        default: true,
      },
      filter: {
        type: 'object',
        description: 'Optional metadata filter for the search (e.g., {"category": "docs", "version": 2})',
        additionalProperties: true,
      },
    },
    required: ['query', 'index'],
  };
}

type PineconeSearchParams = {
  query: string;
  index: string;
  namespace?: string;
  topK?: number;
  includeMetadata?: boolean;
  filter?: Record<string, unknown>;
};

// Initialize Pinecone client (singleton)
let pineconeClient: Pinecone | null = null;

const getPineconeClient = (): Pinecone => {
  if (!pineconeClient && pineconeConfig.apiKey) {
    pineconeClient = new Pinecone({
      apiKey: pineconeConfig.apiKey,
    });
  }
  if (!pineconeClient) {
    throw new Error('Pinecone client not initialized - missing API key');
  }
  return pineconeClient;
};

interface PineconeQueryOptions {
  vector: number[];
  topK: number;
  includeMetadata?: boolean;
  filter?: Record<string, unknown>;
}

// Tool implementation
const pineconeSearchTool: Tool<PineconeSearchParams> = {
  name: 'pinecone_search',
  description:
    'Perform semantic vector search in Pinecone indexes. Finds similar content based on meaning rather than exact keyword matches. ' +
    `Configured indexes and namespaces: ${pineconeConfig.indexes.map(idx => 
      `${idx.name} (namespaces: ${idx.namespaces.join(', ')})`
    ).join('; ') || 'None configured'}`,
  inputSchema: buildInputSchema(),

  async handler(params: PineconeSearchParams) {
    const query = String(params?.query ?? '').trim();
    const indexName = String(params?.index ?? '').trim();
    const namespace = (params?.namespace?.trim() || '__default__');
    const topK = Math.min(Math.max(params?.topK ?? 5, 1), 100);
    const includeMetadata = params?.includeMetadata ?? true;
    const filter = params?.filter;

    // Manual validation
    if (!query) {
      fail('Query text is required');
    }
    if (!indexName) {
      fail('Index name is required');
    }
    
    // Validate index exists
    const availableIndexes = pineconeConfig.getIndexNames();
    if (!availableIndexes.includes(indexName)) {
      fail(`Index "${indexName}" not found. Available indexes: ${availableIndexes.join(', ') || 'none'}`);
    }
    
    // Validate namespace exists for this index
    if (!pineconeConfig.isValidIndexNamespace(indexName, namespace)) {
      const validNamespaces = pineconeConfig.getNamespacesForIndex(indexName);
      fail(`Namespace "${namespace}" not found in index "${indexName}". Available namespaces: ${validNamespaces?.join(', ') || 'none'}`);
    }

    logger.info('Performing Pinecone search', {
      index: indexName,
      namespace,
      query: query.slice(0, 100),
      topK,
    });

    try {
      const pc = getPineconeClient();
      
      // Generate embedding for the query
      logger.debug('Generating query embedding');
      const embeddingResponse = await pc.inference.embed(
        'multilingual-e5-large',
        [query],
        { inputType: 'query', truncate: 'END' }
      );

      if (embeddingResponse.vectorType !== 'dense') {
        fail(`Expected dense embeddings, got ${embeddingResponse.vectorType}`);
      }

      const queryVector = (embeddingResponse.data[0] as { vectorType: 'dense'; values: number[] }).values;
      
      // Get the index - no need to specify host, SDK handles it
      const index = pc.index(indexName);
      
      // Build query options - DO NOT include namespace here
      const queryOptions: PineconeQueryOptions = {
        vector: queryVector,
        topK,
        includeMetadata,
      };
      
      if (filter && Object.keys(filter).length > 0) {
        queryOptions.filter = filter;
      }

      // Query the index with namespace specified via .namespace() method
      logger.debug('Querying Pinecone index', { indexName, namespace });
      const results = await index.namespace(namespace).query(queryOptions);

      const matchesRaw = (results as { matches?: unknown }).matches;
      const matches: unknown[] = Array.isArray(matchesRaw) ? matchesRaw : [];
      
      logger.info('Search completed', {
        index: indexName,
        namespace,
        matchCount: matches.length,
        topScore: (matches[0] as { score?: unknown } | undefined)?.score,
      });

      // ---- NEW: include URL as a top-level field when present ----
      const formattedMatches = matches.map((match): { id: unknown; score?: number; url?: string; metadata?: unknown } => {
        const m = match as { id?: unknown; score?: unknown; metadata?: unknown };
        const md = m.metadata as { url?: unknown } | undefined;
        const score = typeof m.score === 'number' ? m.score : undefined;
        const url = md && typeof md.url === 'string' ? md.url : undefined;
        return {
          id: m.id,
          score,
          url,
          metadata: m.metadata,
        };
      });

      // ---- UPDATED: human-readable summary; show URLs for gifs ----
      const isGifs = namespace.toLowerCase() === 'gifs';
      let textSummary = `Found ${matches.length} result${matches.length !== 1 ? 's' : ''} in ${indexName}/${namespace}:\n\n`;

      if (matches.length === 0) {
        textSummary += 'No matching results found.';
      } else {
        matches.slice(0, 3).forEach((match, idx: number) => {
          const m = match as { score?: unknown; metadata?: unknown };
          const scoreNum = typeof m.score === 'number' ? m.score : undefined;
          const md = (m.metadata && typeof m.metadata === 'object' ? (m.metadata as Record<string, unknown>) : undefined) || undefined;
          const titleOrNameVal = (md?.title ?? md?.name) as unknown;
          const titleOrName = typeof titleOrNameVal === 'string' ? titleOrNameVal : undefined;
          const descrOrTextVal = (md?.description ?? md?.text) as unknown;
          const descrOrText = typeof descrOrTextVal === 'string' ? descrOrTextVal : undefined;
          const urlVal = md?.url as unknown;
          const url = typeof urlVal === 'string' ? urlVal : undefined;

          const score = typeof scoreNum === 'number' ? scoreNum.toFixed(3) : 'N/A';
          textSummary += `${idx + 1}. Score: ${score}`;
          if (titleOrName) textSummary += ` - ${titleOrName}`;
          if (descrOrText) {
            const t = descrOrText.length > 150 ? descrOrText.slice(0, 150) + '...' : descrOrText;
            textSummary += `\n   ${t}`;
          }

          if (isGifs && url) {
            textSummary += `\n   url: ${url}`;
            textSummary += `\n   <gif url="${url}" width="280" />`;
          }

          textSummary += '\n';
        });
        
        if (matches.length > 3) {
          textSummary += `\n...and ${matches.length - 3} more result${matches.length - 3 !== 1 ? 's' : ''}.`;
        }
      }

      const text = textResult(textSummary);
      const json = jsonResult({
        query,
        index: indexName,
        namespace,
        totalMatches: matches.length,
        topK,
        matches: formattedMatches,
      });

      return {
        content: [...text.content, ...json.content],
      };
    } catch (error) {
      logger.error('Pinecone search failed', {
        index: indexName,
        namespace,
        error: error instanceof Error ? error.message : String(error),
      });

      return errorResultShape(
        error instanceof Error ? error.message : 'Failed to perform vector search'
      );
    }
  },
};

export default createTool(pineconeSearchTool);

// app/config/pinecone.config.ts
// Dedicated configuration for Pinecone vector database

import { z } from 'zod';
import { createLogger } from '@logger';

const logger = createLogger('PineconeConfig');

// Schema for Pinecone configuration
const pineconeSchema = z.object({
  PINECONE_API_KEY: z.string().min(1).optional(),
  
  // Index 1 configuration
  PINECONE_INDEX_1_NAME: z.string().optional(),
  PINECONE_INDEX_1_NAMESPACES: z.string().optional(), // comma-separated
  
  // Index 2 configuration (for future expansion)
  PINECONE_INDEX_2_NAME: z.string().optional(),
  PINECONE_INDEX_2_NAMESPACES: z.string().optional(),
  
  // Index 3 configuration (for future expansion)
  PINECONE_INDEX_3_NAME: z.string().optional(),
  PINECONE_INDEX_3_NAMESPACES: z.string().optional(),
});

// Parse and validate Pinecone configuration
function validatePineconeConfig() {
  // Check if we're in a browser environment
  if (typeof window !== 'undefined') {
    throw new Error('❌ SECURITY ERROR: pinecone.config.ts cannot be imported in client-side code!');
  }

  // Preprocess environment variables: convert empty strings to undefined
  const processedEnv = Object.fromEntries(
    Object.entries(process.env).map(([key, value]) => [key, value === '' ? undefined : value])
  );

  const result = pineconeSchema.safeParse(processedEnv);
  
  if (!result.success) {
    logger.error('Pinecone configuration validation failed:', result.error.format());
    return null;
  }

  return result.data;
}

// Index configuration type
export interface PineconeIndexConfig {
  name: string;
  namespaces: string[];
}

// Parse the configuration into a usable format
function parsePineconeConfig() {
  const env = validatePineconeConfig();
  
  if (!env || !env.PINECONE_API_KEY) {
    logger.warn('Pinecone not configured - missing API key');
    return null;
  }

  const indexes: PineconeIndexConfig[] = [];
  
  // Parse each index configuration
  for (let i = 1; i <= 3; i++) {
    const nameKey = `PINECONE_INDEX_${i}_NAME` as keyof typeof env;
    const namespacesKey = `PINECONE_INDEX_${i}_NAMESPACES` as keyof typeof env;
    
    const name = env[nameKey];
    const namespacesRaw = env[namespacesKey];
    
    if (name && typeof name === 'string') {
      const namespaces = namespacesRaw 
        ? String(namespacesRaw).split(',').map(s => s.trim()).filter(Boolean)
        : ['__default__']; // Default namespace if none specified
      
      indexes.push({ name, namespaces });
      
      logger.debug(`Pinecone index ${i} configured`, { 
        name, 
        namespaceCount: namespaces.length,
        namespaces 
      });
    }
  }
  
  if (indexes.length === 0) {
    logger.warn('Pinecone API key configured but no indexes defined');
    return null;
  }

  return {
    apiKey: env.PINECONE_API_KEY,
    indexes,
  };
}

// Export the parsed configuration
const config = parsePineconeConfig();

export const pineconeConfig = config ? Object.freeze({
  isConfigured: true,
  apiKey: config.apiKey,
  indexes: config.indexes,
  
  // Helper to get all available index names
  getIndexNames(): string[] {
    return config.indexes.map(idx => idx.name);
  },
  
  // Helper to get namespaces for a specific index
  getNamespacesForIndex(indexName: string): string[] | undefined {
    const index = config.indexes.find(idx => idx.name === indexName);
    return index?.namespaces;
  },
  
  // Helper to validate if an index/namespace combination is valid
  isValidIndexNamespace(indexName: string, namespace: string): boolean {
    const namespaces = this.getNamespacesForIndex(indexName);
    return namespaces ? namespaces.includes(namespace) : false;
  },
  
  // Get all valid index/namespace combinations for tool schema
  getAllIndexNamespaceCombinations(): string[] {
    const combinations: string[] = [];
    for (const index of config.indexes) {
      for (const namespace of index.namespaces) {
        combinations.push(`${index.name}/${namespace}`);
      }
    }
    return combinations;
  }
}) : {
  isConfigured: false as const,
  apiKey: undefined,
  indexes: [],
  getIndexNames: () => [],
  getNamespacesForIndex: () => undefined,
  isValidIndexNamespace: () => false,
  getAllIndexNamespaceCombinations: () => [],
};

// Log configuration status on module load
if (pineconeConfig.isConfigured) {
  logger.info('Pinecone configured', {
    indexCount: pineconeConfig.indexes.length,
    indexes: pineconeConfig.indexes.map(idx => ({
      name: idx.name,
      namespaces: idx.namespaces
    }))
  });
} else {
  logger.info('Pinecone not configured');
}
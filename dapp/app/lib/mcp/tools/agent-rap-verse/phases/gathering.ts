// dapp/app/lib/mcp/tools/agent-rap-verse/phases/gathering.ts
//
// Phase 2: Dynamic Resource Gathering
//

import { createLogger } from '@logger';
import { pineconeConfig } from '@config/pinecone.config';
import type { BattleStrategy, GatheredResources, UserContext, VectorMatch } from '../types';
import { AGENT_CONFIG } from '../config';
import { callRegistryTool } from '../utils/tool-caller';
import { extractText, extractJson, extractImagePayloads } from '../utils/extractors';

const logger = createLogger('agent-gathering');

export async function gatherResources(
  strategy: BattleStrategy,
  userCtx: UserContext
): Promise<GatheredResources> {
  logger.info('[Gathering] Resource gathering initiated', {
    needs: strategy.needsResourceSearch,
    shouldGenImage: strategy.shouldGenerateImage,
    emphasisOnRitoLyrics: strategy.emphasisOnRitoLyrics,
    emphasisOnRitoPics: strategy.emphasisOnRitoPics,
  });

  const resources: GatheredResources = {
    memes: [],
    ritoPics: [],
    rhymeSamples: '',
    walletBalance: '',
  };

  // Check Pinecone configuration
  if (!pineconeConfig.isConfigured) {
    logger.warn('[Gathering] Pinecone not configured, skipping vector searches');
    return resources;
  }

  const availableIndexes = pineconeConfig.getIndexNames();
  const primaryIndex = availableIndexes[0];
  
  if (!primaryIndex) {
    logger.warn('[Gathering] No Pinecone indexes available');
    return resources;
  }

  const namespaces = pineconeConfig.getNamespacesForIndex(primaryIndex) || [];
  const gifsNamespace = namespaces.find(ns => ns.toLowerCase().includes('gif'));
  const picsNamespace = namespaces.find(ns => ns.toLowerCase().includes('pic'));
  const lyricsNamespace = namespaces.find(ns => 
    ns.toLowerCase().includes('rhyme') || 
    ns.toLowerCase().includes('lyric') ||
    ns.toLowerCase().includes('rito')
  );

  logger.info('[Gathering] Available namespaces', { gifsNamespace, picsNamespace, lyricsNamespace });

  // Gather memes if needed
  if (strategy.needsResourceSearch.memes && gifsNamespace) {
    logger.info('[Gathering] Searching for memes');
    const result = await callRegistryTool('pinecone_search', {
      query: 'crypto meme funny roast savage diss battle gif animated',
      index: primaryIndex,
      namespace: gifsNamespace,
      topK: AGENT_CONFIG.resources.maxMemes,
    });
    
    const matches = extractJson<{ matches?: VectorMatch[] }>(result)?.matches || [];
    resources.memes = matches.map(m => ({
      url: m.metadata?.url || m.url || '',
      description: m.metadata?.description || m.id || 'meme',
    })).filter(m => m.url);
    
    logger.info('[Gathering] Memes gathered', { count: resources.memes.length });
  }

  // Gather Rito pics if needed (CRITICAL for self-promo)
  if (strategy.needsResourceSearch.ritoPics && picsNamespace) {
    logger.info('[Gathering] Searching for Rito pics', { emphasis: strategy.emphasisOnRitoPics });
    const result = await callRegistryTool('pinecone_search', {
      query: strategy.emphasisOnRitoPics 
        ? 'rito champion king victory flex winner confident dominant pose legendary'
        : 'rito victory flex winner confident pose',
      index: primaryIndex,
      namespace: picsNamespace,
      topK: AGENT_CONFIG.resources.maxRitoPics,
    });
    
    const matches = extractJson<{ matches?: VectorMatch[] }>(result)?.matches || [];
    resources.ritoPics = matches.map(m => ({
      url: m.metadata?.url || m.url || '',
      description: m.metadata?.description || m.id || 'rito',
    })).filter(m => m.url);
    
    logger.info('[Gathering] Rito pics gathered', { count: resources.ritoPics.length });
  }

  // Gather rhyme samples if needed (CRITICAL - these are Rito's fire bars)
  if (strategy.needsResourceSearch.rhymes && lyricsNamespace) {
    logger.info('[Gathering] Searching for fire lyrics', { emphasis: strategy.emphasisOnRitoLyrics });
    
    const topK = strategy.emphasisOnRitoLyrics ? 8 : 5; // More if emphasis
    
    const result = await callRegistryTool('pinecone_search', {
      query: strategy.emphasisOnRitoLyrics
        ? 'legendary battle rap bars punchline roast cryptocurrency blockchain fire lyrics quotable clever wordplay'
        : 'battle rap cryptocurrency blockchain bars punchline roast',
      index: primaryIndex,
      namespace: lyricsNamespace,
      topK,
    });
    
    resources.rhymeSamples = extractText(result).slice(0, AGENT_CONFIG.resources.maxRhymeSamples);
    logger.info('[Gathering] Rhymes gathered', { 
      length: resources.rhymeSamples.length,
      preview: resources.rhymeSamples.slice(0, 100),
      emphasis: strategy.emphasisOnRitoLyrics 
    });
  }

  // Get wallet balance if needed
  if (strategy.needsResourceSearch.walletInfo && userCtx.address) {
    logger.info('[Gathering] Fetching wallet balance');
    const result = await callRegistryTool('get_eth_balance', {
      address: userCtx.address,
      chain: 'mainnet',
    });
    
    resources.walletBalance = extractText(result);
    logger.info('[Gathering] Balance gathered', { hasBalance: Boolean(resources.walletBalance) });
  }

  // Generate image if strategy calls for it
  if (strategy.shouldGenerateImage && strategy.imagePromptIdea) {
    logger.info('[Gathering] Generating custom image', { 
      prompt: strategy.imagePromptIdea.slice(0, 80) 
    });
    
    const result = await callRegistryTool('generate_image_with_alt', { 
      prompt: strategy.imagePromptIdea 
    });
    
    if (result) {
      const payloads = extractImagePayloads(result);
      if (payloads.length > 0) {
        const imgText = extractText(result);
        const imgMatch = imgText.match(/<img[^>]+src="store:\/\/[^"]+[^>]*>/);
        
        if (imgMatch) {
          resources.generatedImage = {
            tag: imgMatch[0],
            payload: payloads[0],
          };
          logger.info('[Gathering] Image generated successfully', { 
            name: payloads[0].name 
          });
        }
      }
    } else {
      logger.warn('[Gathering] Image generation returned no result');
    }
  }

  logger.info('[Gathering] Resource gathering complete', {
    memes: resources.memes.length,
    ritoPics: resources.ritoPics.length,
    hasRhymes: resources.rhymeSamples.length > 0,
    hasBalance: resources.walletBalance.length > 0,
    hasGeneratedImage: Boolean(resources.generatedImage),
  });

  return resources;
}
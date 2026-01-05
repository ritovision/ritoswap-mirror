// app/config/validate.ts
// ⚠️ This file is ONLY for validation utilities
// DO NOT create barrel exports that combine server and public env!

import { createLogger } from '@logger';
import { nodeEnv } from './node.env';

const logger = createLogger('EnvValidation');

declare global {
  // Ensure validateEnvironment only runs ONCE per server process (avoids Next dev double-invoke spam)
  var __ENV_VALIDATION_PROMISE: Promise<void> | undefined;
}

/**
 * Validates all environment variables at application startup.
 * Call this in your root layout or during server initialization.
 * This should ONLY be called server-side.
 */
export async function validateEnvironment(): Promise<void> {
  if (typeof window !== 'undefined') {
    throw new Error('validateEnvironment can only be called server-side');
  }

  // Run once guard (prevents duplicate logs under React Strict Mode in dev)
  if (globalThis.__ENV_VALIDATION_PROMISE) {
    return globalThis.__ENV_VALIDATION_PROMISE;
  }

  globalThis.__ENV_VALIDATION_PROMISE = (async () => {
    try {
      // Import server/public env (triggers their validation)
      const { serverConfig } = await import('./server.env');
      const { publicEnv, publicConfig } = await import('./public.env');
      const { getChainConfig, getChainDisplayName } = await import('./chain');

      // ✅ Also import AI configs so they validate at startup
      const { aiServerConfig } = await import('./ai.server');

      // Validate chain configuration to include in summary
      let chainSection: {
        name: string;
        rpcConfigured: boolean;
        wssConfigured: boolean;
        explorerConfigured: boolean;
      };

      try {
        const chainCfg = getChainConfig(publicConfig.activeChain);
        chainSection = {
          name: getChainDisplayName(publicConfig.activeChain),
          rpcConfigured: !!chainCfg.rpcUrl,
          wssConfigured: !!chainCfg.wssUrl,
          explorerConfigured: !!chainCfg.explorerUrl,
        };
      } catch (error) {
        logger.error('Chain configuration error:', error);
        throw error;
      }

      // New: AI configuration snapshot (no secrets)
      const aiSection: {
        provider: string;
        model: string;
        baseUrlPresent: boolean;
        requiresJwt: boolean;
        stateWorkerActive: boolean;
        quota: { enabled: boolean; active: boolean; tokens: number; windowSec: number };
        resetBackdoor: { enabled: boolean; secretLength?: number };
      } = {
        provider: aiServerConfig.provider,
        model: aiServerConfig.modelName,
        baseUrlPresent: !!aiServerConfig.baseUrl,
        requiresJwt: aiServerConfig.requiresJwt,
        stateWorkerActive: aiServerConfig.stateWorkerActive,
        quota: {
          enabled: aiServerConfig.quota.enabled,
          active: aiServerConfig.quota.active,
          tokens: aiServerConfig.quota.tokens,
          windowSec: aiServerConfig.quota.windowSec,
        },
        resetBackdoor: {
          enabled: aiServerConfig.quotaReset.enabled,
          ...(nodeEnv.NODE_ENV !== 'production'
            ? { secretLength: (aiServerConfig.secrets.quotaResetSecret?.length ?? 0) }
            : {}),
        },
      };

      // 🔥 Single, unionized startup summary log
      const summary = {
        environment: nodeEnv.NODE_ENV,
        features: {
          stateWorker: publicConfig.features.stateWorker,
          walletConnect: publicConfig.features.walletConnect,
          serviceWorker: publicConfig.features.serviceWorker,
          localNotifications: publicConfig.features.localNotifications,
        },
        chain: chainSection,
        ai: aiSection,
        infra: {
          emailConfigured: serverConfig.email.isConfigured,
          r2Configured: serverConfig.r2.isConfigured,
          cloudflareWorker: serverConfig.email.useWorker,
        },
        backdoor: {
          enabled: serverConfig.backdoor.isEnabled,
          tokenId: serverConfig.backdoor.tokenId ?? null,
        },
        domain: publicEnv.NEXT_PUBLIC_DOMAIN,
      };

      logger.info('🚀 Startup configuration', summary);

      // Optional: production warnings
      if (nodeEnv.NODE_ENV === 'production') {
        const warnings: string[] = [];

        if (!serverConfig.email.isConfigured) {
          warnings.push('Email is not configured in production');
        }
        if (!publicEnv.NEXT_PUBLIC_ALCHEMY_API_KEY) {
          warnings.push('Alchemy API key not set - using public RPC endpoints in production');
        }
        if (serverConfig.backdoor.isEnabled) {
          warnings.push('⚠️ BACKDOOR TOKEN IS ENABLED IN PRODUCTION');
        }
        // New: AI quota is enabled but not active (likely because requiresJwt=false or worker inactive)
        if (aiServerConfig.quota.enabled && !aiServerConfig.quota.active) {
          warnings.push(
            'AI quota is enabled but not active (requiresJwt, state worker, and quota must all be true)',
          );
        }

        if (warnings.length > 0) {
          logger.warn('⚠️ Production configuration warnings:', { warnings });
        }
      }
    } catch (error) {
      logger.error('❌ Environment validation failed:', error);
      throw error;
    }
  })();

  return globalThis.__ENV_VALIDATION_PROMISE;
}

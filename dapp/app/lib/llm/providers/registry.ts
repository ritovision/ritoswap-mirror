// app/lib/llm/providers/registry.ts
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { ChatOpenAI } from '@langchain/openai';
import { aiServerConfig } from '@/app/config/ai.server';
import { createLogger } from '@logger';

const logger = createLogger('provider-registry');

export type ProviderType = 'openai' | 'lmstudio';

export interface ProviderConfig {
  model?: string;
  modelIndex?: number; // 1-based index for model selection
  temperature?: number;
  maxTokens?: number;
  streaming?: boolean;
}

type OpenAIChatConfig = {
  modelName: string;
  openAIApiKey: string;
  maxTokens?: number;
  streaming?: boolean;
  temperature?: number;
  configuration?: { baseURL?: string };
};

type MutableChatModel = BaseChatModel & {
  modelName?: string;
  temperature?: number;
  maxTokens?: number;
  streaming?: boolean;
};

class ProviderRegistry {
  private providers: Map<ProviderType, (modelIndex?: number) => BaseChatModel> = new Map();

  constructor() {
    this.registerProviders();
  }

  private registerProviders() {
    // OpenAI Provider
    this.providers.set('openai', (modelIndex?: number) => {
      if (!aiServerConfig.secrets.openaiApiKey) {
        throw new Error('OpenAI API key not configured');
      }

      const model = modelIndex ? aiServerConfig.getModel(modelIndex) : aiServerConfig.models[0];

      logger.info('[provider:openai] Creating instance', {
        model,
        modelIndex,
        maxTokens: aiServerConfig.limits.maxOutputTokens,
        hasTemperature: aiServerConfig.temperature !== undefined,
      });

      const baseConfig: OpenAIChatConfig = {
        modelName: model,
        openAIApiKey: aiServerConfig.secrets.openaiApiKey,
        maxTokens: aiServerConfig.limits.maxOutputTokens,
        streaming: true,
      };

      const config: OpenAIChatConfig =
        aiServerConfig.temperature !== undefined
          ? { ...baseConfig, temperature: aiServerConfig.temperature }
          : baseConfig;

      return new ChatOpenAI(
        config as unknown as ConstructorParameters<typeof ChatOpenAI>[0]
      );
    });

    // LMStudio Provider (uses OpenAI-compatible API)
    this.providers.set('lmstudio', (modelIndex?: number) => {
      if (!aiServerConfig.baseUrl) {
        throw new Error('LMStudio base URL not configured');
      }

      const model = modelIndex ? aiServerConfig.getModel(modelIndex) : aiServerConfig.models[0];

      logger.info('[provider:lmstudio] Creating instance', {
        baseUrl: aiServerConfig.baseUrl,
        model,
        modelIndex,
        maxTokens: aiServerConfig.limits.maxOutputTokens,
        hasTemperature: aiServerConfig.temperature !== undefined,
      });

      const baseConfig: OpenAIChatConfig = {
        modelName: model,
        openAIApiKey: 'not-needed',
        configuration: {
          baseURL: aiServerConfig.baseUrl,
        },
        maxTokens: aiServerConfig.limits.maxOutputTokens,
        streaming: true,
      };

      const config: OpenAIChatConfig =
        aiServerConfig.temperature !== undefined
          ? { ...baseConfig, temperature: aiServerConfig.temperature }
          : baseConfig;

      return new ChatOpenAI(
        config as unknown as ConstructorParameters<typeof ChatOpenAI>[0]
      );
    });
  }

  getProvider(config?: ProviderConfig): BaseChatModel {
    const providerType = aiServerConfig.provider;
    const factory = this.providers.get(providerType);

    if (!factory) {
      throw new Error(`Unknown provider: ${providerType}`);
    }

    // Pass model index to factory
    const modelIndex = config?.modelIndex;

    logger.info('[provider:get]', {
      type: providerType,
      configuredModels: aiServerConfig.models,
      modelIndex: modelIndex || 1,
      overrideModel: config?.model,
      temperature: config?.temperature ?? aiServerConfig.temperature,
    });

    const llm = factory(modelIndex);

    // Apply config overrides if provided
    if (config) {
      const m = llm as MutableChatModel;

      // Direct model override takes precedence over modelIndex
      if (config.model !== undefined) {
        m.modelName = config.model;
      }

      // Handle temperature override
      if (config.temperature !== undefined) {
        m.temperature = config.temperature;
      }

      // Handle maxTokens override
      if (config.maxTokens !== undefined) {
        m.maxTokens = config.maxTokens;
      }

      if (config.streaming !== undefined) {
        m.streaming = config.streaming;
      }
    }

    return llm;
  }

  getCurrentProvider(): ProviderType {
    return aiServerConfig.provider;
  }

  getProviderInfo() {
    return {
      provider: aiServerConfig.provider,
      models: aiServerConfig.models,
      defaultModel: aiServerConfig.models[0],
      baseUrl: aiServerConfig.baseUrl,
      temperature: aiServerConfig.temperature,
      maxTokens: aiServerConfig.limits.maxOutputTokens,
      maxDuration: aiServerConfig.limits.maxDurationSec,
    };
  }
}

export const providerRegistry = new ProviderRegistry();

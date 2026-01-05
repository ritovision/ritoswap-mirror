// app/lib/llm/__tests__/__provider-tests__/test-provider.ts
// Run with: pnpm exec tsx app/lib/llm/__tests__/__provider-tests__/test-provider.ts [--modelIndex=1] [--model="override-name"]
// Purpose: Simple smoke test to confirm your provider+model are reachable and responding.

import { pathToFileURL } from 'url';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { ChatOpenAI } from '@langchain/openai';
import { aiServerConfig } from './ai-server-test';

type CliFlags = {
  modelIndex?: number;
  model?: string;
};

function parseFlags(argv: string[]): CliFlags {
  const out: CliFlags = {};
  for (const a of argv) {
    if (a.startsWith('--modelIndex=')) {
      const v = Number(a.split('=')[1]);
      if (!Number.isNaN(v)) out.modelIndex = v;
    } else if (a.startsWith('--model=')) {
      out.model = a.split('=')[1];
    }
  }
  return out;
}

async function testProvider() {
  const flags = parseFlags(process.argv.slice(2));
  const useModel =
    (flags.model && flags.model.trim()) ||
    (typeof flags.modelIndex === 'number'
      ? aiServerConfig.getModel(flags.modelIndex)
      : aiServerConfig.modelName);

  console.log('🔧 Testing LLM Provider Configuration\n');
  console.log('Provider:', aiServerConfig.provider);
  console.log('Models:', aiServerConfig.models);
  console.log('Using Model:', useModel);
  console.log('Base URL:', aiServerConfig.baseUrl || 'N/A');
  console.log('Temperature:', aiServerConfig.temperature ?? 'Not set');
  console.log('Max Tokens:', aiServerConfig.limits.maxOutputTokens);
  console.log('---\n');

  try {
    let llm: any;

    if (aiServerConfig.provider === 'openai') {
      if (!aiServerConfig.secrets.openaiApiKey) {
        throw new Error('OpenAI API key not configured (OPENAI_API_KEY).');
      }

      const isReasoningModel = useModel.includes('o1') || useModel.includes('o3') || useModel.includes('gpt-5');
      
      const config: any = {
        modelName: useModel,
        openAIApiKey: aiServerConfig.secrets.openaiApiKey,
        streaming: false,
      };
      
      if (isReasoningModel) {
        // Reasoning models: only set max_completion_tokens, no maxTokens
        config.modelKwargs = { max_completion_tokens: 2000 };
      } else {
        config.maxTokens = 1000;
      }
      
      if (aiServerConfig.temperature !== undefined) {
        config.temperature = aiServerConfig.temperature;
      }
      
      llm = new ChatOpenAI(config);
    } else {
      // FIX: Set dummy env var for lmstudio to satisfy OpenAI SDK
      if (!process.env.OPENAI_API_KEY) {
        process.env.OPENAI_API_KEY = 'sk-dummy-local-studio-key';
      }

      const config: any = {
        modelName: useModel,
        openAIApiKey: 'sk-dummy-local-studio-key', // Dummy key for local
        configuration: {
          baseURL: aiServerConfig.baseUrl,
        },
        maxTokens: 100,
        streaming: false,
      };
      if (aiServerConfig.temperature !== undefined) {
        config.temperature = aiServerConfig.temperature;
      }
      llm = new ChatOpenAI(config);
    }

    const messages = [
      new SystemMessage('You are a helpful assistant. Be VERY brief.'),
      new HumanMessage('Say "Hello World" and nothing else.'),
    ];

    console.log('📤 Sending test message...\n');
    const response = await llm.invoke(messages);

    console.log('📥 Response:');
    console.log(response?.content);
    console.log('\n✅ Test completed successfully!');
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  testProvider().catch(console.error);
}

export { testProvider };

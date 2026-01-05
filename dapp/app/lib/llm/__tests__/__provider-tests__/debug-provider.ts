// app/lib/llm/__tests__/__provider-tests__/debug-provider.ts
// Run with: pnpm exec tsx app/lib/llm/__tests__/__provider-tests__/debug-provider.ts [--modelIndex=1] [--model="override-name"]

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

async function debugProvider() {
  const flags = parseFlags(process.argv.slice(2));
  const useModel =
    (flags.model && flags.model.trim()) ||
    (typeof flags.modelIndex === 'number'
      ? aiServerConfig.getModel(flags.modelIndex)
      : aiServerConfig.modelName);

  console.log('🔍 Debug Provider Configuration\n');
  console.log('Raw Env (selected):');
  console.log('- AI_PROVIDER:', process.env.AI_PROVIDER);
  console.log('- AI_OPENAI_MODEL_1:', process.env.AI_OPENAI_MODEL_1);
  console.log('- AI_LOCAL_MODEL_1:', process.env.AI_LOCAL_MODEL_1);
  console.log('- AI_TEMPERATURE:', process.env.AI_TEMPERATURE || '(not set)');
  console.log('\nParsed Configuration:');
  console.log('- Provider:', aiServerConfig.provider);
  console.log('- Models:', aiServerConfig.models);
  console.log('- Using Model:', useModel);
  console.log('- Base URL:', aiServerConfig.baseUrl || 'N/A');
  console.log('- Temperature:', aiServerConfig.temperature ?? '(not set - model default)');
  console.log('- Max Tokens:', aiServerConfig.limits.maxOutputTokens);
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
        configuration: { baseURL: aiServerConfig.baseUrl },
        maxTokens: 100,
        streaming: false,
      };
      if (aiServerConfig.temperature !== undefined) {
        config.temperature = aiServerConfig.temperature;
      }
      llm = new ChatOpenAI(config);
    }

    console.log('✅ Provider initialized\n');
    console.log('Introspection:');
    console.log('- modelName prop:', (llm as any).modelName);
    console.log('- temperature prop:', (llm as any).temperature ?? '(not set)');
    console.log('- maxTokens prop:', (llm as any).maxTokens);
    const clientCfg: any = (llm as any).clientConfig || (llm as any).client?.config || (llm as any).configuration;
    const baseURL = (clientCfg as any)?.baseURL || (clientCfg as any)?.baseUrl || (clientCfg as any)?.base_url;
    if (baseURL) console.log('- baseURL (client):', baseURL);
    console.log('---\n');

    const idMessages = [
      new SystemMessage('You are a helpful assistant. Be extremely brief.'),
      new HumanMessage('What is your exact model name? Reply with only the model identifier.'),
    ];
    console.log('📤 Asking model to identify itself...\n');
    const idResp = await llm.invoke(idMessages);
    console.log('Raw response:', JSON.stringify(idResp, null, 2));
    console.log('📥 Model identifies as:');
    console.log(idResp?.content);
    console.log('---\n');

    const verifyMessages = [
      new SystemMessage('Answer honestly and directly.'),
      new HumanMessage(`Are you "${useModel}" or a different model? Reply with only the actual model name you are.`),
    ];
    console.log('📤 Direct model verification...\n');
    const verifyResp = await llm.invoke(verifyMessages);
    console.log('Raw response:', JSON.stringify(verifyResp, null, 2));
    console.log('📥 Model confirms:');
    console.log(verifyResp?.content);

    console.log('\n✅ Debug completed!');
    console.log('If the name differs from your configured model, check key access and endpoint baseURL.');
  } catch (error) {
    console.error('❌ Debug failed:', error);
    process.exit(1);
  }
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  debugProvider().catch(console.error);
}

export { debugProvider };

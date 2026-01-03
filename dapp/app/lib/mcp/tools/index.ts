// dapp/app/lib/mcp/tools/index.ts
import { ToolDefinition } from './types';
import ethBalanceTool from './eth-balance';
import keyNftRead from './keynft-read';
import sendCryptoTool from './send-crypto';
import { aiServerConfig } from '@config/ai.server';
import markKeyUsed from './mark-key-used';
import pineconeSearchTool from './pinecone-search';
import { pineconeConfig } from '@config/pinecone.config';
import imageGenerateWorkflow from './image-generate-workflow';
import agentRapVerseTool from './agent-rap-verse';
import keyNftManage from './keynft-manage';
import keyNftUsedCount from './keynft-used-count';
import sendCryptoAgentTool from './send-crypto-agent';

export class ToolRegistry {
  private tools: Map<string, ToolDefinition>;

  constructor() {
    this.tools = new Map();
    this.registerDefaultTools();
  }

  private registerDefaultTools(): void {
    this.register(ethBalanceTool);
    this.register(keyNftRead);
    this.register(imageGenerateWorkflow);
    if (aiServerConfig.secrets?.aiPrivateKey) {
      this.register(sendCryptoTool);
    }
    this.register(markKeyUsed);
    if (pineconeConfig.isConfigured) {
      this.register(pineconeSearchTool);
    }

    if (aiServerConfig.secrets?.aiPrivateKey) {
      this.register(sendCryptoAgentTool);
    }
    if (
      aiServerConfig.secrets?.openaiApiKey &&
      pineconeConfig.isConfigured &&
      aiServerConfig.provider === 'openai'
    ) {
      this.register(agentRapVerseTool);
    }
    if (aiServerConfig.secrets?.aiPrivateKey) {
      this.register(keyNftManage);
    }
    this.register(keyNftUsedCount);
  }

  register(toolDef: ToolDefinition): void {
    const { tool } = toolDef;
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool "${tool.name}" is already registered`);
    }
    this.tools.set(tool.name, toolDef);
  }

  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }
  getAll(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }
  getNames(): string[] {
    return Array.from(this.tools.keys());
  }
  has(name: string): boolean {
    return this.tools.has(name);
  }
}

export const toolRegistry = new ToolRegistry();

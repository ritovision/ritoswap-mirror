// dapp/lib/llm/modes/configs/freestyle.ts
import { ModeConfig } from '../types';
import {
  cryptoBase,
  rapStyle,
  musicTool,
  RitoRhymesCatalogue,
  KeyNFTtool,
  ChainLogoTool,
  GIFtool,
  ImageTool,
  HyperlinkTool,
  SVGtool,
  PageRefresh,
} from '../fragments';

export const freestyleConfig: ModeConfig = {
  id: 'freestyle',
  title: 'Freestyle Rap Mode',
  description: 'Kick it with crypto tunes, vibes and memes.',
  buildPrompt: (nftContext?: string) => {
    const fragments = [
      cryptoBase,
      rapStyle,
      musicTool,
      RitoRhymesCatalogue,
      KeyNFTtool,
      ChainLogoTool,
      GIFtool,
      ImageTool,
      HyperlinkTool,
      SVGtool,
      PageRefresh,
      'You are RapBotRito, an infotaining crypto rapper based on Rito Rhymes. Use inline tools like the ChainLogoTool, musicTool, GIFtool and others when appropriate inside your rap to enhance the vibe. They become a part of the rap.',
    ];

    if (nftContext) {
      fragments.push(nftContext);
    }

    return fragments.join('\n\n');
  },
  buildWelcome: (_nftContext?: string) => {
    return [
      '🎛️ **Music & Vibes Mode on.**',
      'I can spit crypto bars, share memes, interact with the blockchain, generates new images and control a music player.',
    ].join('\n');
  },
  availableTools: ['music'],
  mcpTools: [
    'get_eth_balance',
    'key_nft_read',
    'manage_key_nft',
    'keynft_used_count',
    'mark_key_used',
    'pinecone_search',
    'generate_image_with_alt',
    'send_crypto_agent',
  ],
};
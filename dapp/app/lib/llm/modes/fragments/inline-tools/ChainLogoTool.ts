// dapp/lib/llm/modes/fragments/ChainLogoTool.ts
export const ChainLogoTool = `Use ChainLogo tool to render a blockchain's logo inline in chat.

Commands:
<chain-logo name="Ethereum" /> (defaults to 200 width)
<chain-logo name="Bitcoin" width="64" />

It can adapt approximate blockchain names but try to use the full name.
Use this freely when talking about blockchains.
`;

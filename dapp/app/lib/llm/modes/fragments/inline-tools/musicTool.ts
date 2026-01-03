// dapp/lib/llm/modes/fragments/musicTool.ts
export const musicTool = `You can control a local music player by emitting special commands in your text responses.
Available commands:
  - Load & play a song:
    <music song="Altcoin_Love" />
  - Load without autoplay:
    <music song="A-Trillie" autoplay="false" />
  - Load and jump to 1:23:
    <music song="Hodeler" timeline="1:23" />
  - Seek current song to 90 seconds:
    <music time="90" />
  - Toggle play/pause:
    <music action="toggle" />
  - Load with explicit extension:
    <music song="blockchain4aG" ext="mp3" />

The music enhances the crypto experience - use it to set the vibe when appropriate.
`;

// dapp/app/lib/mcp/tools/agent-rap-verse/utils/cleaners.ts
//
// Clean and sanitize verse output
//

import type { ChatMessage } from '../types';

export function cleanVerseOutput(raw: string): string {
  let cleaned = raw.trim();
  
  // Remove JSON blocks
  cleaned = cleaned.replace(/```json[\s\S]*?```/gi, '');
  cleaned = cleaned.replace(/```[\s\S]*?```/g, '');
  
  // Remove JSON objects
  cleaned = cleaned.replace(/\{[\s\S]*?"(?:strategy|theme|tone|verse|isReadyToShip)"[\s\S]*?\}/gi, '');
  
  // Remove common prefixes
  cleaned = cleaned.replace(/^(?:here'?s? (?:my|the|a) ?verse:?|verse:?|okay,?|alright,?|yo,?|sure,?)\s*/im, '');
  
  // Filter out JSON-looking lines
  const lines = cleaned.split('\n');
  const filtered = lines.filter(line => {
    const trimmed = line.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('}')) return false;
    if (trimmed.startsWith('"') && trimmed.includes('":')) return false;
    return true;
  });
  
  cleaned = filtered.join('\n').trim();
  
  // Strip surrounding quotes if present
  if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
    cleaned = cleaned.slice(1, -1);
  }
  
  return cleaned;
}

export function getRecentOpponentBars(history: ChatMessage[], maxLength: number = 400): string {
  return history
    .filter((m) => m.role === 'user')
    .slice(-3)
    .map((m) => m.content || m.text || '')
    .join(' | ')
    .slice(0, maxLength);
}
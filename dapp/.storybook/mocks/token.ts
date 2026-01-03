export const DEFAULT_TOKEN_ID = 11;

// Key visuals (used by mint stories, but reusable elsewhere).
export const KEY_BG = '#000000';
export const KEY_FG = '#FC1819';

export function createMockKeyToken(tokenId: number = DEFAULT_TOKEN_ID) {
  return {
    tokenId,
    backgroundColor: KEY_BG,
    keyColor: KEY_FG,
  } as const;
}

export const tokenIdArgTypes = {
  tokenId: {
    control: { type: 'number' as const, min: 0, step: 1 },
  },
};


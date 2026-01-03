// dapp/app/lib/llm/modes/__tests__/configs.spec.ts
import { modeConfigs, getModeConfig } from '../configs';

// helper to detect ModeConfig-like objects (runtime shape)
function isModeConfig(obj: any): obj is {
  id: string;
  title: string;
  buildPrompt: (ctx?: string) => string;
  buildWelcome: (ctx?: string) => string;
  availableTools?: string[];
  mcpTools?: string[];
} {
  return (
    obj &&
    typeof obj === 'object' &&
    typeof obj.id === 'string' &&
    typeof obj.title === 'string' &&
    typeof obj.buildPrompt === 'function' &&
    typeof obj.buildWelcome === 'function'
  );
}

function isStringArray(arr: unknown): arr is string[] {
  return Array.isArray(arr) && arr.every((x) => typeof x === 'string');
}

describe('mode configs (dynamic shape tests)', () => {
  // Vite-powered dynamic import of all config files except index.ts
  // This means the test automatically includes new configs you add later.
  const modules = import.meta.glob('../configs/!(index).ts', { eager: true });

  const discoveredConfigs = Object.values(modules)
    .flatMap((mod: any) => Object.values(mod))
    .filter(isModeConfig);

  it('discovers at least one mode config', () => {
    expect(discoveredConfigs.length).toBeGreaterThan(0);
  });

  it('each discovered config has the expected shape & behavior', () => {
    for (const cfg of discoveredConfigs) {
      // id/title exist
      expect(typeof cfg.id).toBe('string');
      expect(cfg.id).not.toBe('choose'); // runtime guard only
      expect(typeof cfg.title).toBe('string');
      expect(cfg.title.trim().length).toBeGreaterThan(0);

      // buildPrompt/buildWelcome produce non-empty strings
      const prompt = cfg.buildPrompt();
      expect(typeof prompt).toBe('string');
      expect(prompt.trim().length).toBeGreaterThan(0);

      const welcome = cfg.buildWelcome();
      expect(typeof welcome).toBe('string');
      expect(welcome.trim().length).toBeGreaterThan(0);

      // buildPrompt should propagate nftContext when provided (no content coupling)
      const sentinelCtx = '__TEST_NFT_CONTEXT__';
      const promptWithCtx = cfg.buildPrompt(sentinelCtx);
      expect(promptWithCtx).toContain(sentinelCtx);

      // optional arrays are arrays of strings (no content coupling)
      if (cfg.availableTools !== undefined) {
        expect(isStringArray(cfg.availableTools)).toBe(true);
      }
      if (cfg.mcpTools !== undefined) {
        expect(isStringArray(cfg.mcpTools)).toBe(true);
        // no duplicates
        const set = new Set(cfg.mcpTools);
        expect(set.size).toBe(cfg.mcpTools.length);
      }
    }
  });

  it('modeConfigs exposes discovered configs by id', () => {
    // every discovered config id should exist in modeConfigs
    for (const cfg of discoveredConfigs) {
      // because modeConfigs keys are the ids
      expect(modeConfigs).toHaveProperty(cfg.id);
      const mapped = (modeConfigs as Record<string, any>)[cfg.id];
      expect(isModeConfig(mapped)).toBe(true);
      expect(mapped.id).toBe(cfg.id);
    }
  });

  it('getModeConfig returns config for known ids and null for "choose"', () => {
    expect(getModeConfig('choose')).toBeNull();

    // validate that getModeConfig works for the ids we discovered at runtime
    for (const cfg of discoveredConfigs) {
      // cast is okay in test; we verify shape above
      const resolved = getModeConfig(cfg.id as any);
      expect(resolved).toBeTruthy();
      expect(resolved!.id).toBe(cfg.id);
    }
  });

  it('no mode config returns empty strings', () => {
    for (const cfg of discoveredConfigs) {
      const p = cfg.buildPrompt('');
      const w = cfg.buildWelcome('');
      expect(p.trim()).not.toBe('');
      expect(w.trim()).not.toBe('');
    }
  });
});

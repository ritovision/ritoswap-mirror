import type { StorybookConfig } from '@storybook/nextjs-vite';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

const config: StorybookConfig = {
  stories: [
    '../.storybook/stories/**/*.stories.@(ts|tsx)',
    '../app/**/__stories__/**/*.stories.@(ts|tsx)',
    '../app/**/*.stories.@(ts|tsx)',
    '../components/**/*.stories.@(ts|tsx)',
  ],
  addons: ['@storybook/addon-docs'],
  framework: {
    name: '@storybook/nextjs-vite',
    options: {},
  },
  viteFinal: async (viteConfig) => {
    const { default: tsconfigPaths } = await import('vite-tsconfig-paths');
    const sentryMockPath = join(here, 'mocks', 'sentry.ts');
    const projectRoot = join(here, '..');
    const browserDefine = {
      __dirname: JSON.stringify('/'),
      __filename: JSON.stringify('/index.js'),
    };

    viteConfig.plugins = [
      ...(viteConfig.plugins ?? []),
      tsconfigPaths({ projects: [join(here, 'tsconfig.json')] }),
    ];

    // Let Vite handle `public/` assets instead of Storybook's staticDirs copying
    // (prevents Windows fs copy issues during `build-sb`).
    viteConfig.publicDir = join(here, '..', 'public');

    viteConfig.define = {
      ...(viteConfig.define ?? {}),
      'process.env': {},
      ...browserDefine,
    };

    viteConfig.optimizeDeps = {
      ...(viteConfig.optimizeDeps ?? {}),
      esbuildOptions: {
        ...(viteConfig.optimizeDeps?.esbuildOptions ?? {}),
        define: {
          ...(viteConfig.optimizeDeps?.esbuildOptions?.define ?? {}),
          ...browserDefine,
        },
      },
    };

    const existingAlias = viteConfig.resolve?.alias ?? {};
    viteConfig.resolve = {
      ...(viteConfig.resolve ?? {}),
      alias: Array.isArray(existingAlias)
        ? [
            ...existingAlias,
            { find: '@sentry/nextjs', replacement: sentryMockPath },
            { find: '@', replacement: projectRoot },
          ]
        : { ...existingAlias, '@sentry/nextjs': sentryMockPath, '@': projectRoot },
    };

    return viteConfig;
  },
};

export default config;

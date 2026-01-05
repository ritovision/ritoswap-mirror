// vitest.config.ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [
    react(),
    tsconfigPaths(),
  ],
  // Let Vite handle CSS Modules for any *.module.css import
  css: {
    modules: {
      // optional: customize the classname format
      generateScopedName: '[name]__[local]___[hash:base64:5]',
    },
  },
  test: {
    environment: 'happy-dom',
    globals:     true,
    setupFiles:  ['./test/setup.ts'],
    css:         false,
    exclude: [
      'node_modules',
      'dist',
      'e2e/**',
      '**/*.e2e.*',
      '../cloudflare/**',
      './cloudflare/**',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        // Default exclusions
        'node_modules/**',
        'dist/**',
        '.next/**',
        'coverage/**',

        
        // Test files
        '**/*.test.{js,ts,jsx,tsx}',
        '**/*.spec.{js,ts,jsx,tsx}',
        '**/test/**',
        '**/tests/**',
        '**/__tests__/**',
        '**/__mocks__/**',
        '**/e2e/**',
        
        // Config files
        '*.config.{js,ts,mjs,mts,cjs}',
        'next.config.cjs',
        'vitest.config.ts',
        'playwright.config.*',
        'tailwind.config.*',
        
        // Build/Generated files
        '**/sw.js',
        '**/worker.js',
        '**/_version.js',
        '**/workbox-*/**',
        '**/storybook-static/**',
        '/app/lib/mcp/generated/tool-catalog-types.ts',
        
        // Testing utilities
        '**/playwright*/**',
        '**/supertest/**',
        '**/postman/**',
        '../cloudflare/**',
        './cloudflare/**',
        
        // Scripts and setup files
        '**/scripts/**',
        '**/setup.ts',
        '**/setup.js',
        '**/*setup.ts',
        '**/*setup.js',
        
        // Type definitions and schemas
        '**/*.d.ts',
        '**/schemas/openapi/**',
        '**/zod-openapi.ts',
        'dapp/app/lib/client/types.ts',
        
        // Environment and validation files
        '**/validate.ts',
        '**/env.*.ts',
        
        // Server files that shouldn't be tested in browser env
        '**/server.env.ts',
        '**/r2.ts',
        'app/layout.tsx',
        'app/error.tsx',
        'app/global-error.tsx',
        'middleware.ts',
        '**/middleware.ts',

        // Type-only and server-only modules
        'app/schemas/domain/siwe.domain.ts',
        'app/schemas/domain/legacy-auth.domain.ts',
        'app/schemas/domain/nonce.domain.ts',
        'app/schemas/domain/tool.ts',
        'app/schemas/token-status.ts',
        'app/lib/state/types.ts',
        'app/lib/state/client.ts',
        'app/lib/server/gatedContent.ts',
        'app/lib/jwt/index.ts',
        'app/lib/llm/types.ts',
        'app/lib/llm/modes/types.ts',
        'app/lib/mcp/types.ts',
        'app/lib/mcp/server/types.ts',
        'app/lib/mcp/tools/agent-rap-verse/index.ts',
        'app/lib/mcp/tools/agent-rap-verse/orchestrator.ts',
        'app/lib/mcp/tools/agent-rap-verse/types.ts',
        'app/lib/mcp/tools/agent-rap-verse/phases/**',
        'instrumentation-client.ts',
        'instrumentation.ts',
        'components/chatBot/ChatHeader.tsx',
        'components/chatBot/ChatContainer.tsx',
        'components/chatBot/ChatMessages/types.ts',
        
        // Debug and development files
        '**/debug/**',
        '**/DebugPanel.tsx',
        '**/Versions.tsx',
        'pinecone/*',
        
        // Third-party or generated code
        '**/public/workbox-*/**',
        
        // Storybook files
        '**/*.stories.{js,ts,jsx,tsx}',
        '**/__stories__/**',
        '**/.storybook/**',
        
        // Exclude server-side only files if testing in browser env
        '**/*.server.ts',
        '**/*.server.tsx',
        
        // JSON-LD files (metadata)
        '**/jsonld/**',
        
        // Keep not-found since it's usually minimal
        '**/not-found.tsx',

        '**/Music.tsx',
        '**/RefreshButton.tsx',
        '**/PortfolioContent.tsx',
        '**/*.server.tsx',
        '**/providers.tsx',
        '**/NetworkModal.tsx',
        '**/ConnectState.tsx',
        '**/pwa/**',
        '**/fetchedContent.ts',
        '**/rateLimit.client.ts',
        '**/FooterSocialsServer.tsx',
        '**/FooterMenuServer.tsx',
        '**/FooterLegalServer.tsx',
        '**/ImageQuoteServer.tsx',
        '**/LogoArrayServer.tsx',
        '**/FooterMobileServer.tsx',
        '**/FooterDesktopServer.tsx',
        '**/buttons/*',
        'app/api/health/route.ts',
        'app/gate/page.tsx',
        '**/WalletConnectProvider.tsx',
        '**/GatedContent.ts',
        '**/TokenAccordionContent.tsx',
        '../cloudflare/**',
        './cloudflare/**',
      ],
      thresholds: {
        branches: 75,
        functions: 75,
        lines: 75,
        statements: 75
      }
    }
  },
})

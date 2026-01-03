// next.config.js
const { z } = require('zod');

/**
 * Build-time environment validation
 * We only validate what's needed for next.config.js at build time
 * Your runtime validators will handle the rest when the app runs
 */
const buildTimeSchema = z.object({
  // Node environment (needed for build decisions)
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Vercel-specific (optional)
  VERCEL_ENV: z.enum(['development', 'preview', 'production']).optional(),

  // Only the NEXT_PUBLIC vars that affect build configuration
  NEXT_PUBLIC_SW: z
    .string()
    .optional()
    .default('false')
    .transform((val) => val === 'true'),

  // You might want to validate critical vars at build time to fail fast
  DATABASE_URL: z.string().min(1).optional(), // Optional at build, but validates if present
});

// Validate build-time environment
let buildEnv;
try {
  buildEnv = buildTimeSchema.parse(process.env);
  console.log('✅ Build environment validated');
} catch (error) {
  console.error('❌ Build environment validation failed:');
  if (error instanceof z.ZodError) {
    console.error(error.flatten().fieldErrors);
  }
  // Decide: throw error to fail build, or use defaults
  // throw new Error('Invalid build configuration');

  // Or use defaults for non-critical vars:
  buildEnv = {
    NODE_ENV: 'development',
    NEXT_PUBLIC_SW: false,
    ...process.env, // Pass through other vars
  };
}

// Determine environment booleans
const isProd = buildEnv.NODE_ENV === 'production' || buildEnv.VERCEL_ENV === 'production';
const isPwaEnabled = buildEnv.NEXT_PUBLIC_SW;

// Log build config (only once)
console.log(`🔧 Building for: ${buildEnv.NODE_ENV} environment`);
console.log(`📱 PWA: ${isPwaEnabled ? 'Enabled' : 'Disabled'}`);

// Configure PWA
const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  runtimeCaching: [
    {
      urlPattern: /^https?.*/,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'offlineCache',
        expiration: {
          maxEntries: 200,
        },
      },
    },
  ],
  disable: !isPwaEnabled,
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  sassOptions: {},

  compiler: {
    removeConsole: isProd,
  },
  experimental: {
    instrumentationHook: true,
  },

  webpack(config, { isServer }) {
    config.externals = config.externals || [];
    config.externals.push('pino-pretty', 'lokijs', 'encoding');

    if (!isServer) {
      config.resolve.fallback = {
        ...(config.resolve.fallback || {}),
        fs: false,
        path: false,
        os: false,
        net: false,
        tls: false,
      };
    }

    return config;
  },

  async headers() {
    const csp = [
      `default-src * 'unsafe-inline' 'unsafe-eval' data: blob:;`,
      `script-src  * 'unsafe-inline' 'unsafe-eval' data: blob:;`,
      `style-src   * 'unsafe-inline' data: blob:;`,
      `img-src     * data: blob:;`,
      `font-src    * data:;`,
      `media-src   * data: blob:;`,
      `connect-src *;`,
      `frame-ancestors 'self';`,
      ...(isProd ? ['upgrade-insecure-requests;'] : []),
    ].join(' ');

    const baseHeaders = [
      { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'no-referrer-when-downgrade' },
      { key: 'Content-Security-Policy', value: csp },
    ];

    if (isProd) {
      baseHeaders.push({
        key: 'Strict-Transport-Security',
        value: 'max-age=63072000; includeSubDomains; preload',
      });
    }

    return [
      {
        source: '/:path*',
        headers: baseHeaders,
      },
    ];
  },

  // Pass validated env vars to the app if needed
  env: {
    // Only pass through vars that should be available at runtime
    // but aren't NEXT_PUBLIC_ (those are auto-passed)
    BUILD_TIME: new Date().toISOString(),
    BUILD_ENV: buildEnv.NODE_ENV,
  },
};

module.exports = withPWA(nextConfig);

// Injected content via Sentry wizard below

const { withSentryConfig } = require("@sentry/nextjs");

module.exports = withSentryConfig(module.exports, {
  // For all available options, see:
  // https://www.npmjs.com/package/@sentry/webpack-plugin#options

  org: "ritovision",
  project: "ritoswap",

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // Uncomment to route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
  // This can increase your server load as well as your hosting bill.
  // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
  // side errors will fail.
  tunnelRoute: "/monitoring",

  webpack: {
    // Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
    // See the following for more information:
    // https://docs.sentry.io/product/crons/
    // https://vercel.com/docs/cron-jobs
    automaticVercelMonitors: true,

    // Tree-shaking options for reducing bundle size
    treeshake: {
      // Automatically tree-shake Sentry logger statements to reduce bundle size
      removeDebugLogging: true,
    },
  },
});

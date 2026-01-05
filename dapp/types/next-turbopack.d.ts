// types/next-turbopack.d.ts

// This augments the built-in TurbopackOptions in Next.js
declare module 'next/dist/server/config-shared' {
  interface TurbopackOptions {
    /**
     * Enable or disable tree shaking in dev and future builds.
     * @see https://nextjs.org/docs/app/api-reference/config/next-config-js/turbopack
     */
    treeShaking?: boolean;
    /**
     * Set a memory limit (in bytes) for Turbopack.
     * @see https://nextjs.org/docs/app/api-reference/config/next-config-js/turbopack
     */
    memoryLimit?: number;
  }
}

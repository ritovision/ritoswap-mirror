// types/global.d.ts
export {};

declare global {
  interface Window {
    /**
     * Helpers injected by the gated content script/renderer.
     * These are used by the page to build the exact server-bound message.
     */
    __gate?: {
      buildEnvelope: () => import('@/app/lib/client/signing').GateEnvelope;
      /**
       * Build the deterministic, server-verified message (legacy flow).
       * If a timestamp is supplied, the same value must be posted in the body.
       */
      buildBoundMessage: (
        tokenId: string | number,
        chainId: number,
        timestamp?: number
      ) => string;
    };

    /** Last built envelope (so callers can reuse the same timestamp). */
    __gatedEnvelope?: import('@/app/lib/client/signing').GateEnvelope;
  }
}

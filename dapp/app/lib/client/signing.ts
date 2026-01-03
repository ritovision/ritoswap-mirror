// app/lib/client/signing.ts
/**
 * Public signing helpers kept in one place so message formatting is deterministic
 * across the app and matches server-side verification.
 */

export type GateEnvelope = {
  /** "host[:port]" lowercased; e.g., "example.com", "localhost:3000" */
  domain: string;
  /** API path this signature targets, e.g., "/api/gate-access" */
  path: string;
  /** HTTP method (currently always POST) */
  method: 'POST';
  /** Milliseconds since epoch; also sent in the POST body */
  timestamp: number;
};

/** Centralized API paths (avoid stringly-typed duplication) */
export const API_PATHS = {
  gateAccess: '/api/gate-access',
  formSubmissionGate: '/api/form-submission-gate',
  nonce: '/api/nonce',
  tokenStatus: (id: number | string) => `/api/token-status/${id}`,
} as const;

/**
 * Normalize a domain-ish input into a canonical "host[:port]" lowercase string.
 * Accepts "example.com", "https://EXAMPLE.com/", "localhost:3000", etc.
 */
export function normalizeHost(input: string | null | undefined): string {
  if (!input) return '';
  const raw = String(input).trim();
  if (!raw) return '';
  try {
    const url = new URL(/^[a-z]+:\/\//i.test(raw) ? raw : `http://${raw}`);
    return url.host.toLowerCase();
  } catch {
    return raw.replace(/\/+$/, '').toLowerCase();
  }
}

/**
 * Create a fresh envelope using the current window host.
 * Prefer reusing the same envelope timestamp for message + POST body.
 */
export function buildEnvelope(params?: {
  domain?: string; // override for SSR/tests
  path?: string;
  method?: GateEnvelope['method'];
  now?: () => number;
}): GateEnvelope {
  const now = params?.now ?? Date.now;
  const domain = normalizeHost(
    params?.domain ?? (typeof window !== 'undefined' ? window.location.host : '')
  );
  return {
    domain,
    path: params?.path ?? API_PATHS.formSubmissionGate,
    method: params?.method ?? 'POST',
    timestamp: now(),
  };
}

/**
 * Deterministic message used in the **legacy** (non-SIWE) flow.
 * Must exactly match server-side expected format.
 */
export function buildBoundMessage(input: {
  tokenId: string | number;
  chainId: number;
  envelope: GateEnvelope;
}): string {
  const { tokenId, chainId, envelope } = input;
  return [
    `I own key #${String(tokenId)}`,
    `Domain: ${envelope.domain}`,
    `Path: ${envelope.path}`,
    `Method: ${envelope.method}`,
    `ChainId: ${chainId}`,
    `Timestamp: ${envelope.timestamp}`,
  ].join('\n');
}

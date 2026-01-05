// app/lib/siwe/siwe.client.ts
import { getTargetChainId } from '@/app/utils/chainConfig'
import { publicEnv, publicConfig } from '@config/public.env'
import type { SiweMessageCreationParams } from '@/app/schemas/domain/siwe.domain'

// Check if SIWE is enabled (client-side, validated flag)
export const isSiweEnabled = (): boolean => {
  return publicEnv.NEXT_PUBLIC_ENABLE_STATE_WORKER
}

// Get consistent domain (client-side)
export const getDomain = (): string => {
  // Prefer validated public env (first item if comma list)
  const configured = (publicEnv.NEXT_PUBLIC_DOMAIN || 'localhost:3000')
    .split(',')[0]
    .trim()
    .replace(/^https?:\/\//, '')
  if (configured) return configured

  // Fall back to browser location in client
  if (typeof window !== 'undefined') {
    return window.location.host
  }

  // Last resort
  return 'localhost:3000'
}

// Get full URI
export const getUri = (): string => {
  const domain = getDomain()
  // In browser, use actual protocol; otherwise infer from publicConfig
  const protocol =
    typeof window !== 'undefined'
      ? window.location.protocol.replace(':', '')
      : publicConfig.isProduction
      ? 'https'
      : 'http'
  return `${protocol}://${domain}`
}

// Create SIWE message string (EIP-4361 format)
// Now accepts typed params (though still flexible for backwards compatibility)
export function createSiweMessage(
  params: SiweMessageCreationParams | {
    address: string
    nonce: string
    statement?: string
  }
): string {
  const domain = 'domain' in params && params.domain ? params.domain : getDomain()
  const uri = 'uri' in params && params.uri ? params.uri : getUri()
  const chainId = 'chainId' in params && params.chainId ? params.chainId : getTargetChainId()
  const issuedAt = new Date().toISOString()
  const statement = params.statement || 'Sign in to RitoSwap'

  // Build SIWE message in the standard format
  return `${domain} wants you to sign in with your Ethereum account:
${params.address}

${statement}

URI: ${uri}
Version: 1
Chain ID: ${chainId}
Nonce: ${params.nonce}
Issued At: ${issuedAt}`
}

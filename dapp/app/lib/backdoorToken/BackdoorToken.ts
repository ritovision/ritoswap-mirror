/* dapp/app/lib/backdoorToken/BackdoorToken.ts */
import { z } from 'zod'
import { createLogger } from '@logger'
import { getTokenModel } from '@lib/prisma/prismaNetworkUtils'
import { serverConfig } from '@config/server.env'
import { nodeConfig } from '@config/node.env'
import { AddressSchema, TokenIdInputSchema } from '@config/security.public'

const logger = createLogger('backdoor-token')

/** Prisma record guard for the fields we mutate/read */
const TokenRecordSchema = z.object({
  tokenId: z.number().int().nonnegative(),
  used: z.boolean(),
  usedBy: z.string().regex(/^0x[a-fA-F0-9]{40}$/).nullable().optional(),
  usedAt: z.date().nullable().optional(),
})

interface BackdoorConfig {
  isEnabled: boolean
  targetTokenId: string | undefined
  authorizedAddress?: string | undefined
}

/** Minimal delegate shape used locally to avoid importing Prisma types */
type TokenModelLike = {
  findUnique: (args: { where: { tokenId: number } }) => Promise<unknown>
  upsert: (args: {
    where: { tokenId: number }
    update: { used: boolean; usedBy: string | null; usedAt: Date | null }
    create: { tokenId: number; used: boolean; usedBy: string | null; usedAt: Date | null }
  }) => Promise<unknown>
}

/**
 * Read feature flags from validated server env (source of truth)
 */
function getBackdoorConfig(): BackdoorConfig {
  const { isEnabled, tokenId, address } = serverConfig.backdoor
  return {
    isEnabled,
    targetTokenId: tokenId !== undefined ? String(tokenId) : undefined,
    authorizedAddress: address || undefined,
  }
}

/** Minimal normalizer (no checksum) for logging/compare */
function normalizeAddress(addr?: string | null): string | null {
  if (!addr) return null
  const a = addr.trim()
  if (!a.startsWith('0x') || a.length !== 42) return null
  return a.toLowerCase()
}

/**
 * Decide whether to activate the backdoor for a specific token+address.
 * - Requires BACKDOOR_TOKEN=true
 * - Requires TOKEN_ID match
 * - In production: requires BACKDOOR_ADDRESS to be set (extra safety rail)
 * - If BACKDOOR_ADDRESS is set, caller must match it
 */
function shouldActivateBackdoor(
  tokenId: string | number,
  address: string,
  log?: ReturnType<typeof logger.child>
): boolean {
  const config = getBackdoorConfig()
  const silentLog = log || logger

  if (!config.isEnabled) return false

  // Extra production guard: refuse if no authorized address is configured
  if (nodeConfig.isProduction && !config.authorizedAddress) {
    return false
  }

  if (!config.targetTokenId) {
    if (!nodeConfig.isProduction) {
      silentLog.warn('Backdoor enabled but missing TOKEN_ID; refusing to activate')
    }
    return false
  }

  const tokenIdStr = String(tokenId)
  if (tokenIdStr !== config.targetTokenId) return false

  const caller = normalizeAddress(address)
  if (!caller) {
    if (!nodeConfig.isProduction) {
      silentLog.warn('Invalid caller address format', { address })
    }
    return false
  }

  const gate = normalizeAddress(config.authorizedAddress)
  if (gate && caller !== gate) {
    silentLog.debug('Address not authorized for backdoor', {
      provided: caller.slice(0, 10),
      required: gate.slice(0, 10),
    })
    return false
  }

  const msg = nodeConfig.isProduction ? 'Special handling activated' : '🔑 BACKDOOR: Initiating token reset'
  silentLog.info(msg, { tokenId: tokenIdStr, address: caller.slice(0, 10), gated: Boolean(gate), mode: 'immediate' })
  return true
}

/**
 * Public entrypoint used by the API layer.
 * Validates inputs via shared schemas, then conditionally performs the reset.
 */
export async function scheduleTokenReset(
  tokenId: string | number,
  address: string,
  reqId?: string
): Promise<void> {
  const log = reqId ? logger.child({ reqId }) : logger
  try {
    const tokenIdNum = TokenIdInputSchema.parse(tokenId)
    const caller = AddressSchema.parse(address)

    if (!shouldActivateBackdoor(tokenIdNum, caller, log)) return

    await performTokenReset(tokenIdNum, caller, log)
  } catch (error) {
    if (!nodeConfig.isProduction) {
      log.error('Backdoor error (non-blocking)', { error: error instanceof Error ? error.message : String(error) })
    }
  }
}

/**
 * Perform the actual DB mutation with guardrails.
 */
async function performTokenReset(
  tokenIdNum: number,
  originalAddress: string,
  log: ReturnType<typeof logger.child>
): Promise<void> {
  const resetLog = log.child({ operation: 'token-reset' })
  const startTime = Date.now()

  try {
    const tokenModel = getTokenModel()
    const client = tokenModel as unknown as TokenModelLike

    const currentState = await client.findUnique({ where: { tokenId: tokenIdNum } })

    if (!currentState) {
      resetLog.warn('Token not found in database', { tokenId: tokenIdNum })
      return
    }

    const parsed = TokenRecordSchema.safeParse(currentState)
    if (!parsed.success) {
      resetLog.warn('Token record had unexpected shape; refusing to mutate', {
        tokenId: tokenIdNum,
        issues: parsed.error.issues,
      })
      return
    }
    const record = parsed.data

    if (!record.used) {
      resetLog.warn('Token was not marked as used, skipping reset', { tokenId: tokenIdNum, used: record.used })
      return
    }

    const expected = normalizeAddress(originalAddress)
    const actual = normalizeAddress(record.usedBy || undefined)
    if (!expected || !actual || actual !== expected) {
      resetLog.warn('Token used by different address, skipping reset', {
        tokenId: tokenIdNum,
        expectedAddress: expected?.slice(0, 10),
        actualAddress: actual?.slice(0, 10),
      })
      return
    }

    const confirmMsg = nodeConfig.isProduction ? 'Confirmed special state' : '🔍 BACKDOOR: Confirmed token was marked as used'
    resetLog.info(confirmMsg, { tokenId: tokenIdNum, usedBy: actual.slice(0, 10), willReset: true })

    await client.upsert({
      where: { tokenId: tokenIdNum },
      update: { used: false, usedBy: null, usedAt: null },
      create: { tokenId: tokenIdNum, used: false, usedBy: null, usedAt: null },
    })

    const successMsg = nodeConfig.isProduction ? 'Special handling completed' : '✅ BACKDOOR: Token successfully reset'
    resetLog.info(successMsg, { tokenId: tokenIdNum, durationMs: Date.now() - startTime })
  } catch (error) {
    const errorMsg = nodeConfig.isProduction ? 'Special handling failed' : '❌ BACKDOOR: Failed to reset token'
    resetLog.error(errorMsg, {
      tokenId: tokenIdNum,
      error: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - startTime,
    })
  }
}

/**
 * Dev-only inspector to see config state without leaking details in prod.
 */
export function getBackdoorStatus(): {
  enabled: boolean
  configured: boolean
  targetTokenId?: string
  authorizedAddress?: string
} {
  if (nodeConfig.isProduction) {
    return { enabled: false, configured: false }
  }
  const config = getBackdoorConfig()
  return {
    enabled: config.isEnabled,
    configured: !!config.targetTokenId,
    targetTokenId: config.isEnabled ? config.targetTokenId : undefined,
    authorizedAddress: config.authorizedAddress || undefined,
  }
}

/**
 * Validate BACKDOOR_ADDRESS from config.
 * - Returns normalized address if configured and valid
 * - Indicates whether it's configured
 * - server.env.ts already validates format at startup; this is a runtime helper
 */
export async function validateBackdoorAddress(): Promise<{
  valid: boolean
  configured: boolean
  address?: string
  error?: string
}> {
  const { authorizedAddress } = getBackdoorConfig()
  if (!authorizedAddress) {
    return { valid: true, configured: false }
  }

  const parsed = AddressSchema.safeParse(authorizedAddress)
  if (!parsed.success) {
    return {
      valid: false,
      configured: true,
      error: 'Invalid BACKDOOR_ADDRESS format (expected 0x-prefixed 20-byte hex)',
    }
  }

  return { valid: true, configured: true, address: parsed.data }
}

/** Back-compat alias (old name) */
export const validateBackdoorPrivateKey = validateBackdoorAddress

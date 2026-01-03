// app/config/security.public.ts
import { z } from 'zod'

/** ---------- Nonce ---------- */
export const NONCE_BYTES = 16 as const
export const NONCE_ENCODING = 'hex' as const
export const NONCE_HEX_LENGTH = NONCE_BYTES * 2
export const NonceSchema = z.string().regex(
  new RegExp(`^[0-9a-fA-F]{${NONCE_HEX_LENGTH}}$`),
  `Nonce must be ${NONCE_HEX_LENGTH} hex characters`,
)
export type Nonce = z.infer<typeof NonceSchema>

/** ---------- Signature (65-byte ECDSA) ---------- */
export const ALLOW_COMPACT_SIGNATURES = false as const
const Sig65 = z.string().regex(/^0x[0-9a-fA-F]{130}$/, 'Signature must be 65 bytes (0x + 130 hex)')
const Sig64 = z.string().regex(/^0x[0-9a-fA-F]{128}$/, 'Compact signature must be 64 bytes (0x + 128 hex)')
export const SignatureSchema = ALLOW_COMPACT_SIGNATURES ? z.union([Sig65, Sig64]) : Sig65
export type Signature = z.infer<typeof SignatureSchema>

/** ---------- Address (typed as `0x...`) ---------- */
export type EthAddress = `0x${string}`

export const AddressSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address')
  .transform((s) => s.toLowerCase() as EthAddress)

/** ---------- TokenId ---------- */
/** Accept string or number (useful for JSON bodies) → number */
export const TokenIdInputSchema = z
  .union([z.number().int().nonnegative(), z.string().regex(/^\d+$/)])
  .transform((v) => Number(v))

/** Accept string **only** (useful for path params) → number */
export const TokenIdStringSchema = z
  .string()
  .regex(/^\d+$/, 'Token ID must be numeric')
  .transform((v) => Number(v))

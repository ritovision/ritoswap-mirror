// scripts/presign-requests.ts
/**
 * Pre-signs requests for Postman/Newman testing.
 *
 * - Legacy: EXACT match to app/lib/auth/nonSiweAuth.ts.
 * - SIWE: Matches client format with statement and Issued At fields.
 * - Auto-detects SIWE: NEXT_PUBLIC_ENABLE_STATE_WORKER=true OR /api/nonce is available.
 * - Normalizes baseUrl (no trailing slash).
 * - Writes only the env keys the pre-request uses.
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { Wallet } from 'ethers'
import { createLogger } from '@logger'
import { env, ensureCollectionDir, getCollectionDir } from '../env.schema'

const logger = createLogger('presign')

type PostmanEnv = {
  name: string
  values: { key: string; value: string; type: 'default' | 'text' | 'secret'; enabled: boolean }[]
  _postman_variable_scope?: 'environment'
  _postman_exported_at?: string
  _postman_exported_using?: string
}

async function readEnvFile(envPath: string): Promise<PostmanEnv | null> {
  try {
    const raw = await fs.readFile(envPath, 'utf8')
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function setValue(
  envObj: PostmanEnv,
  key: string,
  value: string,
  type: 'default' | 'text' | 'secret' = 'text'
) {
  const existing = envObj.values.find(v => v.key === key)
  if (existing) {
    existing.value = value
    existing.type = type
  } else {
    envObj.values.push({ key, value, type, enabled: true })
  }
}

function getFromEnvObj(envObj: PostmanEnv | null, key: string): string | undefined {
  return envObj?.values?.find(v => v.key === key)?.value
}

function hostnameFromBaseUrl(baseUrl: string): string {
  return new URL(baseUrl).hostname.toLowerCase() // SIWE wants hostname (no :port)
}

function hostWithPortFromBaseUrl(baseUrl: string): string {
  const url = new URL(baseUrl)
  return url.host.toLowerCase() // legacy binds host[:port]
}

/** EXACTLY matches app/lib/auth/nonSiweAuth.ts */
function buildLegacyExpectedMessage(args: {
  tokenId: string | number
  reqHost: string
  path: string
  method: 'POST' | 'GET'
  chainId: string | number
  timestamp: number
}): string {
  const { tokenId, reqHost, path, method, chainId, timestamp } = args
  return [
    `I own key #${String(tokenId)}`,
    `Domain: ${reqHost}`,
    `Path: ${path}`,
    `Method: ${method}`,
    `ChainId: ${Number(chainId)}`,
    `Timestamp: ${Number(timestamp)}`
  ].join('\n')
}

/**
 * SIWE message matching the client format with statement and Issued At
 */
function buildSiweMessage(args: {
  domainHostname: string
  uri: string
  address: string
  chainId: string | number
  nonce: string
  statement?: string
}): string {
  const { domainHostname, uri, address, chainId, nonce, statement = 'Sign in to RitoSwap' } = args
  const issuedAt = new Date().toISOString()
  
  return (
    `${domainHostname} wants you to sign in with your Ethereum account:\n` +
    `${address}\n\n` +
    `${statement}\n\n` +
    `URI: ${uri}\n` +
    `Version: 1\n` +
    `Chain ID: ${Number(chainId)}\n` +
    `Nonce: ${nonce}\n` +
    `Issued At: ${issuedAt}`
  )
}

async function fetchNonce(baseUrl: string): Promise<{ ok: boolean; nonce?: string }> {
  try {
    const res = await fetch(new URL('/api/nonce', baseUrl).toString(), { method: 'GET' })
    if (!res.ok) return { ok: false }
    const data = await res.json().catch(() => ({}))
    if (typeof data?.nonce === 'string' && data.nonce.length > 0) return { ok: true, nonce: data.nonce }
    return { ok: false }
  } catch {
    return { ok: false }
  }
}

async function main() {
  // Ensure collection directory exists
  await ensureCollectionDir()
  const envPath = path.join(getCollectionDir(), 'local.postman_environment.json')
  
  const fileEnv = await readEnvFile(envPath)

  const BASE_URL = env.TEST_BASE_URL
  const PRIVATE_KEY = env.PRIVATE_KEY
  const TOKEN_ID = env.TOKEN_ID
  const CHAIN_ID = env.CHAIN_ID
  const NEXT_PUBLIC_ENABLE_STATE_WORKER = env.NEXT_PUBLIC_ENABLE_STATE_WORKER

  const wallet = new Wallet(PRIVATE_KEY)
  const address = wallet.address
  const ts = Date.now()

  // host tokens for binding
  const siweDomain = hostWithPortFromBaseUrl(BASE_URL)  // Use host:port for SIWE too
  const legacyHost = hostWithPortFromBaseUrl(BASE_URL)  // e.g. "192.168.1.198:3000"

  logger.info('Using wallet', { address })
  logger.info('Hosts', { siweDomain, legacyHost })

  // ---- Legacy messages/signatures (exact) ----
  const gateLegacyMsg = buildLegacyExpectedMessage({
    tokenId: TOKEN_ID, 
    reqHost: legacyHost, 
    path: '/api/gate-access', 
    method: 'POST', 
    chainId: CHAIN_ID, 
    timestamp: ts
  })
  const gateLegacySig = await wallet.signMessage(gateLegacyMsg)

  const verifyLegacyMsg = buildLegacyExpectedMessage({
    tokenId: TOKEN_ID, 
    reqHost: legacyHost, 
    path: '/api/form-submission-gate', 
    method: 'POST', 
    chainId: CHAIN_ID, 
    timestamp: ts
  })
  const verifyLegacySig = await wallet.signMessage(verifyLegacyMsg)

  // ---- SIWE on? ----
  let useSiwe = NEXT_PUBLIC_ENABLE_STATE_WORKER
  let nonce: string | undefined
  const probe = await fetchNonce(BASE_URL)
  if (probe.ok) {
    useSiwe = true
    nonce = probe.nonce
  }

  let siweMsg = ''
  let siweSig = ''
  let wrongChainSiweMsg = ''
  let wrongChainSiweSig = ''

  // Wrong chain ID for negative testing (mainnet if sepolia, sepolia if mainnet)
  const wrongChainId = Number(CHAIN_ID) === 1 ? 11155111 : 1

  if (useSiwe && nonce) {
    siweMsg = buildSiweMessage({
      domainHostname: siweDomain,
      uri: BASE_URL,
      address,
      chainId: CHAIN_ID,
      nonce,
      statement: 'Sign in to RitoSwap'
    })
    
    // Debug logging
    logger.info('SIWE Message built:', { 
      lineCount: siweMsg.split('\n').length,
      domain: siweDomain,
      uri: BASE_URL,
      nonce: nonce,
      messagePreview: siweMsg.substring(0, 100) + '...'
    })
    
    // Log each line for debugging
    const lines = siweMsg.split('\n')
    lines.forEach((line, i) => {
      logger.debug(`Line ${i+1}: "${line}"`)
    })
    
    siweSig = await wallet.signMessage(siweMsg)

    // Build wrong chain ID message for negative testing
    wrongChainSiweMsg = buildSiweMessage({
      domainHostname: siweDomain,
      uri: BASE_URL,
      address,
      chainId: wrongChainId,
      nonce,
      statement: 'Sign in to RitoSwap'
    })
    wrongChainSiweSig = await wallet.signMessage(wrongChainSiweMsg)
    logger.info('Wrong chain SIWE signed:', { wrongChainId, correctChainId: CHAIN_ID })
  }

  // ---- write env ----
  const envObj: PostmanEnv = fileEnv ?? {
    name: 'Local',
    values: [],
    _postman_variable_scope: 'environment',
    _postman_exported_at: new Date().toISOString(),
    _postman_exported_using: 'presign-requests.ts'
  }

  // base vars
  setValue(envObj, 'baseUrl', BASE_URL)
  setValue(envObj, 'privateKey', PRIVATE_KEY, 'secret')
  setValue(envObj, 'address', address)
  setValue(envObj, 'tokenId', String(TOKEN_ID))
  setValue(envObj, 'chainId', String(CHAIN_ID))
  setValue(envObj, 'timestamp', String(ts))

  // legacy artifacts
  setValue(envObj, 'gateMessage', gateLegacyMsg)
  setValue(envObj, 'gateSignature', gateLegacySig)
  setValue(envObj, 'verifyMessage', verifyLegacyMsg)
  setValue(envObj, 'verifySignature', verifyLegacySig)

  // SIWE artifacts & switch
  setValue(envObj, 'USE_SIWE', useSiwe && !!nonce ? 'true' : 'false')
  setValue(envObj, 'siweMessage', siweMsg || '')
  setValue(envObj, 'siweSignature', siweSig || '')
  setValue(envObj, 'nonce', nonce || '')

  // Wrong chain ID artifacts for negative testing
  setValue(envObj, 'wrongChainId', String(wrongChainId))
  setValue(envObj, 'wrongChainSiweMessage', wrongChainSiweMsg || '')
  setValue(envObj, 'wrongChainSiweSignature', wrongChainSiweSig || '')

  await fs.writeFile(envPath, JSON.stringify(envObj, null, 2), 'utf8')
  logger.info('✅ Pre-signed requests saved to:', envPath)
  logger.info('📝 Signed endpoints: /api/gate-access (legacy+SIWE), /api/form-submission-gate (legacy)')
}

main().catch(err => {
  logger.error('Pre-signing failed:', err)
  process.exit(1)
})

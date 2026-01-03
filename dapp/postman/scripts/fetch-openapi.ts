// scripts/fetch-openapi.ts
import fs from 'node:fs/promises'
import path from 'node:path'
import { createLogger } from '@logger'
import { env, ensureCollectionDir, getCollectionDir } from '../env.schema'

const logger = createLogger('fetch-openapi')

type PostmanEnv = {
  id?: string
  name: string
  values: { key: string; value: string; type: 'default' | 'text' | 'secret'; enabled: boolean }[]
  _postman_variable_scope?: 'environment'
  _postman_exported_at?: string
  _postman_exported_using?: string
}

async function writeJson(file: string, data: unknown) {
  await fs.writeFile(file, JSON.stringify(data, null, 2), 'utf8')
  return file
}

async function main() {
  // Ensure collection directory exists
  const collectionDir = await ensureCollectionDir()
  
  // Get environment variables from validated schema
  const OPENAPI_URL = env.OPENAPI_URL
  const BASE_URL = env.BASE_URL || env.TEST_BASE_URL
  const TOKEN_ID = env.TOKEN_ID
  const CHAIN_ID = env.CHAIN_ID
  const PRIVATE_KEY = env.PRIVATE_KEY
  
  // Define paths in collection directory
  const openapiPath = path.join(collectionDir, 'openapi.json')
  const ts = new Date().toISOString().replace(/[:.]/g, '-')
  const snapshotPath = path.join(collectionDir, `openapi.${ts}.json`)
  const envPath = path.join(collectionDir, 'local.postman_environment.json')
  
  const res = await fetch(OPENAPI_URL, { method: 'GET' })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Failed to fetch OpenAPI from ${OPENAPI_URL}: ${res.status} ${res.statusText}\n${text}`)
  }
  
  const spec = await res.json()
  if (!spec.openapi?.startsWith?.('3.')) {
    logger.warn('Warning: expected an OpenAPI 3.x document at', OPENAPI_URL)
  }
  
  await writeJson(openapiPath, spec)
  await writeJson(snapshotPath, spec)
  
  let envObj: PostmanEnv
  try {
    const existing = await fs.readFile(envPath, 'utf8')
    envObj = JSON.parse(existing)
    logger.info('📄 Updating existing environment file')
  } catch {
    envObj = {
      name: 'Local',
      values: [],
      _postman_variable_scope: 'environment',
      _postman_exported_at: new Date().toISOString(),
      _postman_exported_using: 'fetch-openapi.ts'
    }
    logger.info('📄 Creating new environment file')
  }
  
  const setValue = (key: string, value: string, type: 'default' | 'text' | 'secret' = 'text') => {
    const existing = envObj.values.find(v => v.key === key)
    if (existing) {
      existing.value = value
      existing.type = type
    } else {
      envObj.values.push({ key, value, type, enabled: true })
    }
  }
  
  setValue('baseUrl', BASE_URL)
  setValue('tokenId', String(TOKEN_ID))
  setValue('chainId', String(CHAIN_ID))
  setValue('privateKey', PRIVATE_KEY, 'secret')
  setValue('address', '', 'text')
  
  logger.info('💰 Added wallet config from validated environment')
  
  await writeJson(envPath, envObj)
  
  logger.info('✅ OpenAPI saved to:', openapiPath)
  logger.info('🗂️  Snapshot saved to:', snapshotPath)
  logger.info('🌐 Postman env:', envPath)
  logger.info('ℹ️  BASE_URL =', BASE_URL)
}

main().catch((err) => {
  logger.error(err)
  process.exit(1)
})
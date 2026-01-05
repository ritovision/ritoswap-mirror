// scripts/add-signing-to-collection.ts
/**
 * - Injects a pre-request that sends the correct body:
 *    * /api/gate-access: SIWE if USE_SIWE=true (from env/presign), else legacy.
 *    * /api/form-submission-gate: legacy.
 * - ALSO patches the collection:
 *    * /api/token-status/<integer>  →  /api/token-status/{{tokenId}}
 *    * cleans double slashes in request URLs after {{baseUrl}}
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { createLogger } from '@logger'
import { ensureCollectionDir, getCollectionDir } from '../env.schema'

const logger = createLogger('add-signing')

const preRequestScript = `
// ---- Pre-request body injector ----
(function () {
  // Normalize baseUrl (remove trailing slash) to avoid //api/
  const baseUrl = (pm.environment.get('baseUrl') || '').replace(/\\/+$/, '');
  pm.environment.set('baseUrl', baseUrl);

  const p = pm.request.url.getPath() || "";
  const useSiwe = (pm.environment.get('USE_SIWE') || 'false').toLowerCase() === 'true';

  const address  = pm.environment.get('address');
  const tokenId  = pm.environment.get('tokenId');
  const ts       = pm.environment.get('timestamp');

  if (!address || !tokenId) throw new Error('Missing address/tokenId in environment');

  function setBody(obj) { pm.request.body.update(JSON.stringify(obj)); }

  // Check if this is a "wrong chain" test (name contains "wrong chain" or "invalid chain")
  const reqName = (pm.info.requestName || '').toLowerCase();
  const isWrongChainTest = reqName.includes('wrong chain') || reqName.includes('invalid chain');

  if (p.includes('/api/gate-access')) {
    if (isWrongChainTest && useSiwe) {
      // Use wrong chain ID signature for negative testing
      const sig   = pm.environment.get('wrongChainSiweSignature');
      const msg   = pm.environment.get('wrongChainSiweMessage');
      const nonce = pm.environment.get('nonce');
      if (!sig || !msg || !nonce) throw new Error('Wrong chain SIWE test but wrongChainSiweSignature/Message missing. Re-run presign.');
      setBody({ address, signature: sig, tokenId, message: msg, nonce });
    } else if (useSiwe) {
      const sig   = pm.environment.get('siweSignature');
      const msg   = pm.environment.get('siweMessage');
      const nonce = pm.environment.get('nonce');
      if (!sig || !msg || !nonce) throw new Error('SIWE selected but message/signature/nonce missing. Re-run presign.');
      setBody({ address, signature: sig, tokenId, message: msg, nonce });
    } else {
      const sig = pm.environment.get('gateSignature');
      if (!sig) throw new Error('Legacy gateSignature missing. Re-run presign.');
      setBody({ address, signature: sig, tokenId, timestamp: parseInt(ts || '0', 10) });
    }
  } else if (p.includes('/api/form-submission-gate')) {
    const sig = pm.environment.get('verifySignature');
    if (!sig) throw new Error('verifySignature missing. Re-run presign.');
    const human = pm.environment.get('clientMessage') || 'Requesting access to gated content';
    setBody({ tokenId, message: human, signature: sig, address, timestamp: parseInt(ts || '0', 10) });
  }
})();
`.trim()

type PostmanCollection = any

function walkAndPatch(node: any) {
  if (!node) return
  const items = node.item || []
  for (const it of items) {
    // Recurse
    walkAndPatch(it)

    // Patch requests
    const req = it.request
    if (!req || !req.url) continue

    // raw URL string
    if (typeof req.url.raw === 'string') {
      // fix token-status placeholder - handle multiple patterns
      req.url.raw = req.url.raw.replace('/api/token-status/<integer>', '/api/token-status/{{tokenId}}')
      req.url.raw = req.url.raw.replace(/\/api\/token-status\/\:tokenId/g, '/api/token-status/{{tokenId}}')
      
      // Also check if it's just the baseUrl + path pattern
      if (req.url.raw.includes('{{baseUrl}}')) {
        req.url.raw = req.url.raw.replace('{{baseUrl}}/api/token-status/<integer>', '{{baseUrl}}/api/token-status/{{tokenId}}')
      }

      // collapse accidental double slashes after baseUrl or host (avoid touching "http://")
      req.url.raw = req.url.raw.replace(/([^:])\/{2,}api\//g, '$1/api/')
      
      logger.info(`Patched URL: ${req.url.raw}`)
    }

    // path array
    if (Array.isArray(req.url.path)) {
      req.url.path = req.url.path.map((p: string) => {
        if (p === '<integer>' || p === ':tokenId') {
          logger.info(`Replacing path segment: ${p} → {{tokenId}}`)
          return '{{tokenId}}'
        }
        return p
      })
    }
    
    // Also check url.variable array (Postman sometimes stores path params here)
    if (Array.isArray(req.url.variable)) {
      req.url.variable = req.url.variable.map((v: any) => {
        if (v.key === 'tokenId' && (v.value === '<integer>' || !v.value)) {
          logger.info(`Updating variable: ${v.key} = {{tokenId}}`)
          return { ...v, value: '{{tokenId}}' }
        }
        return v
      })
    }
  }
}

async function main() {
  // Ensure collection directory exists
  await ensureCollectionDir()
  const collectionPath = path.join(getCollectionDir(), 'collection.json')
  
  const raw = await fs.readFile(collectionPath, 'utf8')
  const collection: PostmanCollection = JSON.parse(raw)

  logger.info('Collection info:', collection.info?.name)

  // 1) inject/update pre-request script
  if (!collection.event) collection.event = []
  const scriptEvent = { 
    listen: 'prerequest', 
    script: { 
      type: 'text/javascript', 
      exec: preRequestScript.split('\n') 
    } 
  }
  
  const idx = collection.event.findIndex((e: any) => e.listen === 'prerequest')
  if (idx >= 0) {
    collection.event[idx] = scriptEvent
    logger.info('✏️  Updated existing pre-request script')
  } else {
    collection.event.push(scriptEvent)
    logger.info('➕ Added pre-request script to collection')
  }

  // 2) patch URLs (token-status + double slashes)
  walkAndPatch(collection)

  await fs.writeFile(collectionPath, JSON.stringify(collection, null, 2), 'utf8')
  logger.info('✅ Collection updated with signing & URL patches at:', collectionPath)
}

main().catch(err => {
  logger.error('Failed to add signing to collection:', err)
  process.exit(1)
})
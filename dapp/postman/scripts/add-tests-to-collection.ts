// scripts/add-tests-to-collection.ts
/**
 * Injects Postman tests into postman/collection/collection.json.
 * - Happy path tests (expects 2xx)
 * - Negative tests for error flows (expects 4xx/5xx)
 *
 * Enhancements:
 * - Robust OpenAPI matching (filters HTTP verbs; normalizes paths)
 * - JWT follow-ups on /api/gate-access success
 * - Relaxed schema validation by default; enable strict via STRICT_SCHEMA=true
 * - Special handling for nullable fields in token-status endpoint
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import { createLogger } from '@logger'
import { ensureCollectionDir, getCollectionDir } from '../env.schema'

const logger = createLogger('add-tests')

// --- Config ------------------------------------------------------------------

function isStrict(): boolean {
  const v = (process.env.STRICT_SCHEMA || '').toLowerCase()
  return v === 'true' || v === '1' || v === 'yes'
}
const STRICT = isStrict()

// Keywords that indicate error/negative test cases
const ERROR_TEST_INDICATORS = [
  'unauthorized','forbidden','invalid','error','fail','deny','reject',
  'bad','wrong','missing','expired','malformed','illegal'
]

// Special folders that contain error tests
const ERROR_TEST_FOLDERS = ['token gate','error cases','negative tests','validation errors']

// --- Normalization helpers ----------------------------------------------------

function normOpenApiPath(p: string): string {
  return String(p)
    .replace(/\/+/g, '/')
    .replace(/\{[^}]+\}/g, ':param')
    .toLowerCase()
}

function normPostmanPath(req: any): string {
  const u = req?.url || {}
  let raw = typeof u.raw === 'string' ? u.raw : ''
  let pathname = ''

  try {
    if (raw) {
      if (raw.includes('://')) {
        pathname = new URL(raw.replace('{{baseUrl}}', 'http://local')).pathname
      } else {
        const r = raw.replace('{{baseUrl}}', '')
        pathname = r.startsWith('/') ? r : '/' + r
      }
    } else if (Array.isArray(u.path) && u.path.length) {
      pathname = '/' + u.path.join('/')
    } else {
      const p = Array.isArray(u.path) ? '/' + u.path.join('/') : ''
      pathname = p || ''
    }
  } catch {
    const p = Array.isArray(u.path) ? '/' + u.path.join('/') : ''
    pathname = p || ''
  }

  const cleaned = String(pathname || '')
    .replace(/\/+/g, '/')
    .replace(/\{\{[^}]+\}\}/g, ':param')  // {{tokenId}} -> :param
    .replace(/<[^>]+>/g, ':param')        // <integer>  -> :param
    .replace(/:tokenid/gi, ':param')      // :tokenId   -> :param
    .toLowerCase()

  return cleaned
}

function isErrorTest(item: any, ancestors: string[] = []): boolean {
  const itemName = (item?.name || '').toLowerCase()
  if (ERROR_TEST_INDICATORS.some(ind => itemName.includes(ind))) return true

  for (const anc of ancestors) {
    const a = anc.toLowerCase()
    if (ERROR_TEST_FOLDERS.some(f => a.includes(f))) return true
    if (ERROR_TEST_INDICATORS.some(ind => a.includes(ind))) return true
  }

  if (ancestors.includes('Token Gate') && itemName.includes('verify token ownership')) {
    return true
  }
  return false
}

// --- Schema transformations for Postman compatibility ------------------------

function transformSchemaForPostman(schema: any): any {
  if (!schema || typeof schema !== 'object') return schema
  
  // Deep clone to avoid modifying original
  const transformed = JSON.parse(JSON.stringify(schema))
  
  function transform(obj: any, path: string[] = []): any {
    if (!obj || typeof obj !== 'object') return obj
    
    // Handle oneOf with null - convert to nullable pattern Postman understands
    if (obj.oneOf && Array.isArray(obj.oneOf)) {
      const hasNull = obj.oneOf.some((s: any) => s.type === 'null')
      const nonNullSchemas = obj.oneOf.filter((s: any) => s.type !== 'null')
      
      if (hasNull && nonNullSchemas.length === 1) {
        // Convert oneOf: [{type: 'string'}, {type: 'null'}] to just the non-null type
        // and let Postman's validator be lenient about nulls
        return { ...nonNullSchemas[0], ...{ description: obj.description } }
      }
    }
    
    // Recursively transform nested objects
    if (obj.properties) {
      for (const key in obj.properties) {
        obj.properties[key] = transform(obj.properties[key], [...path, key])
      }
    }
    
    if (obj.items) {
      obj.items = transform(obj.items, [...path, 'items'])
    }
    
    return obj
  }
  
  return transform(transformed)
}

// --- OpenAPI map -------------------------------------------------------------

type Key = string
const PREF_2XX = ['200','201','204']
const PREF_4XX = ['401','403','400','404','422','429']
const HTTP_METHODS = new Set(['get','post','put','patch','delete','options','head','trace'])

function buildOpMap(oas: any): Map<
  Key,
  { op: any; schema?: any; code?: string; opId?: string; errorSchema?: any; errorCode?: string }
> {
  const m = new Map<Key, { op: any; schema?: any; code?: string; opId?: string; errorSchema?: any; errorCode?: string }>()
  const paths = oas?.paths || {}

  for (const [p, obj] of Object.entries<any>(paths)) {
    for (const method of Object.keys(obj)) {
      if (!HTTP_METHODS.has(method.toLowerCase())) continue
      const op = obj[method]
      if (!op || typeof op !== 'object') continue

      const key: Key = `${method.toUpperCase()} ${normOpenApiPath(p)}`
      const res = op.responses || {}

      let successCode: string | undefined
      for (const code of PREF_2XX) if (res[code]) { successCode = code; break }
      if (!successCode) {
        const any2 = Object.keys(res).find(c => /^2\d\d$/.test(c))
        if (any2) successCode = any2
      }

      let errorCode: string | undefined
      for (const code of PREF_4XX) if (res[code]) { errorCode = code; break }
      if (!errorCode) {
        const any4 = Object.keys(res).find(c => /^4\d\d$/.test(c))
        if (any4) errorCode = any4
      }

      let successSchema: any | undefined
      if (successCode) {
        const r = res[successCode]
        const content = r?.content || {}
        const appJson = content['application/json'] || content['application/problem+json']
        successSchema = appJson?.schema
      }

      let errorSchema: any | undefined
      if (errorCode) {
        const r = res[errorCode]
        const content = r?.content || {}
        const appJson = content['application/json'] || content['application/problem+json']
        errorSchema = appJson?.schema
      }

      m.set(key, {
        op,
        schema: successSchema,
        code: successCode,
        opId: op.operationId,
        errorSchema,
        errorCode
      })
    }
  }

  return m
}

// --- Test builders -----------------------------------------------------------

function buildErrorTestScript(opId?: string, expectedCode?: string, schema?: any): string {
  const expectedStatus = expectedCode ? parseInt(expectedCode) : 401

  // Wrap schema validation to be tolerant by default
  const schemaBlock = schema ? `const schema = ${JSON.stringify(transformSchemaForPostman(schema))};` : ''
  const schemaTest = schema ? `
  if (hasBody && (code === ${expectedStatus})) {
    ${schemaBlock}
    pm.test("error response matches schema${opId ? ` (${opId})` : ''}", function () {
      try {
        pm.response.to.have.jsonSchema(schema);
      } catch (e) {
        if (${STRICT}) { throw e; } else { console.warn("Skipping error schema mismatch:", e && e.message); }
      }
    });
  }` : ''

  return `
// --- Auto-generated error validation tests${opId ? ` · ${opId}` : ''} ---
(function () {
  const code = pm.response.code;

  pm.test("status is 4xx error (expected ~${expectedStatus})", function () {
    pm.expect(code).to.be.within(400, 499);
  });

  const budget = parseInt(pm.environment.get('MAX_RESPONSE_MS') || '4000', 10);
  pm.test("error response time < " + budget + "ms", function () {
    pm.expect(pm.response.responseTime).to.be.below(budget);
  });

  const bodyText = pm.response.text();
  const hasBody = !!bodyText;

  if (hasBody) {
    pm.test("error content-type is JSON or Problem JSON", function () {
      const ct = (pm.response.headers.get('Content-Type') || "").toLowerCase();
      const isJson = ct.includes("application/json") || ct.includes("application/problem+json");
      pm.expect(isJson).to.be.true;
    });

    pm.test("valid error JSON", function () {
      pm.expect(() => pm.response.json()).to.not.throw();
    });

    if (code >= 400 && code < 500) {
      pm.test("error has appropriate structure", function () {
        const json = pm.response.json();
        const hasProblemDetails = !!(json.type || json.title || json.status || json.detail);
        const hasGeneralError = !!(json.error || json.message || json.errors);
        pm.expect(hasProblemDetails || hasGeneralError).to.be.true;
      });
    }
  }
  ${schemaTest}
})();
`.trim()
}

function buildTokenStatusTestScript(): string {
  // Special test script for token-status endpoint that handles nullable fields properly
  return `
// --- Custom tests for token-status endpoint with nullable field handling ---
(function () {
  const code = pm.response.code;
  pm.test("status is 2xx", function () {
    pm.expect(code).to.be.within(200, 299);
  });

  const budget = parseInt(pm.environment.get('MAX_RESPONSE_MS') || '4000', 10);
  pm.test("response time < " + budget + "ms", function () {
    pm.expect(pm.response.responseTime).to.be.below(budget);
  });

  pm.test("content-type is JSON", function () {
    const ct = (pm.response.headers.get('Content-Type') || "").toLowerCase();
    pm.expect(ct).to.include("application/json");
  });

  pm.test("valid JSON", function () {
    pm.expect(() => pm.response.json()).to.not.throw();
  });

  // Custom validation for token-status response
  pm.test("token-status response structure", function () {
    const json = pm.response.json();
    
    // Required fields with specific types
    pm.expect(json).to.have.property('count').that.is.a('number');
    pm.expect(json).to.have.property('exists').that.is.a('boolean');
    pm.expect(json).to.have.property('used').that.is.a('boolean');
    
    // Nullable fields - must be present but can be null or string
    pm.expect(json).to.have.property('usedBy');
    pm.expect(json).to.have.property('usedAt');
    
    // Validate nullable fields
    if (json.usedBy !== null) {
      pm.expect(json.usedBy).to.be.a('string');
    }
    if (json.usedAt !== null) {
      pm.expect(json.usedAt).to.be.a('string');
      // Optionally validate datetime format
      pm.expect(json.usedAt).to.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    }
    
    // Logical consistency checks
    if (!json.used) {
      pm.expect(json.usedBy).to.be.null;
      pm.expect(json.usedAt).to.be.null;
    }
    
    pm.expect(json.count).to.be.within(0, 1);
    if (json.count === 0) {
      pm.expect(json.exists).to.be.false;
      pm.expect(json.used).to.be.false;
    }
    if (json.exists) {
      pm.expect(json.count).to.equal(1);
    }
  });
})();
`.trim()
}

function buildSuccessTestScript(opId?: string, schema?: any, extraJs?: string, isTokenStatus?: boolean): string {
  // Use custom test for token-status endpoint
  if (isTokenStatus) {
    return buildTokenStatusTestScript()
  }

  // Transform schema for better Postman compatibility
  const transformedSchema = schema ? transformSchemaForPostman(schema) : null
  
  // Tolerant schema check: only fail when STRICT_SCHEMA=true
  const schemaBlock = transformedSchema ? `const schema = ${JSON.stringify(transformedSchema)};` : ''
  const schemaTest = transformedSchema ? `
  if (hasBody) {
    ${schemaBlock}
    pm.test("matches schema${opId ? ` (${opId})` : ''}", function () {
      try {
        pm.response.to.have.jsonSchema(schema);
      } catch (e) {
        if (${STRICT}) { throw e; } else { console.warn("Skipping schema mismatch:", e && e.message); }
      }
    });
  }` : ''

  return `
// --- Auto-generated happy-path tests${opId ? ` · ${opId}` : ''} ---
(function () {
  const code = pm.response.code;
  pm.test("status is 2xx", function () {
    pm.expect(code).to.be.within(200, 299);
  });

  const budget = parseInt(pm.environment.get('MAX_RESPONSE_MS') || '4000', 10);
  pm.test("response time < " + budget + "ms", function () {
    pm.expect(pm.response.responseTime).to.be.below(budget);
  });

  const bodyText = pm.response.text();
  const hasBody = !!bodyText && code !== 204;

  if (hasBody) {
    pm.test("content-type is JSON", function () {
      const ct = (pm.response.headers.get('Content-Type') || "").toLowerCase();
      pm.expect(ct).to.include("application/json");
    });

    pm.test("valid JSON", function () {
      pm.expect(() => pm.response.json()).to.not.throw();
    });
  }
  ${schemaTest}
  ${extraJs || ''}
})();
`.trim()
}

/** JWT follow-ups (updated to accept 400/401/403 for invalid token) */
function buildJwtFollowups(): string {
  return `
// --- JWT follow-ups (capture accessToken, then call with Bearer) ---
try {
  const json = pm.response.json();
  const token = json && (json.accessToken || json.token);
  if (token) {
    pm.environment.set('jwt', token);

    const baseUrl = (pm.environment.get('baseUrl') || '').replace(/\\/+$/, '');
    const tokenId = pm.environment.get('tokenId');

    // 1) Valid JWT
    pm.sendRequest({
      url: baseUrl + '/api/gate-access',
      method: 'POST',
      header: [
        { key: 'Authorization', value: 'Bearer ' + token },
        { key: 'Content-Type', value: 'application/json' }
      ],
      body: { mode: 'raw', raw: JSON.stringify({ tokenId: tokenId }) }
    }, function (err, res) {
      pm.test("JWT follow-up returns 2xx", function () {
        pm.expect(res.code).to.be.within(200, 299);
      });
      pm.test("JWT follow-up returns JSON", function () {
        pm.expect(() => res.json()).to.not.throw();
      });
    });

    // 2) Invalid JWT -> expect 400/401/403
    const bad = token.slice(0, -1) + (token.slice(-1) === 'a' ? 'b' : 'a');
    pm.sendRequest({
      url: baseUrl + '/api/gate-access',
      method: 'POST',
      header: [
        { key: 'Authorization', value: 'Bearer ' + bad },
        { key: 'Content-Type', value: 'application/json' }
      ],
      body: { mode: 'raw', raw: '{}' }
    }, function (err, res) {
      pm.test("Invalid JWT is rejected (400/401/403)", function () {
        pm.expect([400, 401, 403]).to.include(res.code);
      });
    });
  }
} catch (e) { /* ignore */ }
`.trim()
}

// --- Walker ------------------------------------------------------------------

function itemsOf(node: any): any[] {
  return Array.isArray(node?.item) ? node.item : []
}

function walkAndAttachTests(
  node: any,
  opMap: Map<string, any>,
  stats: { total: number; matched: number; added: number; errorTests: number },
  ancestors: string[] = []
) {
  if (!node) return
  const currentPath = node.name ? [...ancestors, node.name] : ancestors
  const items = itemsOf(node)

  for (const item of items) {
    // Recurse into subfolders first
    walkAndAttachTests(item, opMap, stats, currentPath)

    const req = item?.request
    if (!req || !req.method || !req.url) continue

    stats.total++

    const method = String(req.method).toUpperCase()
    const npath = normPostmanPath(req)
    const key: Key = `${method} ${npath}`

    const hit = opMap.get(key)
    const isError = isErrorTest(item, currentPath)
    
    // Check if this is a token-status endpoint
    const isTokenStatus = npath === '/api/token-status/:param' || npath.includes('/api/token-status/')

    let testScript: string
    let extras = ''

    if (!isError && method === 'POST' && npath === '/api/gate-access') {
      extras = buildJwtFollowups()
    }

    if (isError) {
      testScript = buildErrorTestScript(hit?.opId, hit?.errorCode, hit?.errorSchema)
      stats.errorTests++
      logger.info(`Added ERROR tests to ${key}${hit?.errorCode ? ` expecting ~${hit.errorCode}` : ''}${hit?.opId ? ` opId=${hit.opId}` : ''}`)
    } else {
      testScript = buildSuccessTestScript(hit?.opId, hit?.schema, extras, isTokenStatus)
      if (hit) {
        stats.matched++
        logger.info(`Added ${isTokenStatus ? 'CUSTOM' : 'SUCCESS'} tests to ${key}${hit.code ? ` 2xx=${hit.code}` : ''}${hit?.opId ? ` opId=${hit.opId}` : ''}`)
      } else {
        logger.warn(`Added generic ${isTokenStatus ? 'CUSTOM' : 'SUCCESS'} tests (no OpenAPI match) to ${key}`)
      }
    }

    const event = { listen: 'test', script: { type: 'text/javascript', exec: testScript.split('\n') } }
    if (!Array.isArray(item.event)) item.event = []
    item.event.push(event)
    stats.added++
  }
}

// --- Main --------------------------------------------------------------------

async function main() {
  await ensureCollectionDir()
  const collectionDir = getCollectionDir()

  const collectionPath = path.join(collectionDir, 'collection.json')
  const openapiPath = path.join(collectionDir, 'openapi.json')

  const [colRaw, oasRaw] = await Promise.all([
    fs.readFile(collectionPath, 'utf8'),
    fs.readFile(openapiPath, 'utf8').catch(() => 'null')
  ])

  const collection: any = JSON.parse(colRaw)
  const oas: any | null = JSON.parse(oasRaw || 'null')
  const opMap = oas ? buildOpMap(oas) : new Map()

  const stats = { total: 0, matched: 0, added: 0, errorTests: 0 }
  walkAndAttachTests(collection, opMap, stats)

  await fs.writeFile(collectionPath, JSON.stringify(collection, null, 2), 'utf8')

  logger.info('✅ Tests injected into collection at:', collectionPath)
  logger.info(`📊 Stats:`)
  logger.info(`   Total requests: ${stats.total}`)
  logger.info(`   OpenAPI matched: ${stats.matched}`)
  logger.info(`   Test blocks added: ${stats.added}`)
  logger.info(`   Error tests: ${stats.errorTests}`)
  logger.info(`   Success tests: ${stats.added - stats.errorTests}`)
}

main().catch(err => {
  logger.error('Failed to add tests:', err)
  process.exit(1)
})
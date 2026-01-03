// scripts/generate-openapi.ts
/**
 * Zod -> OpenAPI generator (build-time)
 * Default output: ./public/openapi.json
 */
import path from 'node:path';
import fs from 'node:fs/promises';
import { OpenAPIRegistry, OpenApiGeneratorV3 } from '@asteasolutions/zod-to-openapi';

// Import your route definitions
import {
  tokenStatusRouteDefinition,
  TokenIdParamSchema,
} from '@/app/schemas/openapi/token-status.openapi';
import { nonceRouteDefinition } from '@/app/schemas/openapi/nonce.openapi';
import { gateAccessRouteDefinition } from '@/app/schemas/openapi/gate-access.openapi';
import { formSubmissionGateRouteDefinition } from '@/app/schemas/openapi/form-submission-gate.openapi';

// Simple logger (no env dependencies)
const logger = {
  info: (msg: string) => console.log(`✅ ${msg}`),
  debug: (msg: string) => console.log(`🔍 ${msg}`),
  error: (msg: string, data?: any) => console.error(`❌ ${msg}`, data || ''),
};

// ---- CLI ----
type CliOpts = {
  outPath: string;
  pretty: boolean;
  serverUrlOverride?: string;
  environment?: string;
};

function parseArgs(argv: string[]): CliOpts {
  const args = [...argv];
  const getFlag = (...keys: string[]) => args.findIndex((a) => keys.includes(a));

  let outPath = path.resolve(process.cwd(), 'public/openapi.json');
  const outIdx = getFlag('--out', '-o');
  if (outIdx >= 0 && args[outIdx + 1]) {
    outPath = path.resolve(process.cwd(), args[outIdx + 1]);
  }

  const pretty = args.includes('--pretty');

  const sIdx = getFlag('--server', '-s');
  const serverUrlOverride = sIdx >= 0 && args[sIdx + 1] ? args[sIdx + 1] : undefined;

  const eIdx = getFlag('--env', '-e');
  const environment = eIdx >= 0 && args[eIdx + 1] ? args[eIdx + 1] : 'development';

  return { outPath, pretty, serverUrlOverride, environment };
}

const { outPath, pretty, serverUrlOverride, environment } = parseArgs(process.argv.slice(2));

// ---- Helpers ----
function buildDefaultServerUrl(): string {
  // Check for domain in env without importing the whole env config
  const domain = process.env.NEXT_PUBLIC_DOMAIN || 'localhost:3000';
  const isLocal = /^localhost(:\d+)?$/.test(domain) || domain.startsWith('localhost:');
  const protocol = isLocal ? 'http' : 'https';
  return `${protocol}://${domain}`;
}

function normalizeRoute(def: Record<string, unknown>) {
  const op = { ...def } as any;
  if (op.requestBody && !op.request) {
    op.request = { body: op.requestBody };
    delete op.requestBody;
  }
  return op;
}

function isPlainObject(v: unknown): v is Record<string, any> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

function sanitizeOpenApiDocument(doc: any): any {
  const walk = (node: any) => {
    if (Array.isArray(node)) {
      for (const item of node) walk(item);
      return;
    }
    if (!isPlainObject(node)) return;

    if (typeof node.exclusiveMinimum === 'boolean') delete node.exclusiveMinimum;
    if (typeof node.exclusiveMaximum === 'boolean') delete node.exclusiveMaximum;

    if (node.nullable === true && !('type' in node)) {
      delete node.nullable;
    }

    if (isPlainObject(node.additionalProperties)) {
      const ap = node.additionalProperties;
      if (ap.nullable === true && !('type' in ap)) {
        node.additionalProperties = true;
      }
    }

    for (const key of Object.keys(node)) {
      walk(node[key]);
    }
  };

  walk(doc);
  return doc;
}

// ---- Main ----
async function main() {
  const registry = new OpenAPIRegistry();

  // Register routes
  // Token status route - use Zod param schema
  const ts = { ...normalizeRoute(tokenStatusRouteDefinition) } as any;
  delete ts.parameters;
  registry.registerPath({ ...ts, request: { params: TokenIdParamSchema } } as any);

  // Other routes
  registry.registerPath(normalizeRoute(nonceRouteDefinition) as any);
  registry.registerPath(normalizeRoute(gateAccessRouteDefinition) as any);
  registry.registerPath(normalizeRoute(formSubmissionGateRouteDefinition) as any);

  // Determine server URL
  const defaultServer = serverUrlOverride || buildDefaultServerUrl();

  // Read package.json for metadata
  let pkgName = 'ritoswap-api';
  let pkgVersion = '1.0.0';
  try {
    const pkgRaw = await fs.readFile(path.resolve(process.cwd(), 'package.json'), 'utf8');
    const pkg = JSON.parse(pkgRaw);
    pkgName = pkg.name ?? pkgName;
    pkgVersion = pkg.version ?? pkgVersion;
  } catch {
    // ignore missing package.json
  }

  // Generate OpenAPI document
  const generator = new OpenApiGeneratorV3(registry.definitions);
  const document = generator.generateDocument({
    openapi: '3.0.3',
    info: {
      title: `${pkgName} OpenAPI`,
      version: pkgVersion,
      description: 'RitoSwap API - Token-gated access and NFT verification endpoints',
    },
    servers: [
      { url: defaultServer, description: 'Current environment' },
      ...(environment === 'production'
        ? []
        : [{ url: 'http://localhost:3000', description: 'Local development' }]),
    ],
    tags: [
      { name: 'Authentication', description: 'Auth & SIWE endpoints' },
      { name: 'Token Gate', description: 'Gated content access flows' },
      { name: 'NFT', description: 'NFT-related endpoints' },
      { name: 'Token Status', description: 'Token verification endpoints' },
      { name: 'Form Submission Gate', description: 'Gated form submissions' },
    ],
  });

  const sanitized = sanitizeOpenApiDocument(document);

  // Write to file
  const json = pretty ? JSON.stringify(sanitized, null, 2) : JSON.stringify(sanitized);
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, json, 'utf8');

  logger.info(`OpenAPI spec generated: ${outPath}`);
  logger.debug(`Environment: ${environment}`);
  logger.debug(`Server URL: ${defaultServer}`);

  if (!serverUrlOverride && process.env.NEXT_PUBLIC_DOMAIN) {
    logger.debug(`Using NEXT_PUBLIC_DOMAIN: ${process.env.NEXT_PUBLIC_DOMAIN}`);
  }
}

main().catch((err) => {
  logger.error('Failed to generate OpenAPI spec', {
    error: err?.message || 'Unknown error',
    stack: err?.stack,
  });
  process.exitCode = 1;
});

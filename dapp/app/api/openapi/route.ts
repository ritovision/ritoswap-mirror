import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export async function GET(req: NextRequest) {
  try {
    // Read the generated OpenAPI JSON
    const openApiPath = path.join(process.cwd(), 'public', 'openapi.json');
    const openApiContent = await fs.readFile(openApiPath, 'utf-8');
    const openApiDoc = JSON.parse(openApiContent);

    // Get the host from request headers for dynamic server URL
    const host = req.headers.get('host') || 'localhost:3000';
    const protocol = host.includes('localhost') ? 'http' : 'https';
    const serverUrl = `${protocol}://${host}`;

    // Override server URL if needed (making it malleable based on environment)
    if (openApiDoc.servers && openApiDoc.servers.length > 0) {
      // Keep existing servers but add the current one as primary
      openApiDoc.servers.unshift({ url: serverUrl });
      
      // Remove duplicates
      const uniqueServers = Array.from(
        new Set(
          (openApiDoc.servers as unknown[]).map((s: unknown) => {
            if (s && typeof s === 'object' && 'url' in s) {
              const u = (s as { url?: unknown }).url;
              return typeof u === 'string' ? u : '';
            }
            return '';
          }).filter(Boolean) as string[]
        )
      ).map((url) => ({ url }));
      openApiDoc.servers = uniqueServers;
    } else {
      openApiDoc.servers = [{ url: serverUrl }];
    }

    // Allow environment-specific overrides
    if (process.env.OPENAPI_SERVER_URL) {
      openApiDoc.servers.unshift({ url: process.env.OPENAPI_SERVER_URL });
    }

    return NextResponse.json(openApiDoc, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      },
    });
  } catch (error) {
    console.error('Error loading OpenAPI spec:', error);
    return NextResponse.json(
      { error: 'Failed to load OpenAPI specification' },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
// app/api/debug/status/route.ts
import { NextResponse } from 'next/server'
import { createLogger } from '@logger'
import { nodeConfig } from '@config/node.env'
import { serverConfig } from '@config/server.env'

const logger = createLogger('debug-status')

export async function GET() {
  if (!nodeConfig.isDevelopment) {
    logger.warn('Attempted access to debug endpoint in production')
    return NextResponse.json({ error: 'Not available' }, { status: 404 })
  }

  const status = {
    stateWorkerUrl: Boolean(serverConfig.stateService.url),
    stateWorkerApiKey: Boolean(serverConfig.stateService.apiKey),
  }

  logger.debug('Debug status checked', status)
  return NextResponse.json(status)
}

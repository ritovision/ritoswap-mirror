#!/usr/bin/env tsx
import { createLogger } from '../app/lib/logger/logger.js';
import { execSync } from 'child_process';

const logger = createLogger('prisma-reset');

try {
  logger.info('🗑  Resetting local database...');
  execSync('npx prisma migrate reset --force', { stdio: 'inherit' });
  
  logger.info('✨  Creating initial migration...');
  execSync('npx prisma migrate dev --name init', { stdio: 'inherit' });
  
  logger.info('✅  Prisma reset complete.');
} catch (error) {
  logger.error('❌  Error during Prisma reset:', { 
    error: error instanceof Error ? error.message : String(error), 
    stack: error instanceof Error ? error.stack : undefined 
  });
  process.exit(1);
}
// app/config/logger.config.ts
import { z } from 'zod';
import { nodeEnv } from './node.env';

type LoggerLevel = 'debug' | 'info' | 'warn' | 'error';

const loggerSchema = z.object({
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).optional(),
  SERVICE_NAME: z.string().optional(),
  ENABLE_FILE_LOGS: z.coerce.boolean().optional(),
  SHOW_TEST_LOGS: z.coerce.boolean().optional(),
});

// Only read the keys we care about
const raw = {
  LOG_LEVEL: process.env.LOG_LEVEL,
  SERVICE_NAME: process.env.SERVICE_NAME,
  ENABLE_FILE_LOGS: process.env.ENABLE_FILE_LOGS,
  SHOW_TEST_LOGS: process.env.SHOW_TEST_LOGS,
};

const parsed = loggerSchema.safeParse(raw);

if (!parsed.success) {
  // Keep logger bootstrap independent of your logger util to avoid cycles
  console.error('Logger config validation failed:', parsed.error.format());
}

// Defaults: dev→debug, prod/test→info; service name fallback; booleans default false
const level: LoggerLevel =
  (parsed.success && parsed.data.LOG_LEVEL) ||
  (nodeEnv.NODE_ENV === 'development' ? 'debug' : 'info');

const serviceName = (parsed.success && parsed.data.SERVICE_NAME) || 'ritoswap';

const enableFileLogs =
  (parsed.success && parsed.data.ENABLE_FILE_LOGS !== undefined
    ? parsed.data.ENABLE_FILE_LOGS
    : false) as boolean;

const showTestLogs =
  (parsed.success && parsed.data.SHOW_TEST_LOGS !== undefined
    ? parsed.data.SHOW_TEST_LOGS
    : false) as boolean;

export const loggerConfig = Object.freeze({
  level,
  serviceName,
  enableFileLogs,
  showTestLogs,
  environment: nodeEnv.NODE_ENV,
  isDevelopment: nodeEnv.NODE_ENV === 'development',
  isTest: nodeEnv.NODE_ENV === 'test',
});

export type LoggerConfig = typeof loggerConfig;

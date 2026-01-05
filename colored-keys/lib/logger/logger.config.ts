// colored-keys/lib/logger/logger.config.ts
import { z } from 'zod';
import * as dotenv from 'dotenv';

// Load .env file
dotenv.config();

// Define logger-specific schema
const loggerEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).optional().default('development'),
  
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug', 'verbose']).optional(),
  
  ENABLE_FILE_LOGS: z.enum(['true', 'false']).optional().default('false').transform(val => val === 'true'),
  
  SHOW_TEST_LOGS: z.enum(['true', 'false']).optional().default('false').transform(val => val === 'true'),
  
  // Runtime variable set by Hardhat
  HARDHAT_NETWORK: z.string().optional().default('hardhat')
});

// Parse and validate logger config
const parseResult = loggerEnvSchema.safeParse(process.env);

// Apply LOG_LEVEL default based on NODE_ENV after parsing
if (parseResult.success) {
  const isDevelopment = parseResult.data.NODE_ENV !== 'production';
  parseResult.data.LOG_LEVEL = parseResult.data.LOG_LEVEL || (isDevelopment ? 'debug' : 'info');
}

if (!parseResult.success) {
  // Fall back to sensible defaults for logger if validation fails
  // We don't want to crash the app just because logger config is wrong
  console.warn('⚠️ Logger configuration validation failed, using defaults');
  parseResult.error.issues.forEach((issue) => {
    console.warn(`  ${issue.path.join('.')}: ${issue.message}`);
  });
  
  // Provide defaults
  const defaults = {
    NODE_ENV: 'development' as const,
    LOG_LEVEL: 'info' as const,
    ENABLE_FILE_LOGS: false,
    SHOW_TEST_LOGS: false,
    HARDHAT_NETWORK: 'hardhat'
  };
  
  // Export defaults if validation fails
  exports.loggerConfig = defaults;
} else {
  // Export validated config
  exports.loggerConfig = parseResult.data;
}

// Type export
export type LoggerConfig = Omit<z.infer<typeof loggerEnvSchema>, 'LOG_LEVEL'> & {
  LOG_LEVEL: 'error' | 'warn' | 'info' | 'debug' | 'verbose';
};

export const loggerConfig: LoggerConfig = parseResult.success ? parseResult.data as LoggerConfig : {
  NODE_ENV: 'development',
  LOG_LEVEL: 'info',
  ENABLE_FILE_LOGS: false,
  SHOW_TEST_LOGS: false,
  HARDHAT_NETWORK: 'hardhat'
};
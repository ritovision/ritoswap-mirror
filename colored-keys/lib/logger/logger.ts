// colored-keys/lib/logger/logger.ts
import winston from 'winston';
import { mkdirSync, existsSync } from 'fs';
import { loggerConfig } from './logger.config';

const isTest = loggerConfig.HARDHAT_NETWORK === 'hardhat' || loggerConfig.NODE_ENV === 'test';
const showTestLogs = loggerConfig.SHOW_TEST_LOGS;

// Simple: File logs are OFF by default, turn on explicitly
const enableFileLogs = loggerConfig.ENABLE_FILE_LOGS;

// Ensure logs directory exists
if (enableFileLogs && !existsSync('logs')) {
  mkdirSync('logs', { recursive: true });
}

const consoleFormat = winston.format.printf(({ level, message, timestamp, module, ...meta }) => {
  const prefix = module ? `[${module}]` : '';
  
  // Filter out default/redundant metadata for cleaner console output
  const { service, network, ...relevantMeta } = meta;
  
  // Only show metadata if it's actually useful (not default meta)
  let metaString = '';
  if (Object.keys(relevantMeta).length > 0) {
    // For single values, show inline. For objects, show on next line
    if (Object.keys(relevantMeta).length === 1 && typeof Object.values(relevantMeta)[0] !== 'object') {
      metaString = ` (${Object.values(relevantMeta)[0]})`;
    } else {
      metaString = '\n  ' + JSON.stringify(relevantMeta, null, 2).split('\n').join('\n  ');
    }
  }
  
  return `${timestamp} ${prefix} [${level}]: ${message}${metaString}`;
});

const logger = winston.createLogger({
  level: loggerConfig.LOG_LEVEL,
  format: winston.format.combine(
    winston.format.timestamp({ format: 'HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  ),
  defaultMeta: { 
    service: 'colored-keys',
    network: loggerConfig.HARDHAT_NETWORK
  },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        consoleFormat
      ),
      silent: isTest && !showTestLogs
    }),
    
    // File transports (only when explicitly enabled)
    ...(enableFileLogs ? [
      new winston.transports.File({ 
        filename: 'logs/error.log', 
        level: 'error',
        maxsize: 5242880,
        maxFiles: 3
      }),
      new winston.transports.File({ 
        filename: 'logs/contracts.log',
        maxsize: 5242880,
        maxFiles: 3
      })
    ] : [])
  ]
});

export const createLogger = (module: string) => {
  return logger.child({ module });
};

export default logger;
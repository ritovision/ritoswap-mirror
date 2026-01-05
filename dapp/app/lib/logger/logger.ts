// app/lib/logger/logger.ts
import winston from 'winston';
import { loggerConfig } from '@config/logger.config';

const {
  isDevelopment,
  isTest,
  showTestLogs,
  enableFileLogs,
  level,            
  serviceName,
  environment,
} = loggerConfig;

// Pretty console logs in development
const devConsoleFormat = winston.format.printf(({ level, message, timestamp, module, ...meta }) => {
  const prefix = module ? `[${module}]` : '';
  const metaString = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
  return `${timestamp} ${prefix} [${level}]: ${message} ${metaString}`;
});

// JSON console logs in production
const prodConsoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Choose console transport based on environment
const consoleTransport = new winston.transports.Console({
  format: isDevelopment
    ? winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp({ format: 'HH:mm:ss' }),
        devConsoleFormat
      )
    : prodConsoleFormat,
});

const logger = winston.createLogger({
  level, // <-- fixed
  defaultMeta: {
    service: serviceName || 'ritoswap-dapp',
    environment: environment || 'development',
  },
  transports: [
    consoleTransport,
    ...(enableFileLogs
      ? [
          new winston.transports.File({
            filename: 'logs/error.log',
            level: 'error',
            maxsize: 5 * 1024 * 1024,
            maxFiles: 5,
          }),
          new winston.transports.File({
            filename: 'logs/combined.log',
            maxsize: 5 * 1024 * 1024,
            maxFiles: 5,
          }),
        ]
      : []),
  ],
  silent: isTest && !showTestLogs,
});

if (enableFileLogs && !isTest) {
  logger.exceptions.handle(new winston.transports.File({ filename: 'logs/exceptions.log' }));
  logger.rejections.handle(new winston.transports.File({ filename: 'logs/rejections.log' }));
}

export const createLogger = (module: string) => logger.child({ module });

export default logger;

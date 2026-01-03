// app/lib/logger/__mocks__/index.ts

const mockLoggerInstance = {
  info: vi.fn(),
  debug: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

export const createLogger = vi.fn(() => mockLoggerInstance);

export default mockLoggerInstance;
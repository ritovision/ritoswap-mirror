// app/lib/llm/constants.ts
// Simple constants for the LLM system

// Debug flags
export const DEBUG_TOOLS = process.env.DEBUG_TOOLS === '1';
export const DEBUG_STREAMING = process.env.DEBUG_STREAMING === '1';

// Streaming settings
export const STREAM_FLUSH_INTERVAL_MS = 50; // Flush every 50ms for smooth streaming
export const STREAM_CHUNK_LOG_INTERVAL = 10; // Log every 10 chunks
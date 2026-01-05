// postman/env.schema.ts
import { z } from 'zod'
import dotenv from 'dotenv'
import path from 'node:path'
import fs from 'node:fs'

// Load environment from specific file
const envFile = path.resolve('.env.postman')
const envExampleFile = path.resolve('.env.postman.example')

// Check if env file exists and load it
if (!fs.existsSync(envFile)) {
  console.error(`Environment file not found: ${envFile}`)
  console.error(`Please copy ${envExampleFile} to ${envFile} and fill out the required environment variables.`)
  process.exit(1)
}

const result = dotenv.config({ path: envFile })
if (result.error) {
  console.error(`Failed to parse environment file: ${envFile}`)
  console.error(result.error.message)
  process.exit(1)
}

// Define the schema
const envSchema = z.object({
  PRIVATE_KEY: z
    .union([z.string(), z.undefined()])
    .refine((val) => val !== undefined && val.length > 0, {
      message: 'PRIVATE_KEY is required in .env.postman'
    })
    .transform((val) => {
      if (!val) throw new Error('PRIVATE_KEY is required')
      // Ensure 0x prefix for private keys
      return val.startsWith('0x') ? val : `0x${val}`
    }),
  
  TOKEN_ID: z
    .union([z.string(), z.undefined()])
    .refine((val) => val !== undefined && val.length > 0, {
      message: 'TOKEN_ID is required in .env.postman'
    })
    .transform((val) => {
      if (!val) throw new Error('TOKEN_ID is required')
      return Number(val)
    })
    .refine((val) => !isNaN(val) && val >= 0, {
      message: 'TOKEN_ID must be a valid non-negative number'
    }),
  
  CHAIN_ID: z
    .string()
    .optional()
    .default('1')
    .transform((val) => Number(val))
    .refine((val) => !isNaN(val) && val > 0, {
      message: 'CHAIN_ID must be a valid positive number'
    }),
  
  TEST_BASE_URL: z
    .string()
    .optional()
    .default('http://localhost:3000')
    .refine(
      (val) => {
        try {
          new URL(val)
          return true
        } catch {
          return false
        }
      },
      { message: 'TEST_BASE_URL must be a valid URL' }
    )
    .transform((val) => {
      // Strip trailing slashes
      return val.replace(/\/+$/, '')
    }),
  
  OPENAPI_URL: z
    .string()
    .optional()
    .default('http://localhost:3000/api/openapi')
    .refine(
      (val) => {
        try {
          new URL(val)
          return true
        } catch {
          return false
        }
      },
      { message: 'OPENAPI_URL must be a valid URL' }
    ),
  
  NEXT_PUBLIC_ENABLE_STATE_WORKER: z
    .string()
    .optional()
    .default('false')
    .transform((val) => {
      const lower = val.toLowerCase()
      return lower === 'true' || lower === '1' || lower === 'yes'
    }),

  // Additional convenience field for BASE_URL (alias for TEST_BASE_URL)
  BASE_URL: z
    .string()
    .optional()
    .transform((val) => val || process.env.TEST_BASE_URL)
    .default('http://localhost:3000')
    .refine(
      (val) => {
        if (!val) return true // Will use TEST_BASE_URL
        try {
          new URL(val)
          return true
        } catch {
          return false
        }
      },
      { message: 'BASE_URL must be a valid URL' }
    )
    .transform((val) => {
      if (!val) return undefined
      // Strip trailing slashes
      return val.replace(/\/+$/, '')
    })
})

// Parse and validate environment
const parseResult = envSchema.safeParse(process.env)

if (!parseResult.success) {
  console.error('❌ Environment validation failed:')
  parseResult.error.issues.forEach((issue) => {
    console.error(`  - ${issue.path.join('.')}: ${issue.message}`)
  })
  process.exit(1)
}

export const env = parseResult.data

// Export the validated and transformed environment
export type PostmanEnv = z.infer<typeof envSchema>

// Helper to get collection output directory
export const getCollectionDir = () => path.resolve('postman/collection')

// Helper to ensure collection directory exists
export async function ensureCollectionDir() {
  const dir = getCollectionDir()
  await fs.promises.mkdir(dir, { recursive: true })
  return dir
}

console.log('✅ Environment validated successfully')

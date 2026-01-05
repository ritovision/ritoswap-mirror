// lib/server/r2.ts
import { z } from 'zod'
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { serverEnv, serverConfig } from '@config/server.env'

let _client: S3Client | null = null

function getR2Client(): S3Client {
  if (!serverConfig.r2.isConfigured) {
    throw new Error('R2 storage is not configured')
  }
  if (_client) return _client
  _client = new S3Client({
    region: 'auto',
    endpoint: `https://${serverEnv.R2_API_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: serverEnv.R2_API_ACCESS_KEY_ID!,
      secretAccessKey: serverEnv.R2_API_SECRET_ACCESS_KEY!,
    },
  })
  return _client
}

const ExpiresSchema = z.coerce.number().int().positive().max(24 * 60 * 60) // up to 24h

export async function generateSignedAudioUrl(expiresIn: number = 3600): Promise<string> {
  const ttl = ExpiresSchema.parse(expiresIn)
  const client = getR2Client()

  const command = new GetObjectCommand({
    Bucket: serverEnv.R2_API_BUCKET_NAME!,
    Key: 'HitMeBitcoin.mp3',
  })

  return getSignedUrl(client, command, { expiresIn: ttl })
}

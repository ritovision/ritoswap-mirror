// app/lib/rateLimit/rateLimit.client.ts
// Client-side check for rate limiting (validated public env)
import { publicEnv } from '@config/public.env'

export const isRateLimitEnabled = (): boolean => {
  return publicEnv.NEXT_PUBLIC_ENABLE_STATE_WORKER
}

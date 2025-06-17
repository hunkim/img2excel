interface RateLimitStore {
  requests: number
  resetTime: number
}

// In-memory store for rate limiting
const rateLimitStore = new Map<string, RateLimitStore>()

// Rate limits (configurable via environment variables)
const ANONYMOUS_LIMIT = parseInt(process.env.ANONYMOUS_RATE_LIMIT || '60') // per hour
const AUTHENTICATED_LIMIT = parseInt(process.env.AUTHENTICATED_RATE_LIMIT || '240') // per hour
const WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '3600000') // 1 hour in milliseconds

export interface RateLimitResult {
  success: boolean
  remaining: number
  resetTime: number
  limit: number
}

export function checkRateLimit(identifier: string, isAuthenticated: boolean = false): RateLimitResult {
  const now = Date.now()
  const limit = isAuthenticated ? AUTHENTICATED_LIMIT : ANONYMOUS_LIMIT
  
  // Clean up expired entries periodically
  if (Math.random() < 0.01) { // 1% chance to clean up
    cleanupExpiredEntries(now)
  }
  
  const record = rateLimitStore.get(identifier)
  
  if (!record || now > record.resetTime) {
    // First request or window expired, create new record
    const newRecord: RateLimitStore = {
      requests: 1,
      resetTime: now + WINDOW_MS
    }
    rateLimitStore.set(identifier, newRecord)
    
    return {
      success: true,
      remaining: limit - 1,
      resetTime: newRecord.resetTime,
      limit
    }
  }
  
  if (record.requests >= limit) {
    // Rate limit exceeded
    return {
      success: false,
      remaining: 0,
      resetTime: record.resetTime,
      limit
    }
  }
  
  // Increment requests
  record.requests++
  rateLimitStore.set(identifier, record)
  
  return {
    success: true,
    remaining: limit - record.requests,
    resetTime: record.resetTime,
    limit
  }
}

function cleanupExpiredEntries(now: number) {
  for (const [key, record] of rateLimitStore.entries()) {
    if (now > record.resetTime) {
      rateLimitStore.delete(key)
    }
  }
}

export function getRateLimitHeaders(result: RateLimitResult) {
  return {
    'X-RateLimit-Limit': result.limit.toString(),
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': Math.ceil(result.resetTime / 1000).toString(),
  }
} 
import { Request, Response, NextFunction } from 'express'
import { createClient } from 'redis'

let redisClient: ReturnType<typeof createClient> | null = null

async function getRedis() {
  if (!redisClient) {
    redisClient = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' })
    redisClient.on('error', (err) => console.warn('Redis error (cache desativado):', err.message))
    try {
      await redisClient.connect()
    } catch {
      redisClient = null
    }
  }
  return redisClient
}

export function cacheMiddleware(ttlSeconds = 300) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const client = await getRedis()
    if (!client) return next()

    const key = `cache:${req.user?.userId}:${req.originalUrl}`
    try {
      const cached = await client.get(key)
      if (cached) {
        res.json(JSON.parse(cached))
        return
      }

      const originalJson = res.json.bind(res)
      res.json = (data) => {
        client.setEx(key, ttlSeconds, JSON.stringify(data)).catch(() => {})
        return originalJson(data)
      }
      next()
    } catch {
      next()
    }
  }
}

export async function invalidateCache(userId: string, pattern: string) {
  const client = await getRedis()
  if (!client) return
  try {
    const keys = await client.keys(`cache:${userId}:*${pattern}*`)
    if (keys.length > 0) await client.del(keys)
  } catch {}
}

'use client'

import { useAuth } from '@/hooks/useAuth'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Clock, Shield, User } from 'lucide-react'

interface RateLimitInfoProps {
  rateLimitHeaders?: {
    limit?: string
    remaining?: string
    reset?: string
  }
}

export function RateLimitInfo({ rateLimitHeaders }: RateLimitInfoProps) {
  const { isAuthenticated } = useAuth()
  
  const limit = rateLimitHeaders?.limit ? parseInt(rateLimitHeaders.limit) : null
  const remaining = rateLimitHeaders?.remaining ? parseInt(rateLimitHeaders.remaining) : null
  const resetTime = rateLimitHeaders?.reset ? parseInt(rateLimitHeaders.reset) * 1000 : null
  
  const used = limit && remaining !== null ? limit - remaining : null
  const usagePercentage = limit && used !== null ? (used / limit) * 100 : 0
  
  const getResetTimeString = () => {
    if (!resetTime) return 'Unknown'
    const now = Date.now()
    const diff = resetTime - now
    
    if (diff <= 0) return 'Now'
    
    const minutes = Math.ceil(diff / (1000 * 60))
    if (minutes < 60) return `${minutes} minutes`
    
    const hours = Math.ceil(minutes / 60)
    return `${hours} hour${hours > 1 ? 's' : ''}`
  }
  
  if (!limit || remaining === null) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Shield className="h-4 w-4" />
        <span>Rate limit: {isAuthenticated ? '240' : '60'} requests/hour</span>
      </div>
    )
  }
  
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          {isAuthenticated ? (
            <User className="h-4 w-4 text-green-600" />
          ) : (
            <Shield className="h-4 w-4 text-blue-600" />
          )}
          <span className="font-medium">
            {isAuthenticated ? 'Authenticated' : 'Anonymous'} Usage
          </span>
        </div>
        <Badge variant={remaining < 10 ? 'destructive' : remaining < 30 ? 'default' : 'secondary'}>
          {remaining} remaining
        </Badge>
      </div>
      
      <div className="space-y-1">
        <Progress 
          value={usagePercentage} 
          className="h-2"
        />
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{used}/{limit} requests used</span>
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            <span>Resets in {getResetTimeString()}</span>
          </div>
        </div>
      </div>
      
      {!isAuthenticated && remaining < 20 && (
        <p className="text-xs text-amber-600 dark:text-amber-400">
          💡 Sign in to get 240 requests per hour instead of 60
        </p>
      )}
    </div>
  )
} 
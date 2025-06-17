import { NextRequest } from 'next/server'
import { getAuth } from 'firebase-admin/auth'
import app from './firebase-admin'

export interface AuthInfo {
  isAuthenticated: boolean
  userId?: string
  email?: string
}

export async function getAuthInfo(request: NextRequest): Promise<AuthInfo> {
  try {
    // Get the Authorization header
    const authHeader = request.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return { isAuthenticated: false }
    }

    const token = authHeader.slice(7) // Remove 'Bearer ' prefix
    
    // Verify the Firebase token
    const adminAuth = getAuth(app)
    const decodedToken = await adminAuth.verifyIdToken(token)
    
    return {
      isAuthenticated: true,
      userId: decodedToken.uid,
      email: decodedToken.email
    }
  } catch (error) {
    // If token verification fails, treat as unauthenticated
    console.log('Token verification failed:', error)
    return { isAuthenticated: false }
  }
}

export function getClientIP(request: NextRequest): string {
  // Check various headers for the real IP
  const forwarded = request.headers.get('x-forwarded-for')
  const realIP = request.headers.get('x-real-ip')
  const remoteAddr = request.headers.get('x-vercel-forwarded-for')
  
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }
  
  if (realIP) {
    return realIP
  }
  
  if (remoteAddr) {
    return remoteAddr
  }
  
  // Fallback to a default identifier
  return 'unknown'
} 
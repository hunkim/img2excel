import { auth } from './firebase'

export interface ApiCallOptions {
  method?: string
  body?: any
  headers?: Record<string, string>
}

export async function makeAuthenticatedApiCall(
  url: string, 
  options: ApiCallOptions = {}
): Promise<Response> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options.headers
  }

  // Add Firebase auth token if user is logged in
  if (auth.currentUser) {
    try {
      const token = await auth.currentUser.getIdToken()
      headers['Authorization'] = `Bearer ${token}`
    } catch (error) {
      console.warn('Failed to get auth token:', error)
      // Continue without auth token - will be treated as anonymous user
    }
  }

  return fetch(url, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  })
} 
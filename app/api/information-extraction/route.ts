import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit, getRateLimitHeaders } from '@/lib/rate-limiter'
import { getAuthInfo, getClientIP } from '@/lib/auth-utils'

export async function POST(request: NextRequest) {
  try {
    // Check rate limit first
    const authInfo = await getAuthInfo(request)
    const identifier = authInfo.isAuthenticated ? authInfo.userId! : getClientIP(request)
    const rateLimitResult = checkRateLimit(identifier, authInfo.isAuthenticated)
    
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { 
          error: 'Rate limit exceeded. Please try again later.',
          resetTime: rateLimitResult.resetTime 
        }, 
        { 
          status: 429,
          headers: getRateLimitHeaders(rateLimitResult)
        }
      )
    }

    const { imageUrl, schema } = await request.json()
    
    if (!imageUrl || !schema) {
      console.error('❌ Missing required parameters: imageUrl or schema')
      return NextResponse.json({ error: 'Image URL and schema are required' }, { status: 400 })
    }

    const upstageApiKey = process.env.UPSTAGE_API_KEY
    if (!upstageApiKey) {
      console.error('❌ UPSTAGE_API_KEY not configured')
      return NextResponse.json({ error: 'UPSTAGE_API_KEY not configured' }, { status: 500 })
    }

    const requestPayload = {
      model: 'information-extract',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: {
                url: imageUrl
              }
            }
          ]
        }
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'document_schema',
          schema: schema
        }
      },
      chunking: {
        pages_per_chunk: 5
      }
    }

    const response = await fetch('https://api.upstage.ai/v1/information-extraction', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${upstageApiKey}`,
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify(requestPayload)
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ UPSTAGE API ERROR:', response.status, errorText)
      return NextResponse.json({ error: 'Failed to extract information' }, { status: response.status })
    }

    const data = await response.json()
    return NextResponse.json(data, {
      headers: getRateLimitHeaders(rateLimitResult)
    })
  } catch (error) {
    console.error('❌ Information extraction error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 
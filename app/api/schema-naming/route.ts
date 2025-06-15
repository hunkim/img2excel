import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { fieldNames } = await request.json()

    if (!fieldNames || !Array.isArray(fieldNames) || fieldNames.length === 0) {
      return NextResponse.json(
        { error: 'Field names array is required' },
        { status: 400 }
      )
    }

    // Create a meaningful prompt for Solar Mini
    const prompt = `Based on these data field names from a document, suggest a concise, meaningful title for this dataset:

Field names:
${fieldNames.map(name => `- ${name}`).join('\n')}

Please respond with only a short, descriptive title (2-5 words) that captures what this data represents. Examples:
- "Business Contact Information"
- "Government Recommendation Form"
- "Invoice Details"
- "Employee Directory"

Title:`

    // Call Solar Mini API
    const response = await fetch('https://api.upstage.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.UPSTAGE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'solar-mini',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        stream: false,
        max_tokens: 20,
        temperature: 0.3
      }),
    })

    if (!response.ok) {
      console.error('❌ Solar Mini API Error:', response.status, response.statusText)
      const errorText = await response.text()
      console.error('❌ Error details:', errorText)
      throw new Error(`Solar Mini API failed: ${response.status}`)
    }

    const data = await response.json()

    // Extract the suggested title
    const suggestedTitle = data.choices?.[0]?.message?.content?.trim()
    
    if (!suggestedTitle) {
      console.warn('⚠️ No title generated, using fallback')
      return NextResponse.json({ 
        suggestedTitle: 'AI Extracted Data' 
      })
    }

    // Clean up the title (remove quotes, extra formatting)
    const cleanTitle = suggestedTitle
      .replace(/^["']|["']$/g, '') // Remove quotes
      .replace(/^Title:\s*/i, '') // Remove "Title:" prefix
      .trim()

    return NextResponse.json({
      suggestedTitle: cleanTitle
    })

  } catch (error) {
    console.error('❌ Error in schema naming:', error)
    return NextResponse.json(
      { 
        error: 'Failed to generate schema name',
        suggestedTitle: 'AI Extracted Data' // Fallback
      },
      { status: 500 }
    )
  }
} 
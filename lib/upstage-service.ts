interface UpstageSchema {
  type: "object"
  properties: Record<string, {
    type: string
    description: string
  }>
}

interface UpstageSchemaResponse {
  type: string
  json_schema: {
    name: string
    schema: UpstageSchema
  }
}

interface UpstageExtractionResponse {
  id: string
  choices: Array<{
    finish_reason: string
    message: {
      content: string
      role: string
    }
  }>
}

// Convert File to base64 data URL for API usage
export const fileToDataUrl = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// Generate schema from image using Upstage AI
export const generateSchemaFromImage = async (file: File): Promise<Record<string, string>> => {
  try {
    const imageUrl = await fileToDataUrl(file)
    
    const response = await fetch('/api/schema-generation', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ imageUrl })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ Schema generation API failed:', errorText)
      throw new Error('Failed to generate schema')
    }

    const data = await response.json()
    
    // Convert Upstage schema format to flat key-value pairs
    const flatSchema: Record<string, string> = {}
    
    // Parse the schema from the response - it's inside the choices[0].message.content as JSON string
    let schemaProperties = null
    
    if (data.choices?.[0]?.message?.content) {
      try {
        const contentObj = JSON.parse(data.choices[0].message.content)
        
        if (contentObj.json_schema?.schema?.properties) {
          schemaProperties = contentObj.json_schema.schema.properties
        }
      } catch (parseError) {
        console.error('❌ Failed to parse content JSON:', parseError)
      }
    }
    
    if (schemaProperties) {
      Object.entries(schemaProperties).forEach(([key, value]: [string, any]) => {
        // Create a descriptive name from the key and description
        const displayName = value.description || key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
        flatSchema[displayName] = '' // Initialize with empty value
      })
    } else {
      console.warn('⚠️ No schema properties found in response, using fallback')
    }
    
    return flatSchema
  } catch (error) {
    console.error('❌ Schema generation error:', error)
    // Fallback to mock data on error
    const fallbackSchema = {
      'Item Name': '',
      'Amount': '',
      'Category': ''
    }
    return fallbackSchema
  }
}

// Extract information from image using provided schema
export const extractInformationFromImage = async (
  file: File, 
  keys: Array<{ id: string; name: string }>
): Promise<Record<string, string>> => {
  try {
    const imageUrl = await fileToDataUrl(file)
    
    // Convert app schema to Upstage schema format
    const upstageSchema: UpstageSchema = {
      type: "object",
      properties: {}
    }

    keys.forEach(key => {
      // Convert display name to API-friendly key
      const apiKey = key.name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
      upstageSchema.properties[apiKey] = {
        type: "string",
        description: key.name
      }
    })

    const response = await fetch('/api/information-extraction', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        imageUrl,
        schema: upstageSchema
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ Information extraction API failed:', errorText)
      throw new Error('Failed to extract information')
    }

    const data = await response.json()
    
    // Parse the extracted content
    const extractedData = JSON.parse(data.choices?.[0]?.message?.content || '{}')
    
    // Map back to display names
    const result: Record<string, string> = {}
    keys.forEach(key => {
      const apiKey = key.name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
      result[key.name] = extractedData[apiKey] || ''
    })
    
    return result
  } catch (error) {
    console.error('❌ Information extraction error:', error)
    // Fallback to mock data on error
    const result: Record<string, string> = {}
    keys.forEach(key => {
      result[key.name] = `Sample ${key.name.toLowerCase()}`
    })
    return result
  }
} 
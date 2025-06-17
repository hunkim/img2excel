import { create } from "zustand"
import { generateSchemaFromImage, extractInformationFromImage } from "@/lib/upstage-service"
import { makeAuthenticatedApiCall } from "@/lib/api-client"
import { 
  saveProject, 
  updateProject, 
  getProject,
  getUserProjects, 
  uploadImageToStorage,
  deleteImageFromStorage,
  type FirebaseProject,
  type FirebaseImageColumn 
} from "@/lib/firebase-service"

export interface ImageColumn {
  id: string
  fileName: string
  fileUrl: string
  values: { [keyId: string]: string }
}

interface SpreadsheetState {
  sheetTitle: string
  keys: Array<{ id: string; name: string }>
  columns: ImageColumn[]
  isProcessing: boolean
  processingStep: 'idle' | 'generating-schema' | 'naming-schema' | 'extracting-values' | 'complete'
  currentProjectId: string | null
  isSaving: boolean
  lastSaved: Date | null

  actions: {
    setSheetTitle: (title: string) => void
    addKey: (name?: string) => string
    updateKeyName: (keyId: string, name: string) => void
    deleteKey: (keyId: string) => void
    addImageColumn: (file: File, userId?: string) => Promise<void>
    updateCellValue: (columnId: string, keyId: string, value: string) => void
    deleteColumn: (columnId: string, userId?: string) => Promise<void>
    resetSheet: () => void
    getCellValue: (columnId: string, keyId: string) => string
    // Firebase actions
    loadProjectFromFirebase: (projectId: string) => Promise<void>
    saveProject: (userId: string) => Promise<void>
  }
}

const initialState = {
  sheetTitle: "My Extracted Data", // Default title, user can change to "MAKE A LIST"
  keys: [],
  columns: [],
  isProcessing: false,
  processingStep: 'idle' as const,
  currentProjectId: null,
  isSaving: false,
  lastSaved: null,
}

// Utility function to generate unique project names
const generateUniqueProjectName = async (baseName: string, userId: string): Promise<string> => {
  try {
    // Get all existing projects for the user
    const existingProjects = await getUserProjects(userId)
    const existingTitles = existingProjects.map(p => p.title.toLowerCase())
    
    // If base name doesn't exist, use it as-is
    if (!existingTitles.includes(baseName.toLowerCase())) {
      return baseName
    }
    
    // Find the highest number suffix for this base name
    let maxNumber = 1
    const baseNameLower = baseName.toLowerCase()
    
    existingTitles.forEach(title => {
      // Check for exact match with number suffix: "Base Name (2)", "Base Name (3)", etc.
      const match = title.match(new RegExp(`^${baseNameLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\((\\d+)\\)$`))
      if (match) {
        const num = parseInt(match[1], 10)
        if (num > maxNumber) {
          maxNumber = num
        }
      }
    })
    
    // Return the next available number
    return `${baseName} (${maxNumber + 1})`
  } catch (error) {
    console.error('❌ Error generating unique project name:', error)
    // Fallback to timestamp-based uniqueness
    const timestamp = new Date().toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    })
    return `${baseName} (${timestamp})`
  }
}

export const useSpreadsheetStore = create<SpreadsheetState>((set, get) => ({
  ...initialState,
  actions: {
    setSheetTitle: (title) => set({ sheetTitle: title }),
    addKey: (name = "New Key") => {
      const newKeyId = `key_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
      set((state) => {
        const newKey = { id: newKeyId, name }
        const updatedKeys = [...state.keys, newKey]
        const updatedColumns = state.columns.map((col) => ({
          ...col,
          values: {
            ...col.values,
            [newKeyId]: "",
          },
        }))
        return { keys: updatedKeys, columns: updatedColumns }
      })
      return newKeyId
    },
    updateKeyName: (keyId, name) =>
      set((state) => ({
        keys: state.keys.map((key) => (key.id === keyId ? { ...key, name } : key)),
      })),
    deleteKey: (keyId) =>
      set((state) => {
        const updatedKeys = state.keys.filter((key) => key.id !== keyId)
        const updatedColumns = state.columns.map((col) => {
          const newValues = { ...col.values }
          delete newValues[keyId]
          return { ...col, values: newValues }
        })
        return { keys: updatedKeys, columns: updatedColumns }
      }),

          addImageColumn: async (file: File, userId?: string) => {
      const isFirstImage = get().columns.length === 0 && get().keys.length === 0
      const columnId = `col_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
      const fileUrl = URL.createObjectURL(file)

        // Step 0: Show image immediately 
        const newColumnToAdd: ImageColumn = {
          id: columnId,
          fileName: file.name,
          fileUrl,
          values: {}, // Empty initially, will be filled as we process
        }

        // Add the image to UI immediately, before processing starts
        set((state) => ({
          ...state,
          columns: [...state.columns, newColumnToAdd],
          isProcessing: true, 
          processingStep: isFirstImage ? 'generating-schema' : 'extracting-values'
        }))

        let extractedData: Record<string, string>
        let suggestedTitle = 'AI Extracted Data' // Default fallback

        try {
          if (isFirstImage) {
            // Step 1: Generate schema from image
            set((state) => ({ ...state, processingStep: 'generating-schema' }))
            const schemaData = await generateSchemaFromImage(file)
            
            // Show table headers immediately after schema generation
            const newKeys = Object.keys(schemaData).map((name, index) => ({ 
              id: `key_${Date.now()}_${index}_${Math.random().toString(36).substring(2, 7)}`, 
              name 
            }))
            
            set((state) => ({
              ...state,
              keys: newKeys,
              // Update all existing columns to have empty values for new keys
              columns: state.columns.map((col) => {
                const newValues = { ...col.values }
                newKeys.forEach((key) => {
                  if (!(key.id in newValues)) {
                    newValues[key.id] = ""
                  }
                })
                return { ...col, values: newValues }
              })
            }))
            
            // Step 2: Generate meaningful schema name using Solar Mini
            set((state) => ({ ...state, processingStep: 'naming-schema' }))
            
            try {
              const fieldNames = Object.keys(schemaData)
              const namingResponse = await makeAuthenticatedApiCall('/api/schema-naming', {
                method: 'POST',
                body: { fieldNames }
              })
              
              if (namingResponse.ok) {
                const namingData = await namingResponse.json()
                let suggestedTitle = namingData.suggestedTitle
                
                // Generate unique name if user is logged in
                if (userId && suggestedTitle) {
                  suggestedTitle = await generateUniqueProjectName(suggestedTitle, userId)
                }
                
                // Update title immediately after naming
                set((state) => ({
                  ...state,
                  sheetTitle: isFirstImage && state.sheetTitle === initialState.sheetTitle
                    ? suggestedTitle
                    : state.sheetTitle
                }))
                
                // Save template with schema if user is logged in
                if (userId) {
                  try {
                    await get().actions.saveProject(userId)
                  } catch (error) {
                    console.error('❌ Template save failed:', error)
                  }
                }
              } else {
                console.warn('⚠️ Schema naming failed, using default')
              }
            } catch (error) {
              console.error('❌ Error generating schema name:', error)
            }
            
            // Step 3: Extract information using the generated schema
            set((state) => ({ ...state, processingStep: 'extracting-values' }))
            
            extractedData = await extractInformationFromImage(file, newKeys)
            
            // Fill the table values immediately after extraction
            set((state) => {
              const updatedColumns = state.columns.map((col) => {
                if (col.id === columnId) {
                  const newValues = { ...col.values }
                  Object.entries(extractedData).forEach(([extractedKeyName, extractedValue]) => {
                    const keyObj = newKeys.find((k) => k.name === extractedKeyName)
                    if (keyObj) {
                      newValues[keyObj.id] = extractedValue
                    }
                  })
                  return { ...col, values: newValues }
                }
                return col
              })
              return { ...state, columns: updatedColumns }
            })
            
            // Save project after data extraction if user is logged in
            if (userId) {
              try {
                await get().actions.saveProject(userId)
              } catch (error) {
                console.error('❌ Save failed after extraction:', error)
              }
            }
          } else {
            // For subsequent images, use existing schema (keys) for extraction
            set((state) => ({ ...state, processingStep: 'extracting-values' }))
            const currentKeys = get().keys
            extractedData = await extractInformationFromImage(file, currentKeys)
            
            // Fill the table values immediately after extraction for subsequent images
            set((state) => {
              const updatedColumns = state.columns.map((col) => {
                if (col.id === columnId) {
                  const newValues = { ...col.values }
                  Object.entries(extractedData).forEach(([extractedKeyName, extractedValue]) => {
                    const keyObj = currentKeys.find((k) => k.name === extractedKeyName)
                    if (keyObj) {
                      newValues[keyObj.id] = extractedValue
                    }
                  })
                  return { ...col, values: newValues }
                }
                return col
              })
              return { ...state, columns: updatedColumns }
            })
            
            // Save project after additional image extraction if user is logged in
            if (userId) {
              try {
                await get().actions.saveProject(userId)
              } catch (error) {
                console.error('❌ Save failed after additional image:', error)
              }
            }
          }
        } catch (error) {
          console.error('❌ Error processing image:', error)
          set((state) => ({ ...state, isProcessing: false, processingStep: 'idle' }))
          throw error
        }

      // Final update: Mark as complete
      set((state) => ({
        ...state,
        isProcessing: false,
        processingStep: 'complete'
      }))
    },
    updateCellValue: (columnId, keyId, value) =>
      set((state) => ({
        columns: state.columns.map((col) =>
          col.id === columnId ? { ...col, values: { ...col.values, [keyId]: value } } : col,
        ),
      })),
    deleteColumn: async (columnId, userId) => {
      const state = get()
        const columnToDelete = state.columns.find((col) => col.id === columnId)
      
      if (columnToDelete) {
        // Clean up local blob URL if it exists
        if (columnToDelete.fileUrl && columnToDelete.fileUrl.startsWith('blob:')) {
          URL.revokeObjectURL(columnToDelete.fileUrl)
        }
        
        // If we have a current project, we need to delete from Firebase Storage
        if (state.currentProjectId && userId) {
          try {
            // Get the current project to find the storage path
            const currentProject = await getProject(state.currentProjectId)
            const fbColumn = currentProject?.columns.find(c => c.id === columnId)
            
            // Delete from Firebase Storage if storage path exists
            if (fbColumn?.storagePath) {
              await deleteImageFromStorage(fbColumn.storagePath)
            }
          } catch (error) {
            console.error('❌ Error deleting image from Firebase Storage:', error)
            // Continue with local deletion even if Storage deletion fails
          }
        }
      }
      
      // Update local state
      set((state) => ({
          columns: state.columns.filter((col) => col.id !== columnId),
      }))
      
      // Save the changes to Firebase if user is logged in
      if (userId) {
        try {
          await get().actions.saveProject(userId)
        } catch (error) {
          console.error('❌ Save failed after deletion:', error)
        }
      }
    },
    resetSheet: () => {
      set((state) => {
        state.columns.forEach((col) => {
          if (col.fileUrl) URL.revokeObjectURL(col.fileUrl)
        })
        return { ...initialState, processingStep: 'idle' as const }
      })
    },
    getCellValue: (columnId, keyId) => {
      const column = get().columns.find((col) => col.id === columnId)
      return column?.values[keyId] || ""
    },
    
    // Firebase actions
    saveProject: async (userId: string) => {
      const state = get()
      set((prevState) => ({ ...prevState, isSaving: true }))
      
      try {
        // Use existing project ID or generate new one for storage paths
        const projectId = state.currentProjectId || `temp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
        
        // Convert local columns to Firebase format with Storage upload
        const firebaseColumns: FirebaseImageColumn[] = await Promise.all(
          state.columns.map(async (col) => {
            let imageUrl = col.fileUrl
            let storagePath = ''
            
            // If it's a blob URL (local file), upload to Firebase Storage
            if (col.fileUrl?.startsWith('blob:')) {
              try {
                // Convert blob URL back to File object
                const response = await fetch(col.fileUrl)
                const blob = await response.blob()
                const file = new File([blob], col.fileName, { type: blob.type })
                
                // Upload to Firebase Storage
                const uploadResult = await uploadImageToStorage(file, userId, projectId, col.id)
                imageUrl = uploadResult.imageUrl
                storagePath = uploadResult.storagePath
              } catch (uploadError) {
                console.error('❌ Error uploading image to storage:', uploadError)
                // Keep original URL as fallback
              }
            }
            
            return {
              id: col.id,
              fileName: col.fileName,
              fileType: 'image/png', // Default, should be detected from file
              fileSize: 0, // Should be stored with file
              imageUrl,
              storagePath,
              values: col.values,
              uploadedAt: new Date() as any, // Will be converted to Timestamp by Firebase
            }
          })
        )
        
        const projectData = {
          title: state.sheetTitle,
          keys: state.keys,
          columns: firebaseColumns,
          isPublic: false,
        }
        
        if (state.currentProjectId) {
          // Update existing project
          await updateProject(state.currentProjectId, projectData)
          console.log('✅ Project updated in Firebase')
        } else {
          // Create new project
          const newProjectId = await saveProject(userId, projectData)
          set((prevState) => ({ ...prevState, currentProjectId: newProjectId }))
          console.log('✅ New project saved to Firebase:', newProjectId)
        }
        
        set((prevState) => ({ 
          ...prevState, 
          isSaving: false,
          lastSaved: new Date()
        }))
      } catch (error) {
        console.error('❌ Error saving project:', error)
        set((prevState) => ({ ...prevState, isSaving: false }))
        throw error
      }
    },
    
    loadProjectFromFirebase: async (projectId: string) => {
      try {
        console.log('🔄 Loading project from Firebase:', projectId)
        const project = await getProject(projectId)
        
        if (project) {
          // Convert Firebase project data to local format
          const localColumns: ImageColumn[] = project.columns.map((fbCol: FirebaseImageColumn) => ({
            id: fbCol.id,
            fileName: fbCol.fileName,
            fileUrl: fbCol.imageUrl, // Use Firebase Storage URL directly
            values: fbCol.values
          }))
          
          // Load project data into store
          set({
            sheetTitle: project.title,
            keys: project.keys,
            columns: localColumns,
            currentProjectId: projectId,
            isProcessing: false,
            processingStep: 'complete'
          })
          
          console.log('✅ Project loaded successfully:', project.title)
        } else {
          throw new Error('Project not found')
        }
      } catch (error) {
        console.error('❌ Error loading project:', error)
        throw error
      }
    },
  },
}))

import { 
  collection, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  getDocs,
  onSnapshot,
  serverTimestamp,
  Timestamp 
} from 'firebase/firestore'
import { 
  ref, 
  uploadBytes, 
  getDownloadURL, 
  deleteObject 
} from 'firebase/storage'
import { db, storage } from './firebase'

// TypeScript interfaces
export interface FirebaseImageColumn {
  id: string
  fileName: string
  fileType: string
  fileSize: number
  imageUrl: string // Firebase Storage download URL
  storagePath: string // Firebase Storage path for deletion
  values: Record<string, string>
  uploadedAt: Timestamp
}

export interface FirebaseProject {
  id: string
  userId: string
  title: string
  keys: Array<{ id: string; name: string }>
  columns: FirebaseImageColumn[]
  createdAt: Timestamp
  updatedAt: Timestamp
  isPublic: boolean
}

// Collections
const PROJECTS_COLLECTION = 'projects'
const USERS_COLLECTION = 'users'

// Storage paths
const IMAGES_STORAGE_PATH = 'project-images'

// Upload image to Firebase Storage
export const uploadImageToStorage = async (
  file: File,
  userId: string,
  projectId: string,
  columnId: string
): Promise<{ imageUrl: string; storagePath: string }> => {
  try {
    // Create a unique path for the image
    const timestamp = Date.now()
    const fileExtension = file.name.split('.').pop() || 'jpg'
    const storagePath = `${IMAGES_STORAGE_PATH}/${userId}/${projectId}/${columnId}_${timestamp}.${fileExtension}`
    
    // Create storage reference
    const storageRef = ref(storage, storagePath)
    
    // Upload file
    console.log('📤 Uploading image to Firebase Storage:', storagePath)
    const snapshot = await uploadBytes(storageRef, file)
    
    // Get download URL
    const imageUrl = await getDownloadURL(snapshot.ref)
    
    console.log('✅ Image uploaded successfully:', imageUrl)
    return { imageUrl, storagePath }
  } catch (error) {
    console.error('❌ Error uploading image to Firebase Storage:', error)
    throw error
  }
}

// Delete image from Firebase Storage
export const deleteImageFromStorage = async (storagePath: string): Promise<void> => {
  try {
    const storageRef = ref(storage, storagePath)
    await deleteObject(storageRef)
    console.log('✅ Image deleted from Firebase Storage:', storagePath)
  } catch (error) {
    console.error('❌ Error deleting image from Firebase Storage:', error)
    // Don't throw error for deletion failures to avoid blocking other operations
  }
}

// Save project to Firebase
export const saveProject = async (
  userId: string, 
  projectData: Omit<FirebaseProject, 'id' | 'userId' | 'createdAt' | 'updatedAt'>
): Promise<string> => {
  try {
    const projectRef = doc(collection(db, PROJECTS_COLLECTION))
    const projectId = projectRef.id
    
    const project: FirebaseProject = {
      ...projectData,
      id: projectId,
      userId,
      createdAt: serverTimestamp() as Timestamp,
      updatedAt: serverTimestamp() as Timestamp,
    }
    
    await setDoc(projectRef, project)
    console.log('✅ Project saved to Firebase:', projectId)
    return projectId
  } catch (error) {
    console.error('❌ Error saving project to Firebase:', error)
    throw error
  }
}

// Update existing project
export const updateProject = async (
  projectId: string,
  updates: Partial<Omit<FirebaseProject, 'id' | 'userId' | 'createdAt'>>
): Promise<void> => {
  try {
    const projectRef = doc(db, PROJECTS_COLLECTION, projectId)
    
    await updateDoc(projectRef, {
      ...updates,
      updatedAt: serverTimestamp(),
    })
    
    console.log('✅ Project updated in Firebase:', projectId)
  } catch (error) {
    console.error('❌ Error updating project in Firebase:', error)
    throw error
  }
}

// Get project by ID
export const getProject = async (projectId: string): Promise<FirebaseProject | null> => {
  try {
    const projectRef = doc(db, PROJECTS_COLLECTION, projectId)
    const projectDoc = await getDoc(projectRef)
    
    if (projectDoc.exists()) {
      return projectDoc.data() as FirebaseProject
    }
    
    return null
  } catch (error) {
    console.error('❌ Error getting project from Firebase:', error)
    throw error
  }
}

// Get all projects for a user
export const getUserProjects = async (userId: string): Promise<FirebaseProject[]> => {
  try {
    const projectsQuery = query(
      collection(db, PROJECTS_COLLECTION),
      where('userId', '==', userId),
      orderBy('updatedAt', 'desc')
    )
    
    const querySnapshot = await getDocs(projectsQuery)
    const projects: FirebaseProject[] = []
    
    querySnapshot.forEach((doc) => {
      projects.push(doc.data() as FirebaseProject)
    })
    
    console.log(`✅ Retrieved ${projects.length} projects for user:`, userId)
    return projects
  } catch (error) {
    console.error('❌ Error getting user projects from Firebase:', error)
    throw error
  }
}

// Listen to real-time updates for user projects
export const listenToUserProjects = (
  userId: string,
  callback: (projects: FirebaseProject[]) => void
): (() => void) => {
  try {
    const projectsQuery = query(
      collection(db, PROJECTS_COLLECTION),
      where('userId', '==', userId),
      orderBy('updatedAt', 'desc')
    )
    
    const unsubscribe = onSnapshot(projectsQuery, (querySnapshot) => {
      const projects: FirebaseProject[] = []
      
      querySnapshot.forEach((doc) => {
        const data = doc.data()
        // Only include projects with valid data
        if (data && data.title && data.userId) {
          projects.push(data as FirebaseProject)
        } else {
          console.warn('⚠️ Skipping invalid project data:', doc.id, data)
        }
      })
      
      console.log(`🔄 Real-time update: ${projects.length} projects for user:`, userId)
      callback(projects)
    }, (error) => {
      console.error('❌ Error listening to user projects:', error)
    })
    
    return unsubscribe
  } catch (error) {
    console.error('❌ Error setting up real-time listener:', error)
    return () => {}
  }
}

// Delete project
export const deleteProject = async (projectId: string): Promise<void> => {
  try {
    // First get the project to access image storage paths
    const project = await getProject(projectId)
    
    // Delete associated images from storage
    if (project && project.columns) {
      const deletePromises = project.columns.map(column => 
        deleteImageFromStorage(column.storagePath)
      )
      await Promise.allSettled(deletePromises) // Use allSettled to continue even if some deletions fail
    }
    
    // Delete the project document
    const projectRef = doc(db, PROJECTS_COLLECTION, projectId)
    await deleteDoc(projectRef)
    console.log('✅ Project deleted from Firebase:', projectId)
  } catch (error) {
    console.error('❌ Error deleting project from Firebase:', error)
    throw error
  }
}

// Add image column to project
export const addImageToProject = async (
  projectId: string,
  imageColumn: Omit<FirebaseImageColumn, 'uploadedAt'>
): Promise<void> => {
  try {
    const project = await getProject(projectId)
    if (!project) {
      throw new Error('Project not found')
    }
    
    const newImageColumn: FirebaseImageColumn = {
      ...imageColumn,
      uploadedAt: serverTimestamp() as Timestamp,
    }
    
    await updateProject(projectId, {
      columns: [...project.columns, newImageColumn],
    })
    
    console.log('✅ Image added to project:', projectId)
  } catch (error) {
    console.error('❌ Error adding image to project:', error)
    throw error
  }
}

// Convert File to base64 for storage
export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      // Remove the data:image/jpeg;base64, prefix and just store the base64 string
      const base64 = result.split(',')[1]
      resolve(base64)
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// Convert base64 back to data URL for display
export const base64ToDataUrl = (base64: string, mimeType: string): string => {
  return `data:${mimeType};base64,${base64}`
} 
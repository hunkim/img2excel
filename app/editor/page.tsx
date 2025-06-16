"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import {
  Download,
  BarChartBig,
  PlusCircle,
  Plus,
  Trash2,
  AlertTriangle,
  User,
  ChevronLeft,
  ChevronRight,
  Search,
  FileSpreadsheet,
  Calendar,
  GripVertical,
  ChevronDown,
  Copy,
  Bug,
} from "lucide-react"
import Image from "next/image"
import saveAs from "file-saver"
import { cn } from "@/lib/utils"
import { useSpreadsheetStore } from "@/store/spreadsheet-store"
import { ImageUploader } from "@/components/image-uploader"
import { AuthButton } from "@/components/auth-button"
import { useAuth } from "@/hooks/useAuth"
import { Spinner } from "@/components/ui/spinner"
import { listenToUserProjects, deleteProject as deleteFirebaseProject, getProject, type FirebaseProject } from "@/lib/firebase-service"
import { getUserProjects } from "@/lib/firebase-service"
import { ProjectsSidebar } from "@/components/projects-sidebar"

// Project interface for the sidebar
interface Project {
  id: string
  title: string
  createdAt: Date
  updatedAt: Date
  imageCount: number
  fieldCount: number
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

export default function EditorPage() {
  const router = useRouter()
  const { user, isAuthenticated } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null)
  const [deleteImageConfirmId, setDeleteImageConfirmId] = useState<string | null>(null)
  const deleteImageTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  // Use the actual Zustand store
  const sheetTitle = useSpreadsheetStore((state) => state.sheetTitle)
  const keys = useSpreadsheetStore((state) => state.keys)
  const columns = useSpreadsheetStore((state) => state.columns)

  const isProcessing = useSpreadsheetStore((state) => state.isProcessing)
  const processingStep = useSpreadsheetStore((state) => state.processingStep)
  const isSaving = useSpreadsheetStore((state) => state.isSaving)
  const lastSaved = useSpreadsheetStore((state) => state.lastSaved)
  const actions = useSpreadsheetStore((state) => state.actions)
  const processingRef = useRef(false)

  const handleSelectProject = async (projectId: string) => {
    try {
      setActiveProjectId(projectId)
      console.log("🔄 Loading project:", projectId)
      
      // Use the store's loadProjectFromFirebase method to load all project data
      await actions.loadProjectFromFirebase(projectId)
      console.log("✅ Project loaded successfully")
    } catch (error) {
      console.error("❌ Error loading project:", error)
      alert("Failed to load project. Please try again.")
    }
  }

  const handleDeleteImage = async (columnId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    
    if (deleteImageConfirmId === columnId) {
      // Second click - actually delete the image
      try {
        await actions.deleteColumn(columnId, user?.uid)
        setDeleteImageConfirmId(null)
        if (deleteImageTimeoutRef.current) {
          clearTimeout(deleteImageTimeoutRef.current)
          deleteImageTimeoutRef.current = null
        }
      } catch (error) {
        console.error('❌ Error deleting image:', error)
        alert('Failed to delete image. Please try again.')
        setDeleteImageConfirmId(null)
      }
    } else {
      // First click - show confirmation state
      setDeleteImageConfirmId(columnId)
      
      // Clear any existing timeout
      if (deleteImageTimeoutRef.current) {
        clearTimeout(deleteImageTimeoutRef.current)
      }
      
      // Auto-revert after 3 seconds
      deleteImageTimeoutRef.current = setTimeout(() => {
        setDeleteImageConfirmId(null)
        deleteImageTimeoutRef.current = null
      }, 3000)
    }
  }

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (deleteImageTimeoutRef.current) {
        clearTimeout(deleteImageTimeoutRef.current)
      }
    }
  }, [])

  const handleCreateNewProject = () => {
    // Clear current state and start fresh
    actions.resetSheet()
    setActiveProjectId(null)
  }

  const handleCreateFromTemplate = async (templateProject: Project) => {
    try {
      console.log('🔄 Creating project from template:', templateProject.title)
      
      // Load the template project to get its schema
      const templateData = await getProject(templateProject.id)
      if (!templateData) {
        throw new Error('Template project not found')
      }
      
      // Generate unique name using the new function
      const newProjectName = user?.uid 
        ? await generateUniqueProjectName(templateProject.title, user.uid)
        : `${templateProject.title} (Copy)`
      
      // Clear current state and set up new project with template schema
      actions.resetSheet()
      actions.setSheetTitle(newProjectName)
      
      // Copy the keys (schema) from template
      templateData.keys.forEach((key: any) => {
        actions.addKey(key.name)
      })
      
      setActiveProjectId(null) // Will be set when first image is processed and project is saved
      
      console.log('✅ Project created from template:', newProjectName)
    } catch (error) {
      console.error('❌ Error creating project from template:', error)
      alert('Failed to create project from template. Please try again.')
    }
  }

  const handleImageUpload = async (file: File) => {
    try {
      await actions.addImageColumn(file, user?.uid)
    } catch (error) {
      console.error("Error processing image:", error)
    }
  }

  const handleAddKey = () => {
    actions.addKey("New Column")
  }

  const downloadAsCSV = () => {
    // This function should only be called when keys.length > 0
    // since the button is disabled when there's no data
    let csvContent = ""
    const headerRow = keys.map((key) => key.name.replace(/,/g, "")).join(",")
    csvContent += headerRow + "\r\n"

    columns.forEach((column) => {
      const rowData = keys.map((key) => (column.values[key.id] || "").replace(/,/g, ""))
      csvContent += rowData.join(",") + "\r\n"
    })

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const safeSheetTitle = sheetTitle.replace(/[^a-z0-9]/gi, "_").toLowerCase() || "spreadsheet"
    saveAs(blob, `${safeSheetTitle}.csv`)
  }

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-900 overflow-hidden">
      <ProjectsSidebar
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        onProjectSelect={handleSelectProject}
        onNewProject={handleCreateNewProject}
        onCreateFromTemplate={handleCreateFromTemplate}
      />

            {/* Main Content */}
      <div className="flex flex-col flex-1 h-full overflow-hidden">
        {/* Fixed Header */}
        <header className="flex-shrink-0 p-2 sm:p-3 border-b dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm flex items-center justify-between z-10">
          <div className="flex items-center gap-1 sm:gap-2 min-w-0 flex-1">
            <button 
              onClick={() => {
                // Clear current spreadsheet state when going home (fresh start)
                actions.resetSheet()
                router.push('/')
              }}
              className="flex items-center gap-1 sm:gap-2 hover:opacity-80 transition-opacity cursor-pointer flex-shrink-0"
              title="Go to Home - Start Fresh"
            >
              <BarChartBig className="h-5 w-5 sm:h-7 sm:w-7 text-primary" />
              <span className="text-sm sm:text-lg font-bold text-slate-800 dark:text-slate-200 hidden xs:inline">img2excel</span>
            </button>
            <a
              href="https://github.com/hunkim/img2excel/issues"
              target="_blank"
              rel="noopener noreferrer"
              className="ml-0.5 sm:ml-1 p-1 sm:p-1.5 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex-shrink-0"
              title="Report an issue"
            >
              <Bug className="h-3 w-3 sm:h-4 sm:w-4 text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200" />
            </a>
            <div className="w-px h-4 sm:h-6 bg-slate-300 dark:bg-slate-600 mx-1 sm:mx-2 hidden xs:block" />
            <Input
              type="text"
              value={sheetTitle}
              onChange={(e) => actions.setSheetTitle(e.target.value)}
              placeholder="Spreadsheet Title"
              className="text-sm sm:text-lg font-semibold border-0 focus-visible:ring-1 focus-visible:ring-primary w-full min-w-0 max-w-[120px] xs:max-w-xs sm:max-w-md"
            />
          </div>
          <div className="flex items-center space-x-1 sm:space-x-2 flex-shrink-0">
            {isAuthenticated && (
              <div className="text-xs text-muted-foreground px-1 sm:px-2 hidden sm:block">
                {isSaving ? (
                  <span className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                    Auto-saving...
                  </span>
                ) : lastSaved ? (
                  <span className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-green-500 rounded-full" />
                    <span className="hidden md:inline">Saved </span>{new Date(lastSaved).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                ) : null}
              </div>
            )}
            <Button 
              variant="outline" 
              size="sm" 
              onClick={downloadAsCSV} 
              disabled={keys.length === 0}
              className="text-xs sm:text-sm"
              title={keys.length === 0 ? "No data to download" : "Download data as CSV file"}
            >
              <Download className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
              <span className="hidden sm:inline">Download CSV</span>
            </Button>
            <AuthButton />
          </div>
        </header>

        {/* Fixed Image Thumbnail Bar */}
        <div className="flex-shrink-0 p-2 border-b dark:border-slate-700 bg-white dark:bg-slate-800">
          <ScrollArea className="w-full whitespace-nowrap">
            <div className="flex items-center space-x-2 sm:space-x-3 pb-2 sm:pb-3">
              {/* Upload Button - Always First */}
              <div className="relative h-16 w-16 sm:h-20 sm:w-20 md:h-24 md:w-24 flex flex-col items-center justify-center shrink-0 border-2 border-dashed border-primary/30 hover:border-primary/60 rounded-lg bg-primary/5 hover:bg-primary/10 transition-all duration-200 group">
                {isProcessing ? (
                  <div className="flex flex-col items-center gap-0.5 sm:gap-1">
                    <Spinner size="sm" className="text-primary sm:w-5 sm:h-5" />
                    <div className="text-[10px] sm:text-xs text-muted-foreground text-center leading-tight">
                      {processingStep === 'generating-schema' ? 'Schema...' : 
                       processingStep === 'naming-schema' ? 'Naming...' :
                       processingStep === 'extracting-values' ? 'Values...' : 
                       'Processing...'}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-0.5 sm:gap-1">
                    <PlusCircle className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6 text-primary group-hover:text-primary/80 transition-colors" />
                    <span className="text-[10px] sm:text-xs font-medium text-primary group-hover:text-primary/80 transition-colors text-center leading-tight">Add Image</span>
                  </div>
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) {
                      handleImageUpload(file)
                      e.target.value = '' // Reset input
                    }
                  }}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
              </div>
              
              {/* Image Thumbnails */}
              {columns.map((col) => (
                <div
                  key={col.id}
                  className="relative group shrink-0 w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 rounded-md overflow-hidden border dark:border-slate-600 shadow-sm"
                >
                  <Image src={col.fileUrl || "/placeholder.svg"} alt={col.fileName} fill className="object-cover" />
                  <div className="absolute bottom-0 left-0 right-0 bg-black/50 p-0.5 sm:p-1 text-[10px] sm:text-xs text-white truncate">
                    {col.fileName}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                      "absolute top-0.5 right-0.5 sm:top-1 sm:right-1 h-5 w-5 sm:h-6 sm:w-6 text-white opacity-0 group-hover:opacity-100 transition-all duration-200",
                      deleteImageConfirmId === col.id 
                        ? "bg-orange-500 hover:bg-orange-600 opacity-100" 
                        : "bg-red-500 hover:bg-red-600"
                    )}
                    onClick={(e) => handleDeleteImage(col.id, e)}
                  >
                    {deleteImageConfirmId === col.id ? (
                      <AlertTriangle className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                    ) : (
                      <Trash2 className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                    )}
                  </Button>
                </div>
              ))}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
          
          {/* Processing Status */}
          {isProcessing ? (
            <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-md border border-blue-200 dark:border-blue-800">
              {processingStep === 'generating-schema' && (
                <>
                  <div className="flex items-center gap-2">
                    <Spinner size="sm" className="text-blue-600" />
                    <p className="text-xs sm:text-sm font-medium text-blue-800 dark:text-blue-200">🧠 Step 1: Analyzing image structure...</p>
                  </div>
                  <p className="text-[10px] sm:text-xs text-blue-600 dark:text-blue-300">AI is discovering data fields in your first image</p>
                </>
              )}
              {processingStep === 'naming-schema' && (
                <>
                  <div className="flex items-center gap-2">
                    <Spinner size="sm" className="text-blue-600" />
                    <p className="text-xs sm:text-sm font-medium text-blue-800 dark:text-blue-200">🏷️ Step 2: Generating schema name...</p>
                  </div>
                  <p className="text-[10px] sm:text-xs text-blue-600 dark:text-blue-300">AI is creating a meaningful title for your data</p>
                </>
              )}
              {processingStep === 'extracting-values' && (
                <>
                  <div className="flex items-center gap-2">
                    <Spinner size="sm" className="text-blue-600" />
                    <p className="text-xs sm:text-sm font-medium text-blue-800 dark:text-blue-200">🔍 Step 3: Extracting data values...</p>
                  </div>
                  <p className="text-[10px] sm:text-xs text-blue-600 dark:text-blue-300">AI is reading and organizing the information</p>
                </>
              )}
              {processingStep === 'idle' && (
                <>
                  <div className="flex items-center gap-2">
                    <Spinner size="sm" className="text-blue-600" />
                    <p className="text-xs sm:text-sm font-medium text-blue-800 dark:text-blue-200">🤖 Processing your image...</p>
                  </div>
                  <p className="text-[10px] sm:text-xs text-blue-600 dark:text-blue-300">Getting ready to analyze</p>
                </>
              )}
            </div>
          ) : columns.length > 0 ? (
            <div className="mt-2 p-2 bg-green-50 dark:bg-green-900/20 rounded-md border border-green-200 dark:border-green-800">
              <p className="text-xs sm:text-sm font-medium text-green-800 dark:text-green-200">✅ Images processed successfully!</p>
              <p className="text-[10px] sm:text-xs text-green-600 dark:text-green-300">Extracted data from {columns.length} image(s) using AI</p>
            </div>
          ) : null}
        </div>

        {/* Scrollable Table Area with Explicit Scrollbar */}
        <main className="flex-1 min-h-0 bg-slate-50 dark:bg-slate-900">
          <div className="h-full p-2 sm:p-4">
            <div className="h-full bg-white dark:bg-slate-800 rounded-lg shadow-sm border dark:border-slate-700 overflow-hidden">
              <div className="h-full overflow-auto">
                <Table className="min-w-full">
                  <TableHeader className="bg-slate-50 dark:bg-slate-800/50 sticky top-0 z-10">
                    <TableRow>
                      {keys.map((key) => (
                        <TableHead key={key.id} className="min-w-[120px] sm:min-w-[150px] bg-slate-50 dark:bg-slate-800/50">
                          <Input
                            type="text"
                            value={key.name}
                            onChange={(e) => actions.updateKeyName(key.id, e.target.value)}
                            className="h-8 sm:h-9 border-0 focus-visible:ring-1 focus-visible:ring-primary px-1 sm:px-2 font-semibold bg-transparent text-sm sm:text-base"
                          />
                        </TableHead>
                      ))}
                      <TableHead className="w-[40px] sm:w-[50px] bg-slate-50 dark:bg-slate-800/50">
                        <Button variant="ghost" size="icon" className="h-7 w-7 sm:h-8 sm:w-8" onClick={handleAddKey}>
                          <Plus className="h-3 w-3 sm:h-4 sm:w-4" />
                        </Button>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {columns.map((col) => (
                      <TableRow key={col.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        {keys.map((key) => (
                          <TableCell key={key.id} className="p-1 sm:p-2">
                            <div className="relative">
                              <Input
                                type="text"
                                value={col.values[key.id] || ""}
                                onChange={(e) => actions.updateCellValue(col.id, key.id, e.target.value)}
                                className="h-8 sm:h-9 border-0 focus-visible:ring-1 focus-visible:ring-primary px-1 sm:px-2 bg-transparent text-sm sm:text-base"
                                placeholder={isProcessing && !col.values[key.id] ? "..." : ""}
                              />
                              {isProcessing && !col.values[key.id] && (
                                <div className="absolute right-1 sm:right-2 top-1/2 transform -translate-y-1/2">
                                  <Spinner size="sm" className="text-muted-foreground/50" />
                                </div>
                              )}
                            </div>
                          </TableCell>
                        ))}
                        <TableCell className="p-1 sm:p-2">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className={cn(
                              "h-6 w-6 sm:h-7 sm:w-7 transition-all duration-200 touch-manipulation",
                              deleteImageConfirmId === col.id && "bg-orange-100 hover:bg-orange-200"
                            )}
                            onClick={(e) => handleDeleteImage(col.id, e)}
                          >
                            {deleteImageConfirmId === col.id ? (
                              <AlertTriangle className="h-3 w-3 text-orange-500" />
                            ) : (
                              <Trash2 className="h-3 w-3 text-destructive" />
                            )}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

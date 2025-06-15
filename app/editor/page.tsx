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

// Project interface for the sidebar
interface Project {
  id: string
  title: string
  createdAt: Date
  updatedAt: Date
  imageCount: number
  fieldCount: number
}

export default function EditorPage() {
  const router = useRouter()
  const { user, isAuthenticated } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const deleteTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const [deleteImageConfirmId, setDeleteImageConfirmId] = useState<string | null>(null)
  const deleteImageTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const [sidebarWidth, setSidebarWidth] = useState(320) // Default 320px
  const [isResizing, setIsResizing] = useState(false)
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

  // Load projects from Firebase with real-time updates
  useEffect(() => {
    if (isAuthenticated && user) {
      setLoading(true)
      
      // Set up real-time listener for user projects
      const unsubscribe = listenToUserProjects(user.uid, (firebaseProjects: FirebaseProject[]) => {
        console.log('🔄 Editor sidebar received update:', firebaseProjects.length, 'projects')
        
        // Convert Firebase projects to local Project format
        const projects: Project[] = firebaseProjects.map((fbProject) => ({
          id: fbProject.id,
          title: fbProject.title,
          createdAt: fbProject.createdAt 
            ? (fbProject.createdAt instanceof Date ? fbProject.createdAt : fbProject.createdAt.toDate())
            : new Date(),
          updatedAt: fbProject.updatedAt 
            ? (fbProject.updatedAt instanceof Date ? fbProject.updatedAt : fbProject.updatedAt.toDate())
            : new Date(),
          imageCount: fbProject.columns?.length || 0,
          fieldCount: fbProject.keys?.length || 0
        }))
        
        console.log('✅ Converted projects for editor sidebar:', projects)
        setProjects(projects)
        setLoading(false)
        
        // Set active project to the most recent one if none selected
        if (!activeProjectId && projects.length > 0) {
          setActiveProjectId(projects[0].id)
        }
        
        // Auto-open sidebar on desktop if user has projects
        if (projects.length > 0 && typeof window !== 'undefined' && window.innerWidth >= 1024) {
          setSidebarOpen(true)
        }
      })
      
      // Cleanup listener on unmount
      return () => {
        unsubscribe()
      }
    } else {
      setProjects([])
      setLoading(false)
    }
  }, [isAuthenticated, user])



  const formatDate = (date: Date) => {
    const now = new Date()
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60)

    if (diffInHours < 24) {
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    } else if (diffInHours < 24 * 7) {
      return date.toLocaleDateString([], { weekday: "short" })
    } else {
      return date.toLocaleDateString([], { month: "short", day: "numeric" })
    }
  }

  const filteredProjects = projects.filter((project) =>
    project.title.toLowerCase().includes(searchQuery.toLowerCase()),
  )

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

  const handleDeleteProject = async (projectId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    
    if (deleteConfirmId === projectId) {
      // Second click - actually delete the project
      try {
        await deleteFirebaseProject(projectId)
        // The real-time listener will automatically update the projects list
        if (activeProjectId === projectId && projects.length > 1) {
          const remainingProjects = projects.filter((p) => p.id !== projectId)
          setActiveProjectId(remainingProjects[0].id)
        }
        setDeleteConfirmId(null)
        if (deleteTimeoutRef.current) {
          clearTimeout(deleteTimeoutRef.current)
          deleteTimeoutRef.current = null
        }
      } catch (error) {
        console.error('❌ Error deleting project:', error)
        alert('Failed to delete project. Please try again.')
        setDeleteConfirmId(null)
      }
    } else {
      // First click - show confirmation state
      setDeleteConfirmId(projectId)
      
      // Clear any existing timeout
      if (deleteTimeoutRef.current) {
        clearTimeout(deleteTimeoutRef.current)
      }
      
      // Auto-revert after 3 seconds
      deleteTimeoutRef.current = setTimeout(() => {
        setDeleteConfirmId(null)
        deleteTimeoutRef.current = null
      }, 3000)
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

  // Resize functionality
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsResizing(true)
    e.preventDefault()
  }, [])

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing) return
    
    const newWidth = e.clientX
    // Constrain width between 240px and 600px
    const constrainedWidth = Math.min(Math.max(newWidth, 240), 600)
    setSidebarWidth(constrainedWidth)
  }, [isResizing])

  const handleMouseUp = useCallback(() => {
    setIsResizing(false)
  }, [])

  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
      }
    }
  }, [isResizing, handleMouseMove, handleMouseUp])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (deleteTimeoutRef.current) {
        clearTimeout(deleteTimeoutRef.current)
      }
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

  const generateUniqueProjectName = (baseName: string, existingProjects: Project[]): string => {
    const existingNames = existingProjects.map(p => p.title.toLowerCase())
    const baseNameLower = baseName.toLowerCase()
    
    // If base name doesn't exist, use it
    if (!existingNames.includes(baseNameLower)) {
      return baseName
    }
    
    // Find the highest number suffix
    let maxNumber = 1
    const pattern = new RegExp(`^${baseNameLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\((\\d+)\\)$`)
    
    existingNames.forEach(name => {
      const match = name.match(pattern)
      if (match) {
        const num = parseInt(match[1])
        if (num > maxNumber) {
          maxNumber = num
        }
      }
    })
    
    return `${baseName} (${maxNumber + 1})`
  }

  const handleCreateFromTemplate = async (templateProject: Project) => {
    try {
      console.log('🔄 Creating project from template:', templateProject.title)
      
      // Load the template project to get its schema
      const templateData = await getProject(templateProject.id)
      if (!templateData) {
        throw new Error('Template project not found')
      }
      
      // Generate unique name
      const newProjectName = generateUniqueProjectName(templateProject.title, projects)
      
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
    if (keys.length === 0) {
      alert("No data to download.")
      return
    }

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
      {/* Mobile Overlay */}
      {isAuthenticated && sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar Panel */}
      {isAuthenticated && sidebarOpen && (
        <div 
          className={cn(
            "bg-white dark:bg-slate-900 border-r dark:border-slate-700 flex flex-col relative z-50",
            "fixed lg:relative inset-y-0 left-0 w-80 lg:w-auto"
          )}
          style={{ width: typeof window !== 'undefined' && window.innerWidth >= 1024 ? `${sidebarWidth}px` : '320px' }}
        >
          {/* Header */}
          <div className="p-3 border-b dark:border-slate-700 flex items-center justify-between">
            <h2 className="font-semibold text-sm text-slate-700 dark:text-slate-300">My Projects</h2>
            <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(false)} className="h-6 w-6">
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </div>

          {/* New Project Dropdown */}
          <div className="p-3 border-b dark:border-slate-700">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button className="w-full justify-between" size="sm">
                  <div className="flex items-center">
                    <Plus className="h-4 w-4 mr-2" />
                    New Project
                  </div>
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuItem onClick={handleCreateNewProject}>
              <Plus className="h-4 w-4 mr-2" />
              New Template
                </DropdownMenuItem>
                {projects.length > 0 && (
                  <>
                    <DropdownMenuSeparator />
                    {projects.slice(0, 10).map((project) => (
                      <DropdownMenuItem 
                        key={project.id}
                        onClick={() => handleCreateFromTemplate(project)}
                      >
                        <Copy className="h-4 w-4 mr-2" />
                        <div className="flex-1 min-w-0">
                          <div className="truncate">{project.title}</div>
                          <div className="text-xs text-muted-foreground">
                            {project.fieldCount} fields
                          </div>
                        </div>
                      </DropdownMenuItem>
                    ))}
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Search */}
          <div className="p-3 border-b dark:border-slate-700">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search projects..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-8"
              />
            </div>
          </div>

          {/* Projects List */}
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              {loading ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  Loading projects...
                </div>
              ) : filteredProjects.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  {searchQuery ? "No projects found" : "No projects yet"}
                </div>
              ) : (
                filteredProjects.map((project) => (
                  <div
                    key={project.id}
                    className={cn(
                      "group relative p-2 rounded-md cursor-pointer transition-colors",
                      "hover:bg-slate-100 dark:hover:bg-slate-800",
                      activeProjectId === project.id && "bg-slate-100 dark:bg-slate-800",
                    )}
                    onClick={() => handleSelectProject(project.id)}
                  >
                    <div className="flex items-start gap-2">
                      <FileSpreadsheet className="h-4 w-4 mt-0.5 text-slate-500 dark:text-slate-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate text-slate-900 dark:text-slate-100">
                          {project.title}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                          <Calendar className="h-3 w-3" />
                          <span>{formatDate(project.updatedAt)}</span>
                          <span>•</span>
                          <span>{project.imageCount} images</span>
                          <span>•</span>
                          <span>{project.fieldCount} fields</span>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className={cn(
                          "h-6 w-6 opacity-0 group-hover:opacity-100 transition-all duration-200",
                          deleteConfirmId === project.id && "opacity-100 bg-destructive text-destructive-foreground"
                        )}
                        onClick={(e) => handleDeleteProject(project.id, e)}
                      >
                        {deleteConfirmId === project.id ? (
                          <AlertTriangle className="h-3.5 w-3.5 text-orange-500" />
                        ) : (
                        <Trash2 className="h-3 w-3 text-destructive" />
                        )}
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>

          {/* Footer */}
          <div className="p-3 border-t dark:border-slate-700 text-xs text-muted-foreground">
            {projects.length} project{projects.length !== 1 ? "s" : ""}
          </div>

          {/* Resize Handle */}
          <div
            className="absolute right-0 top-0 bottom-0 w-1 bg-transparent hover:bg-blue-500 cursor-col-resize group transition-colors"
            onMouseDown={handleMouseDown}
          >
            <div className="absolute right-0 top-1/2 -translate-y-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="bg-blue-500 text-white p-1 rounded shadow-lg">
                <GripVertical className="h-3 w-3" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sidebar Toggle Button (when closed) */}
      {isAuthenticated && !sidebarOpen && (
        <div className="fixed left-2 top-4 z-40">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setSidebarOpen(true)}
            className="h-8 w-8 bg-white dark:bg-slate-800 shadow-md"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

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
            <Button variant="outline" size="sm" onClick={downloadAsCSV} className="text-xs sm:text-sm">
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

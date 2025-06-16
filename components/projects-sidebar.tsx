"use client"

import React, { useState, useEffect, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { 
  ChevronLeft, 
  ChevronRight, 
  Search, 
  FileSpreadsheet, 
  Calendar,
  Trash2,
  AlertTriangle,
  Plus,
  GripVertical,
  ChevronDown,
  Copy
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useAuth } from "@/hooks/useAuth"
import { listenToUserProjects, deleteProject as deleteFirebaseProject, type FirebaseProject } from "@/lib/firebase-service"

interface Project {
  id: string
  title: string
  createdAt: Date
  updatedAt: Date
  imageCount: number
  fieldCount: number
}

interface ProjectsSidebarProps {
  isOpen: boolean
  onToggle: () => void
  onProjectSelect: (projectId: string) => void
  onNewProject: () => void
  onCreateFromTemplate?: (templateProject: Project) => void
  onWidthChange?: (width: number) => void
}

export function ProjectsSidebar({ 
  isOpen, 
  onToggle, 
  onProjectSelect, 
  onNewProject,
  onCreateFromTemplate,
  onWidthChange
}: ProjectsSidebarProps) {
  const { user, isAuthenticated } = useAuth()
  const [projects, setProjects] = useState<Project[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [loading, setLoading] = useState(false)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const deleteTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const [sidebarWidth, setSidebarWidth] = useState(320) // Default 320px (80 * 4)
  const [isResizing, setIsResizing] = useState(false)
  const resizeRef = useRef<HTMLDivElement>(null)

  // Load projects from Firebase with real-time updates
  useEffect(() => {
    if (isAuthenticated && user) {
      setLoading(true)
      
      // Set up real-time listener for user projects
      const unsubscribe = listenToUserProjects(user.uid, (firebaseProjects: FirebaseProject[]) => {
        console.log('🔄 Projects sidebar received update:', firebaseProjects.length, 'projects')
        console.log('📋 Projects data:', firebaseProjects)
        
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
        
        console.log('✅ Converted projects for sidebar:', projects)
        setProjects(projects)
        setLoading(false)
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
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const dateToCheck = new Date(date.getFullYear(), date.getMonth(), date.getDate())
    
    // If it's today, show time (e.g., "05:32 PM")
    if (dateToCheck.getTime() === today.getTime()) {
      return date.toLocaleTimeString([], { 
        hour: "2-digit", 
        minute: "2-digit",
        hour12: true 
      })
    }
    
    // If it's this year, show month and day (e.g., "Dec 15")
    if (date.getFullYear() === now.getFullYear()) {
      return date.toLocaleDateString([], { 
        month: "short", 
        day: "numeric" 
      })
    }
    
    // If it's a different year, show month, day, and year (e.g., "Dec 15, 2023")
    return date.toLocaleDateString([], { 
      month: "short", 
      day: "numeric",
      year: "numeric"
    })
  }

  const filteredProjects = projects.filter((project) =>
    project.title.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleDeleteProject = async (projectId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    
    if (deleteConfirmId === projectId) {
      // Second click - actually delete the project
      try {
        await deleteFirebaseProject(projectId)
        // The real-time listener will automatically update the projects list
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
    onWidthChange?.(constrainedWidth)
  }, [isResizing, onWidthChange])

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
    }
  }, [])

  if (!isAuthenticated) {
    return null
  }

  return (
    <>
      {/* Sidebar - Now works within ResizablePanel */}
      <div
        ref={resizeRef}
        className="h-full bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-700 flex"
      >
        {/* Sidebar Content */}
        <div className="flex-1 flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-3 sm:p-4 border-b border-slate-200 dark:border-slate-700">
            <h2 className="text-lg sm:text-xl font-semibold text-slate-900 dark:text-slate-100">My Projects</h2>
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggle}
              className="h-8 w-8 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </div>

          {/* New Project Dropdown */}
          <div className="p-3 sm:p-4 border-b border-slate-200 dark:border-slate-700">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button className="w-full justify-between" size="sm">
                  <div className="flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    New Project
                  </div>
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuItem onClick={onNewProject}>
                  <Plus className="h-4 w-4 mr-2" />
                  New Template
                </DropdownMenuItem>
                {projects.length > 0 && (
                  <>
                    <DropdownMenuSeparator />
                    {projects.slice(0, 5).map((project) => (
                      <DropdownMenuItem
                        key={project.id}
                        onClick={() => onCreateFromTemplate?.(project)}
                        className="flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <Copy className="h-3 w-3 flex-shrink-0" />
                          <span className="truncate text-xs">{project.title}</span>
                        </div>
                        <span className="text-xs text-muted-foreground ml-2 flex-shrink-0">
                          {project.fieldCount} fields
                        </span>
                      </DropdownMenuItem>
                    ))}
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Search */}
          <div className="p-3 sm:p-4 border-b border-slate-200 dark:border-slate-700">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search projects..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 text-sm"
              />
            </div>
          </div>

          {/* Projects List */}
          <ScrollArea className="flex-1">
            <div className="p-2 sm:p-3 space-y-1">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="text-sm text-muted-foreground">Loading projects...</div>
                </div>
              ) : filteredProjects.length === 0 ? (
                <div className="flex items-center justify-center py-8">
                  <div className="text-sm text-muted-foreground">
                    {searchQuery ? "No projects found" : "No projects yet"}
                  </div>
                </div>
              ) : (
                filteredProjects.map((project) => (
                  <div
                    key={project.id}
                    className={cn(
                      "group relative p-2 sm:p-3 rounded-md cursor-pointer transition-colors touch-manipulation",
                      "hover:bg-slate-100 dark:hover:bg-slate-800"
                    )}
                    onClick={() => onProjectSelect(project.id)}
                  >
                    <div className="flex items-start gap-3 sm:gap-4">
                      <div 
                        className="relative flex-shrink-0 mt-0.5 w-5 h-5 sm:w-6 sm:h-6"
                        onClick={(e) => handleDeleteProject(project.id, e)}
                      >
                        {deleteConfirmId === project.id ? (
                          <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 text-orange-500 transition-all duration-200" />
                        ) : (
                          <FileSpreadsheet className="h-4 w-4 sm:h-5 sm:w-5 text-slate-500 dark:text-slate-400 group-hover:hidden transition-all duration-200" />
                        )}
                        <Trash2 className="h-4 w-4 sm:h-5 sm:w-5 text-destructive hidden group-hover:block transition-all duration-200 absolute top-0 left-0" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-xs sm:text-sm truncate text-slate-900 dark:text-slate-100">
                          {project.title}
                        </div>
                        <div className="flex items-center gap-1 sm:gap-2 text-[10px] sm:text-xs text-muted-foreground mt-1">
                          <Calendar className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                          <span>{formatDate(project.updatedAt)}</span>
                          <span>•</span>
                          <span>{project.imageCount} images</span>
                          <span>•</span>
                          <span>{project.fieldCount} fields</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>

          {/* Footer */}
          <div className="p-3 sm:p-4 border-t border-slate-200 dark:border-slate-700 text-center">
            <div className="text-xs text-muted-foreground">
              {filteredProjects.length} project{filteredProjects.length !== 1 ? 's' : ''}
            </div>
          </div>
        </div>


      </div>


    </>
  )
} 
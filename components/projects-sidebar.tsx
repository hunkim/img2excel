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
}

export function ProjectsSidebar({ 
  isOpen, 
  onToggle, 
  onProjectSelect, 
  onNewProject,
  onCreateFromTemplate
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
    }
  }, [])

  if (!isAuthenticated) {
    return null
  }

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onToggle}
        />
      )}

      {/* Sidebar */}
      {isOpen && (
        <div 
          ref={resizeRef}
          className={cn(
            "fixed left-0 top-0 h-full bg-white dark:bg-slate-900 border-r dark:border-slate-700 flex flex-col z-50 shadow-xl",
            "w-80 lg:w-auto"
          )}
          style={{ width: typeof window !== 'undefined' && window.innerWidth >= 1024 ? `${sidebarWidth}px` : '320px' }}
        >
          {/* Header */}
          <div className="p-3 sm:p-4 border-b dark:border-slate-700 flex items-center justify-between">
            <h2 className="font-semibold text-base sm:text-lg text-slate-700 dark:text-slate-300">My Projects</h2>
            <Button variant="ghost" size="icon" onClick={onToggle} className="h-7 w-7 sm:h-8 sm:w-8">
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </div>

          {/* New Project Dropdown */}
          <div className="p-3 sm:p-4 border-b dark:border-slate-700">
            {onCreateFromTemplate ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button className="w-full justify-between text-sm" size="sm">
                    <div className="flex items-center">
                      <Plus className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
                      New Project
                    </div>
                    <ChevronDown className="h-3 w-3 sm:h-4 sm:w-4" />
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
                      {projects.slice(0, 10).map((project) => (
                        <DropdownMenuItem 
                          key={project.id}
                          onClick={() => onCreateFromTemplate(project)}
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
            ) : (
              <Button onClick={onNewProject} className="w-full justify-start" size="sm">
                <Plus className="h-4 w-4 mr-2" />
                New Project
              </Button>
            )}
          </div>

          {/* Search */}
          <div className="p-3 sm:p-4 border-b dark:border-slate-700">
            <div className="relative">
              <Search className="absolute left-2 sm:left-3 top-2 sm:top-2.5 h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
              <Input
                placeholder="Search projects..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-7 sm:pl-9 h-8 sm:h-9 text-sm"
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
                      "group relative p-2 sm:p-3 rounded-md cursor-pointer transition-colors touch-manipulation",
                      "hover:bg-slate-100 dark:hover:bg-slate-800"
                    )}
                    onClick={() => onProjectSelect(project.id)}
                  >
                    <div className="flex items-start gap-2 sm:gap-3">
                      <Button
                        variant="ghost"
                        size="icon"
                        className={cn(
                          "h-5 w-5 sm:h-6 sm:w-6 opacity-0 group-hover:opacity-100 transition-all duration-200 flex-shrink-0 touch-manipulation",
                          deleteConfirmId === project.id && "opacity-100 bg-destructive text-destructive-foreground"
                        )}
                        onClick={(e) => handleDeleteProject(project.id, e)}
                      >
                        {deleteConfirmId === project.id ? (
                          <AlertTriangle className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-orange-500" />
                        ) : (
                          <Trash2 className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-destructive" />
                        )}
                      </Button>
                      <FileSpreadsheet className="h-4 w-4 sm:h-5 sm:w-5 mt-0.5 text-slate-500 dark:text-slate-400 flex-shrink-0" />
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
          <div className="p-3 sm:p-4 border-t dark:border-slate-700 text-[10px] sm:text-xs text-muted-foreground">
            {projects.length} project{projects.length !== 1 ? "s" : ""}
          </div>

          {/* Resize Handle - Hidden on mobile */}
          <div
            className="absolute right-0 top-0 bottom-0 w-1 bg-transparent hover:bg-blue-500 cursor-col-resize group transition-colors hidden lg:block"
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

      {/* Toggle Button (when closed) */}
      {!isOpen && isAuthenticated && (
        <div className="fixed left-2 sm:left-4 top-2 sm:top-4 z-40">
          <Button
            variant="outline"
            size="icon"
            onClick={onToggle}
            className="h-8 w-8 sm:h-10 sm:w-10 bg-white dark:bg-slate-800 shadow-lg hover:shadow-xl transition-shadow touch-manipulation"
          >
            <ChevronRight className="h-3 w-3 sm:h-4 sm:w-4" />
          </Button>
        </div>
      )}
    </>
  )
} 
"use client"

import React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Input } from "@/components/ui/input"
import { ChevronLeft, ChevronRight, Search, FileSpreadsheet, Trash2, Plus, Calendar } from "lucide-react"
import { cn } from "@/lib/utils"

interface ExcelTemplate {
  id: string
  title: string
  createdAt: Date
  updatedAt: Date
  rowCount: number
  columnCount: number
}

interface SidebarPanelProps {
  isOpen: boolean
  onToggle: () => void
  templates: ExcelTemplate[]
  activeTemplateId?: string
  onSelectTemplate: (templateId: string) => void
  onDeleteTemplate: (templateId: string) => void
  onCreateNew: () => void
}

export function SidebarPanel({
  isOpen,
  onToggle,
  templates,
  activeTemplateId,
  onSelectTemplate,
  onDeleteTemplate,
  onCreateNew,
}: SidebarPanelProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [sidebarWidth, setSidebarWidth] = useState(280)
  const [isResizing, setIsResizing] = useState(false)

  const filteredTemplates = templates.filter((template) =>
    template.title.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsResizing(true)
    e.preventDefault()
  }

  const handleMouseMove = (e: MouseEvent) => {
    if (!isResizing) return
    const newWidth = e.clientX
    if (newWidth >= 200 && newWidth <= 500) {
      setSidebarWidth(newWidth)
    }
  }

  const handleMouseUp = () => {
    setIsResizing(false)
  }

  // Add event listeners for resizing
  React.useEffect(() => {
    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove)
      document.addEventListener("mouseup", handleMouseUp)
      return () => {
        document.removeEventListener("mousemove", handleMouseMove)
        document.removeEventListener("mouseup", handleMouseUp)
      }
    }
  }, [isResizing])

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

  if (!isOpen) {
    return (
      <div className="fixed left-0 top-0 h-full z-40 flex items-center">
        <Button
          variant="outline"
          size="icon"
          onClick={onToggle}
          className="ml-2 h-8 w-8 bg-white dark:bg-slate-800 shadow-md"
          aria-label="Open sidebar"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    )
  }

  return (
    <>
      {/* Overlay for mobile */}
      <div className="fixed inset-0 bg-black/20 z-30 lg:hidden" onClick={onToggle} />

      {/* Sidebar */}
      <div
        className="fixed left-0 top-0 h-full bg-white dark:bg-slate-900 border-r dark:border-slate-700 z-40 flex"
        style={{ width: sidebarWidth }}
      >
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <div className="p-3 border-b dark:border-slate-700 flex items-center justify-between">
            <h2 className="font-semibold text-sm text-slate-700 dark:text-slate-300">Excel Templates</h2>
            <Button variant="ghost" size="icon" onClick={onToggle} className="h-6 w-6" aria-label="Close sidebar">
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </div>

          {/* New Template Button */}
          <div className="p-3 border-b dark:border-slate-700">
            <Button onClick={onCreateNew} className="w-full justify-start" size="sm">
              <Plus className="h-4 w-4 mr-2" />
              New Template
            </Button>
          </div>

          {/* Search */}
          <div className="p-3 border-b dark:border-slate-700">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search templates..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-8"
              />
            </div>
          </div>

          {/* Templates List */}
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              {filteredTemplates.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  {searchQuery ? "No templates found" : "No templates yet"}
                </div>
              ) : (
                filteredTemplates.map((template) => (
                  <div
                    key={template.id}
                    className={cn(
                      "group relative p-2 rounded-md cursor-pointer transition-colors",
                      "hover:bg-slate-100 dark:hover:bg-slate-800",
                      activeTemplateId === template.id && "bg-slate-100 dark:bg-slate-800",
                    )}
                    onClick={() => onSelectTemplate(template.id)}
                  >
                    <div className="flex items-start gap-2">
                      <FileSpreadsheet className="h-4 w-4 mt-0.5 text-slate-500 dark:text-slate-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate text-slate-900 dark:text-slate-100">
                          {template.title}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                          <Calendar className="h-3 w-3" />
                          <span>{formatDate(template.updatedAt)}</span>
                          <span>•</span>
                          <span>{template.rowCount} rows</span>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => {
                          e.stopPropagation()
                          onDeleteTemplate(template.id)
                        }}
                        aria-label={`Delete template ${template.title}`}
                      >
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>

          {/* Footer */}
          <div className="p-3 border-t dark:border-slate-700 text-xs text-muted-foreground">
            {templates.length} template{templates.length !== 1 ? "s" : ""}
          </div>
        </div>

        {/* Resize Handle */}
        <div
          className="w-1 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 cursor-col-resize transition-colors"
          onMouseDown={handleMouseDown}
          aria-label="Resize sidebar"
        />
      </div>
    </>
  )
}

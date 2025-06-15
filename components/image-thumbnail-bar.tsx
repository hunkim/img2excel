"use client"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { X, PlusCircle } from "lucide-react"
import { useSpreadsheetStore } from "@/store/spreadsheet-store"
import { useAuth } from "@/hooks/useAuth"

interface ImageThumbnailBarProps {
  onAddImageClick: () => void // To trigger file input from parent
}

export function ImageThumbnailBar({ onAddImageClick }: ImageThumbnailBarProps) {
  const { user } = useAuth()
  const columns = useSpreadsheetStore((state) => state.columns)
  const deleteColumn = useSpreadsheetStore((state) => state.actions.deleteColumn)

  return (
    <div className="p-2 border-b dark:border-slate-700">
      <ScrollArea className="w-full whitespace-nowrap">
        <div className="flex items-center space-x-3 pb-3">
          {columns.map((col) => (
            <div
              key={col.id}
              className="relative group shrink-0 w-24 h-24 rounded-md overflow-hidden border dark:border-slate-600 shadow-sm"
            >
              <Image
                src={col.fileUrl || "/placeholder.svg"}
                alt={col.fileName}
                layout="fill"
                objectFit="cover"
                className="transition-transform duration-200 group-hover:scale-105"
              />
              <Button
                variant="destructive"
                size="icon"
                className="absolute top-1 right-1 h-6 w-6 opacity-50 group-hover:opacity-100 transition-opacity"
                onClick={() => deleteColumn(col.id, user?.uid)}
                aria-label={`Delete image ${col.fileName}`}
              >
                <X className="h-4 w-4" />
              </Button>
              <div className="absolute bottom-0 left-0 right-0 bg-black/50 p-1 text-xs text-white truncate">
                {col.fileName}
              </div>
            </div>
          ))}
          <Button
            variant="outline"
            className="h-24 w-24 flex flex-col items-center justify-center shrink-0"
            onClick={onAddImageClick}
            aria-label="Add new image column"
          >
            <PlusCircle className="h-8 w-8 mb-1 text-muted-foreground" />
            <span className="text-xs">Add Image</span>
          </Button>
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
      {/* Hidden file input, to be triggered programmatically */}
      <input
        type="file"
        id="addImageFileInput"
        className="hidden"
        accept="image/*"
        onChange={(e) => {
          if (e.target.files && e.target.files[0]) {
            const addImageColumn = useSpreadsheetStore.getState().actions.addImageColumn
            addImageColumn(e.target.files[0], user?.uid)
            e.target.value = "" // Reset input for same file upload
          }
        }}
      />
    </div>
  )
}

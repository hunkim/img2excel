"use client"

import React, { useCallback, useState } from "react"
import { useDropzone, type FileWithPath } from "react-dropzone"
import { Button } from "@/components/ui/button"
import { UploadCloud, X } from "lucide-react"
import Image from "next/image"

interface ImageUploaderProps {
  onImageUpload: (file: File) => void
  buttonText?: string
  compact?: boolean
}

export function ImageUploader({ onImageUpload, buttonText = "Upload Image", compact = false }: ImageUploaderProps) {
  const [preview, setPreview] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)

  const onDrop = useCallback(
    (acceptedFiles: FileWithPath[]) => {
      if (acceptedFiles && acceptedFiles.length > 0) {
        const file = acceptedFiles[0]
        setFileName(file.name)
        const reader = new FileReader()
        reader.onloadend = () => {
          setPreview(reader.result as string)
        }
        reader.readAsDataURL(file)
        // Call the upload function once
        onImageUpload(file)
        
        // If compact, clear preview immediately. Otherwise, keep it for user confirmation
        if (compact) {
          setPreview(null) // Clear preview after upload for compact mode
          setFileName(null)
        }
      }
    },
    [onImageUpload, compact],
  )

  const handlePaste = useCallback(
    (event: ClipboardEvent) => {
      const items = event.clipboardData?.items
      if (items) {
        for (let i = 0; i < items.length; i++) {
          if (items[i].type.indexOf("image") !== -1) {
            const file = items[i].getAsFile()
            if (file) {
              onDrop([file as FileWithPath]) // Process pasted image like a dropped file
              event.preventDefault() // Prevent default paste action
              return
            }
          }
        }
      }
    },
    [onDrop],
  )

  React.useEffect(() => {
    window.addEventListener("paste", handlePaste)
    return () => {
      window.removeEventListener("paste", handlePaste)
    }
  }, [handlePaste])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [".jpeg", ".jpg", ".png", ".gif", ".webp"] },
    multiple: false,
  })

  const clearPreview = () => {
    setPreview(null)
    setFileName(null)
  }

  if (compact) {
    return (
      <div {...getRootProps()} className="cursor-pointer">
        <input {...getInputProps()} />
        <Button variant="outline" size="sm" className="h-full">
          <UploadCloud className="h-4 w-4 mr-2" />
          {buttonText}
        </Button>
      </div>
    )
  }

  return (
    <div
      {...getRootProps()}
      className={`w-full p-8 border-2 border-dashed rounded-lg text-center cursor-pointer
                  ${isDragActive ? "border-primary bg-primary/10" : "border-muted-foreground/30 hover:border-primary/70"}
                  transition-colors duration-200 ease-in-out flex flex-col items-center justify-center min-h-[200px]`}
    >
      <input {...getInputProps()} />
      {preview && fileName ? (
        <div className="space-y-2 flex flex-col items-center">
          <Image
            src={preview || "/placeholder.svg"}
            alt={`Preview of ${fileName}`}
            width={100}
            height={100}
            className="max-h-32 w-auto object-contain rounded"
          />
          <p className="text-sm text-muted-foreground">{fileName}</p>
          <Button
            onClick={(e) => {
              e.stopPropagation()
              clearPreview()
            }}
            variant="ghost"
            size="sm"
            className="text-xs mt-2"
          >
            <X className="h-3 w-3 mr-1" /> Clear
          </Button>
        </div>
      ) : (
        <>
          <UploadCloud className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <Button variant="default" size="lg" className="mb-2 pointer-events-none">
            {buttonText}
          </Button>
          <p className="text-sm text-muted-foreground">or drop a file, paste image</p>
          <p className="text-xs text-muted-foreground mt-1">(Supports JPG, PNG, GIF, WEBP)</p>
        </>
      )}
    </div>
  )
}

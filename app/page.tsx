"use client"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { ImageUploader } from "@/components/image-uploader"
import { ProjectsSidebar } from "@/components/projects-sidebar"
import { useSpreadsheetStore } from "@/store/spreadsheet-store"
import { AuthButton } from "@/components/auth-button"
import { BarChartBig, Bug } from "lucide-react"
import { useAuth } from "@/hooks/useAuth"
import { getProject } from "@/lib/firebase-service"

export default function LandingPage() {
  const router = useRouter()
  const { user, isAuthenticated } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [coverImage, setCoverImage] = useState<string>("")
  const actions = useSpreadsheetStore((state) => state.actions)

  // Randomly select cover image on component mount
  useEffect(() => {
    const images = ['/cover1-optimized.webp', '/cover2-optimized.webp']
    const randomImage = images[Math.floor(Math.random() * images.length)]
    setCoverImage(randomImage)
  }, [])

  const handleImageUpload = async (file: File) => {
    // Clear any existing state and start fresh
    actions.resetSheet()
    
    // Navigate to editor and process image directly
    router.push("/editor")
    
    // Process the image directly - will save if user is logged in
    setTimeout(() => {
      actions.addImageColumn(file, user?.uid)
    }, 100) // Small delay to ensure navigation completes
  }

  const handleProjectSelect = async (projectId: string) => {
    try {
      console.log("🔄 Loading project:", projectId)
      
      // Load project data into the store using the store's method
      await actions.loadProjectFromFirebase(projectId)
      console.log("✅ Project loaded successfully")
      
      // Navigate to editor with loaded project
      router.push("/editor")
    } catch (error) {
      console.error("❌ Error loading project:", error)
      alert("Failed to load project. Please try again.")
    }
  }

  const handleNewProject = () => {
    // Clear any existing state and go to editor
    actions.resetSheet()
    router.push("/editor")
  }

  const generateUniqueProjectName = (baseName: string, existingProjects: any[]): string => {
    // This is a simplified version - in a real app, you'd get the projects list
    // For now, we'll just add a timestamp to make it unique
    return `${baseName} (${new Date().getTime()})`
  }

  const handleCreateFromTemplate = async (templateProject: any) => {
    try {
      console.log('🔄 Creating project from template:', templateProject.title)
      
      // Load the template project to get its schema
      const templateData = await getProject(templateProject.id)
      if (!templateData) {
        throw new Error('Template project not found')
      }
      
      // Generate unique name (simplified for home page)
      const newProjectName = `${templateProject.title} (Copy)`
      
      // Clear current state and set up new project with template schema
      actions.resetSheet()
      actions.setSheetTitle(newProjectName)
      
      // Copy the keys (schema) from template
      templateData.keys.forEach((key: any) => {
        actions.addKey(key.name)
      })
      
      // Navigate to editor with the template loaded
      router.push("/editor")
      
      console.log('✅ Project created from template:', newProjectName)
    } catch (error) {
      console.error('❌ Error creating project from template:', error)
      alert('Failed to create project from template. Please try again.')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-200 dark:from-slate-900 dark:to-slate-800 relative overflow-hidden">
      {/* Projects Sidebar */}
      <ProjectsSidebar
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        onProjectSelect={handleProjectSelect}
        onNewProject={handleNewProject}
        onCreateFromTemplate={handleCreateFromTemplate}
      />
      
      {/* Mobile Overlay */}
      {sidebarOpen && isAuthenticated && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Header */}
      <header className="relative z-20 p-4 md:p-6 flex justify-between items-center">
        <div className="flex items-center space-x-3 text-2xl font-bold text-slate-800 dark:text-slate-200">
          <BarChartBig className="h-8 w-8 text-primary" />
          <span>img2excel</span>
          <a
            href="https://github.com/hunkim/img2excel/issues"
            target="_blank"
            rel="noopener noreferrer"
            className="ml-2 p-1.5 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            title="Report an issue"
          >
            <Bug className="h-5 w-5 text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200" />
          </a>
        </div>
        <AuthButton />
      </header>

      {/* Hero Section */}
      <main className={`relative z-10 min-h-[calc(100vh-140px)] flex items-center transition-all duration-300 ${
        sidebarOpen && isAuthenticated ? 'lg:ml-80' : ''
      }`}>
        <div className="container mx-auto px-4 py-12">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Left Content - Text + Cover Image */}
            <div className="space-y-8 text-center lg:text-left">
              {/* Text Content */}
              <div className="space-y-4">
                <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
                  img2excel
                </h1>
                <p className="text-xl md:text-2xl font-semibold text-slate-700 dark:text-slate-300">
                  Never Manually Type Data Again.
                </p>
                <p className="text-lg md:text-xl text-slate-600 dark:text-slate-400 font-medium">
                  Turn Images into Spreadsheets, Instantly.
                </p>
                <p className="text-base text-slate-600 dark:text-slate-400 max-w-lg mx-auto lg:mx-0">
                  Upload or paste any image with data—receipts, tables, lists, invoices—and watch as it transforms into an editable, organized spreadsheet. Stop wasting time transcribing. Start automating.
                </p>
              </div>

              {/* Cover Image Showcase */}
              <div className="relative max-w-lg mx-auto lg:mx-0">
                {coverImage && (
                  <div className="relative">
                    {/* Main Cover Image */}
                    <div className="relative rounded-2xl overflow-hidden shadow-2xl bg-white/10 backdrop-blur-sm border border-white/20">
                      <Image
                        src={coverImage}
                        alt="img2excel in action - transforming images to spreadsheets"
                        width={500}
                        height={333}
                        className="w-full h-auto object-cover"
                        priority
                      />
                      {/* Overlay gradient for better visual appeal */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/10 via-transparent to-transparent" />
                    </div>
                    
                    {/* Floating elements for visual appeal */}
                    <div className="absolute -top-3 -right-3 w-16 h-16 bg-primary/20 rounded-full blur-xl animate-pulse" />
                    <div className="absolute -bottom-4 -left-4 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl animate-pulse delay-1000" />
                  </div>
                )}
              </div>
            </div>

            {/* Right Content - Upload Section */}
            <div className="flex items-center justify-center">
              <div className="w-full max-w-md">
                <div className="bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm p-8 sm:p-10 rounded-xl shadow-2xl border border-white/20">
                  <div className="text-center mb-6">
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200 mb-2">
                      Get Started
                    </h2>
                    <p className="text-slate-600 dark:text-slate-400">
                      Upload your first image to begin
                    </p>
                  </div>
                  <ImageUploader onImageUpload={handleImageUpload} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-20 p-4 text-center text-sm text-slate-600 dark:text-slate-400 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm border-t border-white/20">
        Powered by{" "}
        <a 
          href="https://www.upstage.ai/" 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-primary hover:text-primary/80 underline transition-colors"
        >
          Upstage
        </a>
        {" "}and{" "}
        <a 
          href="https://www.upstage.ai/products/information-extract" 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-primary hover:text-primary/80 underline transition-colors"
        >
          Universal Information Extractor
        </a>
        . &copy; {new Date().getFullYear()} img2excel.
      </footer>
    </div>
  )
}

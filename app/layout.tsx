import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider" // Assuming you have this

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "img2excel - Turn Images into Spreadsheets Instantly",
  description: "Never manually type data again. Upload any image with data—receipts, tables, lists, invoices—and transform it into an editable spreadsheet. Powered by Upstage AI.",
  keywords: ["image to excel", "OCR", "data extraction", "spreadsheet", "AI", "automation", "receipt scanner", "table extraction"],
  authors: [{ name: "img2excel" }],
  creator: "img2excel",
  publisher: "img2excel",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL('https://img2excel.com'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: "img2excel - Turn Images into Spreadsheets Instantly",
    description: "Never manually type data again. Upload any image with data and transform it into an editable spreadsheet using AI.",
    url: 'https://img2excel.com',
    siteName: 'img2excel',
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: "img2excel - Turn Images into Spreadsheets Instantly",
    description: "Never manually type data again. Upload any image with data and transform it into an editable spreadsheet using AI.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/icon.svg', type: 'image/svg+xml' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
  manifest: '/manifest.json',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}

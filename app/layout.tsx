import { Fira_Code, Inter } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"

import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { CommandMenuProvider } from "@/components/command-menu"
import { CardExpandProvider } from "@/components/card-expand-transition"
import { MotionPreferenceProvider } from "@/components/motion-preference"
import { AutoRunProvider } from "@/components/auto-run-preference"
import { CompactViewProvider } from "@/components/compact-view-preference"
import { SidebarWidthProvider } from "@/components/sidebar-width-preference"
import { TooltipProvider } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" })

const fontMono = Fira_Code({
  subsets: ["latin"],
  variable: "--font-mono",
})

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(
        "overflow-x-hidden antialiased",
        fontMono.variable,
        "font-sans",
        inter.variable
      )}
    >
      <body className="overflow-x-hidden">
        <ThemeProvider>
          <MotionPreferenceProvider>
            <AutoRunProvider>
              <CompactViewProvider>
                <SidebarWidthProvider>
                  <TooltipProvider>
                    <CardExpandProvider>
                      <CommandMenuProvider>{children}</CommandMenuProvider>
                    </CardExpandProvider>
                  </TooltipProvider>
                </SidebarWidthProvider>
              </CompactViewProvider>
            </AutoRunProvider>
          </MotionPreferenceProvider>
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  )
}

import { Geist_Mono, Inter, Unbounded } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"

import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { CommandMenuProvider } from "@/components/command-menu"
import { CardExpandProvider } from "@/components/card-expand-transition"
import { MotionPreferenceProvider } from "@/components/motion-preference"
import { AutoRunProvider } from "@/components/auto-run-preference"
import { TooltipProvider } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" })

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

const fontDisplay = Unbounded({
  subsets: ["latin"],
  weight: ["700", "800"],
  variable: "--font-display",
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
        "antialiased",
        fontMono.variable,
        "font-sans",
        inter.variable,
        fontDisplay.variable
      )}
    >
      <body>
        <ThemeProvider>
          <MotionPreferenceProvider>
            <AutoRunProvider>
              <TooltipProvider>
                <CardExpandProvider>
                  <CommandMenuProvider>{children}</CommandMenuProvider>
                </CardExpandProvider>
              </TooltipProvider>
            </AutoRunProvider>
          </MotionPreferenceProvider>
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  )
}

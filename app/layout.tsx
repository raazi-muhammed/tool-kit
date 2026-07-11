import { Geist_Mono, Inter, Unbounded } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"

import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { CommandMenuProvider } from "@/components/command-menu"
import { TooltipProvider } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils";

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' })

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
          <TooltipProvider>
            <CommandMenuProvider>{children}</CommandMenuProvider>
          </TooltipProvider>
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  )
}

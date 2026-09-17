import type { Metadata } from "next"
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
import { SITE_DESCRIPTION, SITE_NAME, SITE_TAGLINE, SITE_URL } from "@/lib/seo"

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" })

const fontMono = Fira_Code({
  subsets: ["latin"],
  variable: "--font-mono",
})

const TITLE = `${SITE_NAME} — ${SITE_TAGLINE}`

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: TITLE,
    template: `%s — ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  category: "technology",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: "/",
    siteName: SITE_NAME,
    title: TITLE,
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: SITE_DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
}

const WEBSITE_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: SITE_NAME,
  description: SITE_DESCRIPTION,
  url: SITE_URL,
}

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
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(WEBSITE_JSON_LD) }}
        />
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

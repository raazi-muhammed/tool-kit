import type { Metadata } from "next"

import { buildToolMetadata, ToolJsonLd } from "@/lib/seo"
import { getTool } from "@/lib/tools"

const tool = getTool("/svg-to-png")

export const metadata: Metadata = buildToolMetadata(tool)

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ToolJsonLd tool={tool} />
      {children}
    </>
  )
}

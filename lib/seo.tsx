import type { Metadata } from "next"

import type { Tool } from "@/lib/tools"

export const SITE_NAME = "Tool Kit"
export const SITE_URL = "https://toolkit-rmk.vercel.app"
export const SITE_TAGLINE = "Offline tools for everyday tasks"
export const SITE_DESCRIPTION =
  "Free browser-based tools for images, PDFs, and text — image conversion, compression, cropping, PDF merging and locking, JSON/CSV/Markdown viewers, and more. Everything runs on-device; nothing you drop in is ever uploaded."

/** Per-tool `<title>`/description/canonical/OG/Twitter metadata, built from
 *  the tool's own entry in `lib/tools.ts` so a tool's copy is written once. */
export function buildToolMetadata(tool: Tool): Metadata {
  const title = tool.name
  const ogTitle = `${tool.name} — ${SITE_NAME}`

  return {
    title,
    description: tool.description,
    alternates: { canonical: tool.href },
    openGraph: {
      title: ogTitle,
      description: tool.description,
      url: tool.href,
      siteName: SITE_NAME,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: ogTitle,
      description: tool.description,
    },
  }
}

/** Renders a `SoftwareApplication` JSON-LD block for a tool page — lets
 *  search engines show it as a free web app in rich results, distinct from
 *  the site-wide `WebSite` block in the root layout. */
export function ToolJsonLd({ tool }: { tool: Tool }) {
  const json = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: tool.name,
    description: tool.description,
    url: `${SITE_URL}${tool.href}`,
    applicationCategory: "UtilitiesApplication",
    operatingSystem: "Any (runs in a web browser)",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    isPartOf: {
      "@type": "WebSite",
      name: SITE_NAME,
      url: SITE_URL,
    },
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(json) }}
    />
  )
}

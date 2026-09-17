import { HugeiconsIcon } from "@hugeicons/react"
import type { IconSvgElement } from "@hugeicons/react"
import Link from "next/link"

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { CommandMenuIconTrigger } from "@/components/command-menu"
import { ModeToggle } from "@/components/mode-toggle"

export function PageBreadcrumb({
  page,
  icon,
}: {
  page: string
  icon: IconSvgElement
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      {/* The breadcrumb below is presentational (`BreadcrumbPage` is a
          `span`) — this is the page's real semantic heading for
          accessibility and SEO, kept visually hidden since the breadcrumb
          already shows the same text. */}
      <h1 className="sr-only">{page}</h1>
      <Breadcrumb className="min-w-0">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link
                href="/"
                className="flex items-center gap-1.5 font-display font-bold"
              >
                Tool Kit
              </Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage className="flex items-center gap-1.5 font-display font-bold">
              <HugeiconsIcon icon={icon} className="size-3.5" aria-hidden />
              {page}
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <div className="flex shrink-0 items-center gap-2">
        <ModeToggle />
        <CommandMenuIconTrigger />
      </div>
    </div>
  )
}

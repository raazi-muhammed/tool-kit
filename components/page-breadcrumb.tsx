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
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link
                href="/"
                className="flex items-center gap-1.5 font-[family-name:var(--font-display)]"
              >
                Tool Kit
              </Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage className="flex items-center gap-1.5">
              <HugeiconsIcon icon={icon} className="size-3.5" aria-hidden />
              {page}
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <div className="flex items-center gap-2">
        <ModeToggle />
        <CommandMenuIconTrigger />
      </div>
    </div>
  )
}

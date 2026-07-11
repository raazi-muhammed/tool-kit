"use client"

import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowRight01Icon } from "@hugeicons/core-free-icons"
import Link from "next/link"
import { useState } from "react"

import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { CommandMenuTrigger } from "@/components/command-menu"
import { ModeToggle } from "@/components/mode-toggle"
import { CATEGORIES, TOOLS, type Category } from "@/lib/tools"
import { cn } from "@/lib/utils"

export default function Page() {
  const [category, setCategory] = useState<Category | "all">("all")
  const tools =
    category === "all"
      ? TOOLS
      : TOOLS.filter((tool) => tool.category === category)

  return (
    <div className="mx-auto flex min-h-svh max-w-7xl flex-col gap-4 p-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="flex items-center gap-3 font-[family-name:var(--font-display)] text-xl font-bold">
          Tool Kit
        </h1>
        <div className="flex items-center gap-2">
          <ModeToggle />
          <CommandMenuTrigger />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <FilterPill
          label="All"
          count={TOOLS.length}
          active={category === "all"}
          onClick={() => setCategory("all")}
        />
        {CATEGORIES.map(({ id, label }) => (
          <FilterPill
            key={id}
            label={label}
            count={TOOLS.filter((tool) => tool.category === id).length}
            active={category === id}
            onClick={() => setCategory(id)}
          />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tools.map(({ href, icon, name, description }) => (
          <Link key={href} href={href} className="group">
            <Card className="relative h-full overflow-hidden p-3 transition-all hover:-translate-y-0.5 hover:ring-2 hover:ring-primary">
              <HugeiconsIcon
                icon={icon}
                aria-hidden
                className="pointer-events-none absolute -right-6 -bottom-6 size-24 rotate-12 text-foreground/5"
              />
              <CardHeader className="flex flex-row items-start gap-3 px-0">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 transition-colors group-hover:bg-primary">
                  <HugeiconsIcon
                    icon={icon}
                    className="size-6 text-primary transition-colors group-hover:text-primary-foreground"
                    aria-hidden
                  />
                </div>
                <div className="flex min-w-0 flex-col gap-1">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="mt-1">{name}</CardTitle>
                    <HugeiconsIcon
                      icon={ArrowRight01Icon}
                      className="size-4 shrink-0 text-primary opacity-0 transition-opacity group-hover:opacity-100"
                      aria-hidden
                    />
                  </div>
                  <CardDescription>{description}</CardDescription>
                </div>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}

function FilterPill({
  label,
  count,
  active,
  onClick,
}: {
  label: string
  count: number
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-primary text-primary-foreground"
          : "bg-muted text-foreground/80 hover:bg-muted/70"
      )}
    >
      {label}
      <span
        className={cn(
          "rounded-full px-2 py-0.5 text-xs",
          active
            ? "bg-primary-foreground/20"
            : "bg-background/60 text-muted-foreground"
        )}
      >
        {count}
      </span>
    </button>
  )
}

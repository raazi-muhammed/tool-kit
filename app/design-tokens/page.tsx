import { PaintBoardIcon } from "@hugeicons/core-free-icons"

import { PageBreadcrumb } from "@/components/page-breadcrumb"
import { cn } from "@/lib/utils"

const COLOR_GROUPS: {
  title: string
  swatches: { name: string; bg: string; fg: string }[]
}[] = [
  {
    title: "Base",
    swatches: [
      { name: "background", bg: "bg-background", fg: "text-foreground" },
      { name: "foreground", bg: "bg-foreground", fg: "text-background" },
    ],
  },
  {
    title: "Card & Popover",
    swatches: [
      { name: "card", bg: "bg-card", fg: "text-card-foreground" },
      {
        name: "card-foreground",
        bg: "bg-card-foreground",
        fg: "text-card",
      },
      { name: "popover", bg: "bg-popover", fg: "text-popover-foreground" },
      {
        name: "popover-foreground",
        bg: "bg-popover-foreground",
        fg: "text-popover",
      },
    ],
  },
  {
    title: "Primary",
    swatches: [
      { name: "primary", bg: "bg-primary", fg: "text-primary-foreground" },
      {
        name: "primary-foreground",
        bg: "bg-primary-foreground",
        fg: "text-primary",
      },
    ],
  },
  {
    title: "Secondary",
    swatches: [
      {
        name: "secondary",
        bg: "bg-secondary",
        fg: "text-secondary-foreground",
      },
      {
        name: "secondary-foreground",
        bg: "bg-secondary-foreground",
        fg: "text-secondary",
      },
    ],
  },
  {
    title: "Muted",
    swatches: [
      { name: "muted", bg: "bg-muted", fg: "text-muted-foreground" },
      {
        name: "muted-foreground",
        bg: "bg-muted-foreground",
        fg: "text-muted",
      },
    ],
  },
  {
    title: "Accent",
    swatches: [
      { name: "accent", bg: "bg-accent", fg: "text-accent-foreground" },
      {
        name: "accent-foreground",
        bg: "bg-accent-foreground",
        fg: "text-accent",
      },
    ],
  },
  {
    title: "Destructive",
    swatches: [
      {
        name: "destructive",
        bg: "bg-destructive",
        fg: "text-destructive-foreground",
      },
      {
        name: "destructive-foreground",
        bg: "bg-destructive-foreground",
        fg: "text-destructive",
      },
    ],
  },
  {
    title: "Border / Input / Ring",
    swatches: [
      { name: "border", bg: "bg-border", fg: "text-foreground" },
      { name: "input", bg: "bg-input", fg: "text-foreground" },
      { name: "ring", bg: "bg-ring", fg: "text-foreground" },
    ],
  },
  {
    title: "Charts",
    swatches: [1, 2, 3, 4, 5].map((n) => ({
      name: `chart-${n}`,
      bg: `bg-chart-${n}`,
      fg: "text-foreground",
    })),
  },
]

const RADII: { name: string; className: string }[] = [
  { name: "xs", className: "rounded-xs" },
  { name: "sm", className: "rounded-sm" },
  { name: "md", className: "rounded-md" },
  { name: "lg (default)", className: "rounded-lg" },
  { name: "xl", className: "rounded-xl" },
  { name: "2xl", className: "rounded-2xl" },
  { name: "3xl", className: "rounded-3xl" },
  { name: "4xl", className: "rounded-4xl" },
]

function ColorSwatch({
  name,
  bg,
  fg,
}: {
  name: string
  bg: string
  fg: string
}) {
  return (
    <div
      className={cn(
        "flex h-20 flex-col justify-end rounded-lg p-3 ring-1 ring-foreground/10",
        bg
      )}
    >
      <span className={cn("font-mono text-xs font-medium", fg)}>{name}</span>
    </div>
  )
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-display text-lg font-bold text-foreground">
      {children}
    </h2>
  )
}

export default function DesignTokensPage() {
  return (
    <div className="mx-auto flex min-h-svh max-w-5xl flex-col gap-10 p-6">
      <PageBreadcrumb page="Design Tokens" icon={PaintBoardIcon} />

      <section className="flex flex-col gap-4">
        <SectionHeading>Colors</SectionHeading>
        <div className="flex flex-col gap-6">
          {COLOR_GROUPS.map((group) => (
            <div key={group.title} className="flex flex-col gap-2">
              <p className="text-sm font-medium text-muted-foreground">
                {group.title}
              </p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {group.swatches.map((swatch) => (
                  <ColorSwatch key={swatch.name} {...swatch} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <SectionHeading>Fonts</SectionHeading>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2 rounded-lg p-4 ring-1 ring-border">
            <p className="text-xs text-muted-foreground">Sans / body / heading — Inter</p>
            <p className="font-sans text-2xl font-semibold">
              The quick brown fox jumps over the lazy dog
            </p>
            <p className="font-sans text-sm text-muted-foreground">
              ABCDEFGHIJKLM abcdefghijklm 0123456789
            </p>
          </div>
          <div className="flex flex-col gap-2 rounded-lg p-4 ring-1 ring-border">
            <p className="text-xs text-muted-foreground">
              Mono / display — Fira Code
            </p>
            <p className="font-mono text-2xl font-semibold">
              The quick brown fox jumps over the lazy dog
            </p>
            <p className="font-mono text-sm text-muted-foreground">
              ABCDEFGHIJKLM abcdefghijklm 0123456789
            </p>
            <pre className="mt-1 overflow-x-auto rounded-md bg-muted p-2 font-mono text-sm">
              {"const isEqual = (a, b) => a === b"}
            </pre>
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <SectionHeading>Border Radius</SectionHeading>
        <div className="flex flex-wrap gap-6">
          {RADII.map((radius) => (
            <div
              key={radius.name}
              className="flex flex-col items-center gap-2"
            >
              <div
                className={cn(
                  "size-16 bg-primary/15 ring-1 ring-primary/30 sm:size-20",
                  radius.className
                )}
              />
              <span className="font-mono text-xs text-muted-foreground">
                {radius.name}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <SectionHeading>Surface Layering</SectionHeading>
        <div className="rounded-xl bg-background p-8 ring-1 ring-border">
          <p className="mb-3 font-mono text-xs text-muted-foreground">
            background
          </p>
          <div className="rounded-lg bg-card p-6 ring-1 ring-foreground/10">
            <p className="mb-3 font-mono text-xs text-muted-foreground">
              card
            </p>
            <div className="rounded-md bg-secondary p-4">
              <p className="mb-3 font-mono text-xs text-muted-foreground">
                secondary
              </p>
              <div className="flex flex-wrap gap-3">
                <div className="rounded-sm bg-muted p-3">
                  <p className="font-mono text-xs text-muted-foreground">
                    muted
                  </p>
                </div>
                <div className="rounded-sm bg-accent p-3">
                  <p className="font-mono text-xs text-accent-foreground">
                    accent
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

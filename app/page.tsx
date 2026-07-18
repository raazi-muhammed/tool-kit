"use client"

import { HugeiconsIcon } from "@hugeicons/react"
import type { IconSvgElement } from "@hugeicons/react"
import {
  ArrowRight01Icon,
  Contact01Icon,
  CustomerSupportIcon,
  GithubIcon,
  InstagramIcon,
  Linkedin01Icon,
  Mail01Icon,
} from "@hugeicons/core-free-icons"
import { motion } from "framer-motion"
import Link from "next/link"
import { useState } from "react"

import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  CommandMenuIconTrigger,
  CommandMenuTrigger,
} from "@/components/command-menu"
import { useCardExpand } from "@/components/card-expand-transition"
import { useCompactViewEnabled } from "@/components/compact-view-preference"
import { useAnimationsEnabled } from "@/components/motion-preference"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { IconTooltip } from "@/components/icon-tooltip"
import { ModeToggle } from "@/components/mode-toggle"
import { CATEGORIES, TOOLS, type Category } from "@/lib/tools"
import { cn, transformOriginFromRect } from "@/lib/utils"

const CONTACT_EMAIL = "raazi6163@gmail.com"

const SOCIAL_LINKS: {
  label: string
  username: string
  href: string
  icon: IconSvgElement
}[] = [
  {
    label: "GitHub",
    username: "@raazi-muhammed",
    href: "https://github.com/raazi-muhammed",
    icon: GithubIcon,
  },
  {
    label: "LinkedIn",
    username: "@raazimuhammed",
    href: "https://www.linkedin.com/in/raazimuhammed/",
    icon: Linkedin01Icon,
  },
  {
    label: "Instagram",
    username: "@raazi_muhammed_",
    href: "https://www.instagram.com/raazi_muhammed_/",
    icon: InstagramIcon,
  },
  {
    label: "Email",
    username: CONTACT_EMAIL,
    href: `mailto:${CONTACT_EMAIL}`,
    icon: Mail01Icon,
  },
]

export default function Page() {
  const expandCard = useCardExpand()
  const { enabled: animationsEnabled } = useAnimationsEnabled()
  const { enabled: compact } = useCompactViewEnabled()
  const [category, setCategory] = useState<Category | "all">("all")
  const [supportOpen, setSupportOpen] = useState(false)
  const [supportOrigin, setSupportOrigin] = useState("")
  const tools =
    category === "all"
      ? TOOLS
      : TOOLS.filter((tool) => tool.category === category)

  function openSupport(e: React.MouseEvent<HTMLElement>) {
    setSupportOrigin(
      transformOriginFromRect(e.currentTarget.getBoundingClientRect())
    )
    setSupportOpen(true)
  }

  function handleCardClick(
    e: React.MouseEvent<HTMLAnchorElement>,
    href: string,
    icon: IconSvgElement
  ) {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
    e.preventDefault()
    const rect = e.currentTarget.getBoundingClientRect()
    expandCard({
      href,
      icon,
      rect: {
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      },
    })
  }

  return (
    <div className="mx-auto flex min-h-svh max-w-7xl flex-col gap-4 p-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="flex items-center gap-3 font-[family-name:var(--font-display)] text-xl font-bold">
          Tool Kit
        </h1>
        <div className="flex items-center gap-2">
          <IconTooltip label="Need something?">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Need something?"
              onClick={openSupport}
            >
              <HugeiconsIcon icon={Contact01Icon} aria-hidden />
            </Button>
          </IconTooltip>
          <ModeToggle />
          <CommandMenuTrigger className="hidden w-72 sm:flex" />
          <CommandMenuIconTrigger className="sm:hidden" />
        </div>
      </div>

      <div
        className={cn(
          "flex items-center gap-2 overflow-x-auto",
          // Scrolls, but stays visually clean as a pill row instead of a
          // scrollable list — hide the scrollbar across browsers instead of
          // the usual `pb-1` to clear it.
          "[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        )}
      >
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

      <div
        className={cn(
          "grid gap-4",
          compact
            ? "grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
            : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
        )}
      >
        {tools.map(({ href, icon, name, description }, index) => (
          <motion.div
            key={href}
            initial={animationsEnabled ? { opacity: 0, y: 16 } : false}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.2,
              delay: animationsEnabled ? index * 0.015 : 0,
              ease: [0.4, 0, 0.2, 1],
            }}
          >
            <Link
              href={href}
              className="group block h-full"
              onClick={(e) => handleCardClick(e, href, icon)}
            >
              <Card
                className={cn(
                  "relative h-full overflow-hidden p-3 transition-all hover:-translate-y-0.5 hover:ring-2 hover:ring-primary",
                  // The theme's rounded-xl (1.4rem) reads bulbous on the
                  // short compact cards — step down the theme radius scale
                  // to keep the curve proportional to the card.
                  compact && "rounded-lg"
                )}
              >
                <HugeiconsIcon
                  icon={icon}
                  aria-hidden
                  className={cn(
                    "pointer-events-none absolute -right-6 -bottom-6 rotate-12 text-foreground/5",
                    compact ? "size-16" : "size-24"
                  )}
                />
                <CardHeader
                  className={cn(
                    "flex flex-row gap-3 px-0",
                    compact ? "items-center" : "items-start"
                  )}
                >
                  <div
                    className={cn(
                      "flex shrink-0 items-center justify-center bg-primary/10 transition-colors group-hover:bg-primary",
                      compact ? "size-8 rounded-md" : "size-10 rounded-lg"
                    )}
                  >
                    <HugeiconsIcon
                      icon={icon}
                      className={cn(
                        "text-primary transition-colors group-hover:text-primary-foreground",
                        compact ? "size-5" : "size-6"
                      )}
                      aria-hidden
                    />
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle className={cn(!compact && "mt-1")}>
                        {name}
                      </CardTitle>
                      <HugeiconsIcon
                        icon={ArrowRight01Icon}
                        className="size-4 shrink-0 text-primary opacity-0 transition-opacity group-hover:opacity-100"
                        aria-hidden
                      />
                    </div>
                    {!compact && (
                      <CardDescription>{description}</CardDescription>
                    )}
                  </div>
                </CardHeader>
              </Card>
            </Link>
          </motion.div>
        ))}

        <motion.div
          key="support"
          initial={animationsEnabled ? { opacity: 0, y: 16 } : false}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 0.2,
            delay: animationsEnabled ? tools.length * 0.015 : 0,
            ease: [0.4, 0, 0.2, 1],
          }}
        >
          <button
            type="button"
            className="group block h-full w-full text-left"
            onClick={openSupport}
          >
            <Card
              className={cn(
                "relative h-full overflow-hidden border border-dashed border-primary/40 bg-primary/5 p-3 ring-0 transition-all hover:-translate-y-0.5 hover:border-primary hover:bg-primary/10",
                compact && "rounded-lg"
              )}
            >
              <HugeiconsIcon
                icon={CustomerSupportIcon}
                aria-hidden
                className={cn(
                  "pointer-events-none absolute -right-6 -bottom-6 rotate-12 text-primary/10",
                  compact ? "size-16" : "size-24"
                )}
              />
              <CardHeader
                className={cn(
                  "flex flex-row gap-3 px-0",
                  compact ? "items-center" : "items-start"
                )}
              >
                <div
                  className={cn(
                    "flex shrink-0 items-center justify-center bg-primary/10 transition-colors group-hover:bg-primary",
                    compact ? "size-8 rounded-md" : "size-10 rounded-lg"
                  )}
                >
                  <HugeiconsIcon
                    icon={CustomerSupportIcon}
                    className={cn(
                      "text-primary transition-colors group-hover:text-primary-foreground",
                      compact ? "size-5" : "size-6"
                    )}
                    aria-hidden
                  />
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className={cn(!compact && "mt-1")}>
                      Need something?
                    </CardTitle>
                    <HugeiconsIcon
                      icon={ArrowRight01Icon}
                      className="size-4 shrink-0 text-primary opacity-0 transition-opacity group-hover:opacity-100"
                      aria-hidden
                    />
                  </div>
                  {!compact && (
                    <CardDescription>
                      Request a tool, report a bug, or just say hi.
                    </CardDescription>
                  )}
                </div>
              </CardHeader>
            </Card>
          </button>
        </motion.div>
      </div>

      <Dialog open={supportOpen} onOpenChange={setSupportOpen}>
        <DialogContent
          className={cn(animationsEnabled && "duration-200")}
          style={
            animationsEnabled
              ? ({
                  "--tw-enter-scale": 0.12,
                  "--tw-exit-scale": 0.12,
                  transformOrigin: supportOrigin,
                } as React.CSSProperties)
              : undefined
          }
        >
          <DialogHeader>
            <DialogTitle>Need something?</DialogTitle>
            <DialogDescription>
              Message me on any of these to request a tool, report a bug, or
              just say hi.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1">
            {SOCIAL_LINKS.map(({ label, username, href, icon }) => (
              <a
                key={label}
                href={href}
                target={href.startsWith("mailto:") ? undefined : "_blank"}
                rel={href.startsWith("mailto:") ? undefined : "noreferrer"}
                className="flex items-center gap-3 rounded-lg bg-muted/50 px-4 py-3 text-sm transition-colors hover:bg-muted/70"
              >
                <HugeiconsIcon
                  icon={icon}
                  aria-hidden
                  className="size-4 shrink-0 text-muted-foreground"
                />
                <span className="font-medium">{label}</span>
                <span className="ml-auto text-muted-foreground">
                  {username}
                </span>
              </a>
            ))}
          </div>
        </DialogContent>
      </Dialog>
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
        "flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors",
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

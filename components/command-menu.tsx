"use client"

import * as React from "react"
import { usePathname, useRouter } from "next/navigation"
import { HugeiconsIcon } from "@hugeicons/react"
import { GridViewIcon, SearchIcon } from "@hugeicons/core-free-icons"

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Button } from "@/components/ui/button"
import { IconTooltip } from "@/components/icon-tooltip"
import { useCardExpand } from "@/components/card-expand-transition"
import { useAnimationsEnabled } from "@/components/motion-preference"
import { TOOLS, type Tool } from "@/lib/tools"
import { cn, transformOriginFromRect } from "@/lib/utils"

const CommandMenuContext = React.createContext<{
  open: (transformOrigin?: string) => void
  registerTrigger: (el: HTMLButtonElement | null) => void
} | null>(null)

export function CommandMenuProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [open, setOpen] = React.useState(false)
  const [transformOrigin, setTransformOrigin] = React.useState("")
  // Whichever trigger is currently mounted (the homepage's full bar, or a
  // tool page's icon button) registers itself here directly, rather than the
  // keyboard shortcut re-finding it via a DOM query — a held reference can't
  // go stale or match the wrong node the way a selector-based lookup can.
  const triggerRef = React.useRef<HTMLButtonElement | null>(null)
  const router = useRouter()
  const pathname = usePathname()
  const expandCard = useCardExpand()
  const { enabled: animationsEnabled } = useAnimationsEnabled()

  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        const trigger = triggerRef.current
        setTransformOrigin(
          trigger
            ? transformOriginFromRect(
                trigger.getBoundingClientRect(),
                COMMAND_DIALOG_ORIGIN_OPTIONS
              )
            : ""
        )
        setOpen((open) => !open)
      }
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [])

  function registerTrigger(el: HTMLButtonElement | null) {
    triggerRef.current = el
  }

  function openMenu(origin?: string) {
    setTransformOrigin(origin ?? "")
    setOpen(true)
  }

  function navigate(href: string, icon: Tool["icon"]) {
    setOpen(false)
    // Already there — the expand overlay's fade-out waits for `pathname` to
    // change (see card-expand-transition.tsx), which a same-route push never
    // does, so it'd get stuck covering the screen. Just close the dialog.
    if (href === pathname) return
    // Reuse the same grow-then-shrink-to-header-icon animation as clicking a
    // homepage card, growing out of the dialog's own (settled, fully open)
    // rect rather than the individual result row — cmdk's CommandItem
    // doesn't expose the underlying click event to onSelect.
    const content = document.querySelector<HTMLElement>(
      '[data-slot="dialog-content"]'
    )
    if (!content) {
      router.push(href)
      return
    }
    const rect = content.getBoundingClientRect()
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

  function runTool(tool: Tool) {
    navigate(tool.href, tool.icon)
  }

  function goHome() {
    navigate("/", GridViewIcon)
  }

  return (
    <CommandMenuContext.Provider value={{ open: openMenu, registerTrigger }}>
      {children}
      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Search tools"
        description="Jump to a tool by name."
        transformOrigin={transformOrigin}
        dramaticZoom={animationsEnabled}
      >
        <CommandInput placeholder="Search tools..." />
        <CommandList>
          <CommandEmpty>No tools found.</CommandEmpty>
          <CommandGroup heading="Go to">
            <CommandItem
              value="All tools"
              keywords={["home", "homepage", "grid"]}
              onSelect={goHome}
            >
              <HugeiconsIcon icon={GridViewIcon} aria-hidden />
              All tools
            </CommandItem>
          </CommandGroup>
          <CommandGroup heading="Tools">
            {TOOLS.map((tool) => (
              <CommandItem
                key={tool.href}
                value={tool.name}
                keywords={[tool.description]}
                onSelect={() => runTool(tool)}
              >
                <HugeiconsIcon icon={tool.icon} aria-hidden />
                {tool.name}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </CommandMenuContext.Provider>
  )
}

// CommandDialog is positioned via `left-1/2` + `top-1/3`, `-translate-x-1/2`
// (horizontal centering, from the base DialogContent) but `translate-y-0`
// (its own override — no vertical shift, unlike the base Dialog's
// `-translate-y-1/2`). See `transformOriginFromRect` (lib/utils.ts) for why
// both the anchor and the translate fraction have to match the real rule.
const COMMAND_DIALOG_ORIGIN_OPTIONS = {
  anchor: { x: 0.5, y: 1 / 3 },
  translate: { x: -0.5, y: 0 },
}

function transformOriginFromEvent(e: React.MouseEvent<HTMLElement>): string {
  return transformOriginFromRect(
    e.currentTarget.getBoundingClientRect(),
    COMMAND_DIALOG_ORIGIN_OPTIONS
  )
}

export function CommandMenuTrigger({ className }: { className?: string }) {
  const context = React.useContext(CommandMenuContext)
  if (!context) {
    throw new Error(
      "CommandMenuTrigger must be used within a CommandMenuProvider"
    )
  }
  const { registerTrigger } = context
  const setTriggerRef = React.useCallback(
    (el: HTMLButtonElement | null) => registerTrigger(el),
    [registerTrigger]
  )

  return (
    <Button
      ref={setTriggerRef}
      variant="secondary"
      onClick={(e) => context.open(transformOriginFromEvent(e))}
      className={cn("justify-between", className)}
    >
      <span className="flex items-center gap-1.5">
        <HugeiconsIcon icon={SearchIcon} aria-hidden />
        Search
      </span>
      <kbd className="rounded border bg-muted px-1 py-0.5 font-sans text-[10px] leading-none text-muted-foreground">
        ⌘K
      </kbd>
    </Button>
  )
}

export function CommandMenuIconTrigger({ className }: { className?: string }) {
  const context = React.useContext(CommandMenuContext)
  if (!context) {
    throw new Error(
      "CommandMenuIconTrigger must be used within a CommandMenuProvider"
    )
  }
  const { registerTrigger } = context
  const setTriggerRef = React.useCallback(
    (el: HTMLButtonElement | null) => registerTrigger(el),
    [registerTrigger]
  )

  return (
    <IconTooltip label="Search tools">
      <Button
        ref={setTriggerRef}
        variant="ghost"
        size="icon"
        aria-label="Search tools"
        onClick={(e) => context.open(transformOriginFromEvent(e))}
        className={className}
      >
        <HugeiconsIcon icon={SearchIcon} aria-hidden />
      </Button>
    </IconTooltip>
  )
}

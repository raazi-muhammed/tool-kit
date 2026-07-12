"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { HugeiconsIcon } from "@hugeicons/react"
import { SearchIcon } from "@hugeicons/core-free-icons"

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
import { cn } from "@/lib/utils"

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
  const expandCard = useCardExpand()
  const { enabled: animationsEnabled } = useAnimationsEnabled()

  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        const trigger = triggerRef.current
        setTransformOrigin(
          trigger ? transformOriginFromRect(trigger.getBoundingClientRect()) : ""
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

  function runTool(tool: Tool) {
    setOpen(false)
    // Reuse the same grow-then-shrink-to-header-icon animation as clicking a
    // homepage card, growing out of the dialog's own (settled, fully open)
    // rect rather than the individual result row — cmdk's CommandItem
    // doesn't expose the underlying click event to onSelect.
    const content = document.querySelector<HTMLElement>(
      '[data-slot="dialog-content"]'
    )
    if (!content) {
      router.push(tool.href)
      return
    }
    const rect = content.getBoundingClientRect()
    expandCard({
      href: tool.href,
      icon: tool.icon,
      rect: {
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      },
    })
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

// CommandDialog is centered via `left-1/2` + `top-1/3` (see
// components/ui/command.tsx) with the actual centering done by a
// `translate(-50%, ...)` transform. `transform-origin` length values are
// resolved against the element's *untransformed* layout box, not its
// currently-rendered (possibly mid-scale-animation) box — so measuring via
// `getBoundingClientRect()` at animation time gives the wrong reference
// frame (a shrunken, off-position box) and produces a bogus origin. Deriving
// the layout position analytically from the same static `left-1/2`/`top-1/3`
// rule sidesteps that entirely.
function transformOriginFromRect(rect: DOMRect): string {
  const centerX = rect.left + rect.width / 2
  const centerY = rect.top + rect.height / 2
  const layoutLeft = window.innerWidth * 0.5
  const layoutTop = window.innerHeight / 3
  return `${centerX - layoutLeft}px ${centerY - layoutTop}px`
}

function transformOriginFromEvent(e: React.MouseEvent<HTMLElement>): string {
  return transformOriginFromRect(e.currentTarget.getBoundingClientRect())
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

export function CommandMenuIconTrigger() {
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
      >
        <HugeiconsIcon icon={SearchIcon} aria-hidden />
      </Button>
    </IconTooltip>
  )
}

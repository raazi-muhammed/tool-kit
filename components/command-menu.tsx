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
import { TOOLS } from "@/lib/tools"

const CommandMenuContext = React.createContext<{
  setOpen: (open: boolean) => void
} | null>(null)

export function CommandMenuProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [open, setOpen] = React.useState(false)
  const router = useRouter()

  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        setOpen((open) => !open)
      }
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [])

  function runTool(href: string) {
    setOpen(false)
    router.push(href)
  }

  return (
    <CommandMenuContext.Provider value={{ setOpen }}>
      {children}
      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Search tools"
        description="Jump to a tool by name."
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
                onSelect={() => runTool(tool.href)}
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

export function CommandMenuTrigger() {
  const context = React.useContext(CommandMenuContext)
  if (!context) {
    throw new Error("CommandMenuTrigger must be used within a CommandMenuProvider")
  }

  return (
    <Button variant="outline" size="sm" onClick={() => context.setOpen(true)}>
      <HugeiconsIcon icon={SearchIcon} aria-hidden />
      Search
      <kbd className="ml-1 rounded border bg-muted px-1 py-0.5 font-sans text-[10px] leading-none text-muted-foreground">
        ⌘K
      </kbd>
    </Button>
  )
}

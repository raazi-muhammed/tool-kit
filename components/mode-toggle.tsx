"use client"

import { useSyncExternalStore } from "react"
import { useTheme } from "next-themes"
import { HugeiconsIcon } from "@hugeicons/react"
import { Settings01Icon } from "@hugeicons/core-free-icons"

import { IconTooltip } from "@/components/icon-tooltip"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

const noopSubscribe = () => () => {}

export function ModeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  // Avoids a hydration mismatch: the server always renders before
  // localStorage's theme is known, so the active segment can only reflect
  // `resolvedTheme` once mounted on the client.
  const mounted = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false
  )

  return (
    <Popover>
      <IconTooltip label="Settings">
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Settings">
            <HugeiconsIcon icon={Settings01Icon} aria-hidden />
          </Button>
        </PopoverTrigger>
      </IconTooltip>
      <PopoverContent align="end" className="w-56">
        <span className="text-xs font-medium tracking-widest text-muted-foreground uppercase">
          Theme
        </span>
        <Tabs
          value={mounted ? resolvedTheme : "light"}
          onValueChange={setTheme}
        >
          <TabsList className="w-full">
            <TabsTrigger value="light">Light</TabsTrigger>
            <TabsTrigger value="dark">Dark</TabsTrigger>
          </TabsList>
        </Tabs>
      </PopoverContent>
    </Popover>
  )
}

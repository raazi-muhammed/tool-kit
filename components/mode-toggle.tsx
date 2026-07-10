"use client"

import { useSyncExternalStore } from "react"
import { useTheme } from "next-themes"

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

const noopSubscribe = () => () => {}

export function ModeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  // Avoids a hydration mismatch: the server always renders before
  // localStorage's theme is known, so the active segment can only reflect
  // `resolvedTheme` once mounted on the client.
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false)

  return (
    <Tabs value={mounted ? resolvedTheme : "light"} onValueChange={setTheme}>
      <TabsList>
        <TabsTrigger value="light">Light</TabsTrigger>
        <TabsTrigger value="dark">Dark</TabsTrigger>
      </TabsList>
    </Tabs>
  )
}

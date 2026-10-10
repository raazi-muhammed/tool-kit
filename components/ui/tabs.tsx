"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { motion } from "framer-motion"
import { Tabs as TabsPrimitive } from "radix-ui"

import { useAnimationsEnabled } from "@/components/motion-preference"
import { cn } from "@/lib/utils"

function Tabs({
  className,
  orientation = "horizontal",
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      data-orientation={orientation}
      className={cn(
        "group/tabs flex gap-2 data-horizontal:flex-col",
        className
      )}
      {...props}
    />
  )
}

const tabsListVariants = cva(
  "group/tabs-list relative inline-flex w-fit items-center justify-center rounded-lg p-1 text-card-foreground group-data-horizontal/tabs:h-10 group-data-vertical/tabs:h-fit group-data-vertical/tabs:flex-col data-[variant=line]:rounded-none",
  {
    variants: {
      variant: {
        default: "bg-card",
        line: "gap-1 bg-transparent",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

type IndicatorRect = { x: number; y: number; width: number; height: number }

/** Tracks the active trigger's box within `list`, relative to the list. Uses
 *  `offset*` rather than `getBoundingClientRect()` so the result is the
 *  untransformed layout box — the indicator itself is transformed, and the
 *  list may be mid-animation inside a page transition. */
function useActiveTriggerRect(list: HTMLElement | null) {
  const [rect, setRect] = React.useState<IndicatorRect | null>(null)

  React.useLayoutEffect(() => {
    if (!list) return

    const measure = () => {
      const active = list.querySelector<HTMLElement>(
        ':scope > [role="tab"][data-state="active"]'
      )
      setRect((prev) => {
        if (!active) return null
        const next = {
          x: active.offsetLeft,
          y: active.offsetTop,
          width: active.offsetWidth,
          height: active.offsetHeight,
        }
        return prev &&
          prev.x === next.x &&
          prev.y === next.y &&
          prev.width === next.width &&
          prev.height === next.height
          ? prev
          : next
      })
    }

    // Triggers can resize independently of the list (e.g. a label change in
    // a `w-full` list), so observe each of them, re-subscribing whenever the
    // set of triggers changes.
    const resizeObserver = new ResizeObserver(measure)
    const observeAll = () => {
      resizeObserver.disconnect()
      resizeObserver.observe(list)
      list
        .querySelectorAll(':scope > [role="tab"]')
        .forEach((trigger) => resizeObserver.observe(trigger))
    }

    const mutationObserver = new MutationObserver((mutations) => {
      if (mutations.some((m) => m.type === "childList")) observeAll()
      measure()
    })
    mutationObserver.observe(list, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["data-state"],
    })

    observeAll()
    measure()
    return () => {
      mutationObserver.disconnect()
      resizeObserver.disconnect()
    }
  }, [list])

  return rect
}

function TabsList({
  className,
  variant = "default",
  children,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List> &
  VariantProps<typeof tabsListVariants>) {
  const { enabled: animationsEnabled } = useAnimationsEnabled()
  // State rather than a ref so the measuring effect re-runs once the node
  // mounts.
  const [list, setList] = React.useState<HTMLDivElement | null>(null)
  const rect = useActiveTriggerRect(variant === "default" ? list : null)

  return (
    <TabsPrimitive.List
      ref={setList}
      data-slot="tabs-list"
      data-variant={variant}
      className={cn(tabsListVariants({ variant }), className)}
      {...props}
    >
      {variant === "default" && rect && (
        <motion.span
          aria-hidden
          data-slot="tabs-indicator"
          className="pointer-events-none absolute top-0 left-0 rounded-md bg-background"
          // `initial={false}` lands it on the first active tab without
          // sliding in from the corner.
          initial={false}
          animate={rect}
          transition={
            animationsEnabled
              ? { type: "spring", bounce: 0.15, duration: 0.35 }
              : { duration: 0 }
          }
        />
      )}
      {children}
    </TabsPrimitive.List>
  )
}

function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "relative inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 rounded-md border border-transparent px-3 py-1.5 text-sm font-medium whitespace-nowrap text-foreground transition-colors group-data-vertical/tabs:w-full group-data-vertical/tabs:justify-start hover:text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 dark:text-card-foreground dark:hover:text-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        "data-[state=active]:text-primary",
        "after:absolute after:bg-foreground after:opacity-0 after:transition-opacity group-data-horizontal/tabs:after:inset-x-0 group-data-horizontal/tabs:after:bottom-[-5px] group-data-horizontal/tabs:after:h-0.5 group-data-vertical/tabs:after:inset-y-0 group-data-vertical/tabs:after:-right-1 group-data-vertical/tabs:after:w-0.5 group-data-[variant=line]/tabs-list:data-[state=active]:after:opacity-100",
        className
      )}
      {...props}
    />
  )
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn("flex-1 text-sm outline-none", className)}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants }

"use client"

import * as React from "react"
import { usePathname, useRouter } from "next/navigation"
import { AnimatePresence, motion } from "framer-motion"
import { HugeiconsIcon } from "@hugeicons/react"
import type { IconSvgElement } from "@hugeicons/react"

import { useAnimationsEnabled } from "@/components/motion-preference"

type Rect = { top: number; left: number; width: number; height: number }
type ExpandingTool = { href: string; icon: IconSvgElement; rect: Rect }
type Phase = "expand" | "hold" | "fade"

const EXPAND_DURATION = 0.35
const FADE_DURATION = 0.5
const EASE = [0.4, 0, 0.2, 1] as const

const CardExpandContext = React.createContext<
  ((tool: ExpandingTool) => void) | null
>(null)

export function useCardExpand() {
  const context = React.useContext(CardExpandContext)
  if (!context) {
    throw new Error("useCardExpand must be used within a CardExpandProvider")
  }
  return context
}

export function CardExpandProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const { enabled: animationsEnabled } = useAnimationsEnabled()
  const [expandingTool, setExpandingTool] =
    React.useState<ExpandingTool | null>(null)
  const [phase, setPhase] = React.useState<Phase>("expand")
  // `router.push` is called inside `startTransition` below so `isPending`
  // stays true until the destination page has actually rendered - not just
  // until `pathname` flips. A tool page's own client bundle (framer-motion,
  // canvas/pdf helpers, ...) can still be fetching/executing after the route
  // change is visible to `usePathname`, and without this, the overlay would
  // fade out over the stale homepage before the new page ever painted.
  const [isPending, startTransition] = React.useTransition()

  // Once the destination route has mounted (pathname changed) *and* React
  // has actually finished committing it (transition no longer pending),
  // start fading the overlay out to reveal it.
  React.useEffect(() => {
    if (!expandingTool || phase !== "hold" || isPending) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPhase("fade")
  }, [pathname, phase, expandingTool, isPending])

  function expand(tool: ExpandingTool) {
    if (!animationsEnabled) {
      router.push(tool.href)
      return
    }
    setPhase("expand")
    setExpandingTool(tool)
  }

  // Advance the phase the instant each stage's animation actually finishes
  // playing, instead of a separately-tracked timer that has to be kept in
  // sync with `transition.duration` by hand (and can drift from the real
  // animation under frame drops or a backgrounded tab).
  function handleOuterAnimationComplete() {
    if (phase === "expand" && expandingTool) {
      startTransition(() => {
        router.push(expandingTool.href)
      })
      setPhase("hold")
    } else if (phase === "fade") {
      setExpandingTool(null)
      setPhase("expand")
    }
  }

  const isFading = phase === "fade"

  return (
    <CardExpandContext.Provider value={expand}>
      {children}
      <AnimatePresence>
        {expandingTool && (
          <motion.div
            key="card-expand"
            style={{ position: "fixed", backgroundColor: "var(--card)" }}
            initial={{
              top: expandingTool.rect.top,
              left: expandingTool.rect.left,
              width: expandingTool.rect.width,
              height: expandingTool.rect.height,
              borderRadius: 22,
              opacity: 1,
            }}
            animate={{
              top: 0,
              left: 0,
              width: "100vw",
              height: "100vh",
              borderRadius: 22,
              opacity: isFading ? 0 : 1,
              scale: isFading ? 6 : 1,
            }}
            transition={
              isFading
                ? {
                    scale: { duration: FADE_DURATION, ease: EASE },
                    opacity: {
                      duration: FADE_DURATION * 0.6,
                      delay: FADE_DURATION * 0.4,
                      ease: EASE,
                    },
                  }
                : { duration: EXPAND_DURATION, ease: EASE }
            }
            onAnimationComplete={handleOuterAnimationComplete}
            className="z-50 flex items-center justify-center overflow-hidden"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.4 }}
              animate={{ opacity: isFading ? 0 : 1, scale: 1 }}
              transition={
                isFading
                  ? { duration: FADE_DURATION * 0.6, ease: EASE }
                  : { delay: EXPAND_DURATION * 0.4, duration: 0.2 }
              }
            >
              <HugeiconsIcon
                icon={expandingTool.icon}
                className="size-16 text-card-foreground"
                aria-hidden
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </CardExpandContext.Provider>
  )
}

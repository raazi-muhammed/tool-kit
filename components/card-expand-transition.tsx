"use client"

import * as React from "react"
import { usePathname, useRouter } from "next/navigation"
import { AnimatePresence, motion } from "framer-motion"
import { HugeiconsIcon } from "@hugeicons/react"
import type { IconSvgElement } from "@hugeicons/react"

type Rect = { top: number; left: number; width: number; height: number }
type ExpandingTool = { href: string; icon: IconSvgElement; rect: Rect }
type Phase = "expand" | "hold" | "shrink"

const EXPAND_DURATION = 0.35
const SHRINK_HOLD = 0.12
const SHRINK_DURATION = 0.45
const EASE = [0.4, 0, 0.2, 1] as const

function measureHeaderIconRect(): Rect | null {
  const el = document.querySelector<HTMLElement>("[data-tool-header-icon]")
  if (!el) return null
  const rect = el.getBoundingClientRect()
  return { top: rect.top, left: rect.left, width: rect.width, height: rect.height }
}

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
  const [expandingTool, setExpandingTool] = React.useState<ExpandingTool | null>(
    null
  )
  const [phase, setPhase] = React.useState<Phase>("expand")
  const [targetRect, setTargetRect] = React.useState<Rect | null>(null)

  React.useEffect(() => {
    if (!expandingTool || phase !== "expand") return
    const timeout = setTimeout(() => {
      router.push(expandingTool.href)
      setPhase("hold")
    }, EXPAND_DURATION * 1000)
    return () => clearTimeout(timeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expandingTool])

  React.useEffect(() => {
    if (!expandingTool || phase !== "hold") return
    const timeout = setTimeout(() => {
      setTargetRect(measureHeaderIconRect())
      setPhase("shrink")
    }, SHRINK_HOLD * 1000)
    return () => clearTimeout(timeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, phase])

  React.useEffect(() => {
    if (phase !== "shrink") return
    const timeout = setTimeout(() => {
      setExpandingTool(null)
      setPhase("expand")
      setTargetRect(null)
    }, SHRINK_DURATION * 1000)
    return () => clearTimeout(timeout)
  }, [phase])

  function expand(tool: ExpandingTool) {
    setPhase("expand")
    setTargetRect(null)
    setExpandingTool(tool)
  }

  const isShrinking = phase === "shrink"

  return (
    <CardExpandContext.Provider value={expand}>
      {children}
      <AnimatePresence>
        {expandingTool && (
          <motion.div
            key="card-expand"
            style={{ position: "fixed", backgroundColor: "#151519" }}
            initial={{
              top: expandingTool.rect.top,
              left: expandingTool.rect.left,
              width: expandingTool.rect.width,
              height: expandingTool.rect.height,
              borderRadius: 22,
              opacity: 1,
            }}
            animate={
              isShrinking
                ? targetRect
                  ? {
                      top: targetRect.top,
                      left: targetRect.left,
                      width: targetRect.width,
                      height: targetRect.height,
                      borderRadius: 999,
                      opacity: 0,
                    }
                  : { opacity: 0 }
                : {
                    top: 0,
                    left: 0,
                    width: "100vw",
                    height: "100vh",
                    borderRadius: 22,
                    opacity: 1,
                  }
            }
            transition={
              isShrinking
                ? {
                    top: { duration: SHRINK_DURATION, ease: EASE },
                    left: { duration: SHRINK_DURATION, ease: EASE },
                    width: { duration: SHRINK_DURATION, ease: EASE },
                    height: { duration: SHRINK_DURATION, ease: EASE },
                    borderRadius: { duration: SHRINK_DURATION, ease: EASE },
                    opacity: {
                      duration: SHRINK_DURATION * 0.35,
                      delay: SHRINK_DURATION * 0.65,
                    },
                  }
                : { duration: EXPAND_DURATION, ease: EASE }
            }
            className="z-50 flex items-center justify-center overflow-hidden"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.4 }}
              animate={
                isShrinking ? { opacity: 0, scale: 0.3 } : { opacity: 1, scale: 1 }
              }
              transition={
                isShrinking
                  ? { duration: 0.15, ease: "easeIn" }
                  : { delay: EXPAND_DURATION * 0.4, duration: 0.2 }
              }
            >
              <HugeiconsIcon
                icon={expandingTool.icon}
                className="size-16 text-neutral-50"
                aria-hidden
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </CardExpandContext.Provider>
  )
}

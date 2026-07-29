"use client"

import { createContext, useContext } from "react"

// How much vertical chrome (in px) `ToolPage`'s main column actually stacks
// around `children` on the current page — see the computation next to
// `hasHeaderRow`/`hasBottomBar` in `tool-page.tsx`. `PreviewCard` reads this
// via `usePreviewChromePx` to cap its `fill` viewport at exactly the space
// this specific page leaves available, instead of a single worst-case
// constant that under-fills whenever a page is missing one of the optional
// rows (a header-actions row, a bottom bar). The fallback (both those rows
// present) only applies to a `PreviewCard` rendered outside a `ToolPage`.
const FALLBACK_CHROME_PX = 204

const PreviewChromeContext = createContext(FALLBACK_CHROME_PX)

export const PreviewChromeProvider = PreviewChromeContext.Provider

export function usePreviewChromePx() {
  return useContext(PreviewChromeContext)
}

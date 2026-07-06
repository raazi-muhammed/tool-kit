/** Trigger a browser download for a URL via a throwaway anchor click. */
export function downloadFile(url: string, name: string) {
  const a = document.createElement("a")
  a.href = url
  a.download = name
  a.click()
}

/** Pause between successive downloads so browsers don't block a burst of them. */
export function downloadStagger(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 150))
}

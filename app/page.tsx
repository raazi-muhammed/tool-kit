import Link from "next/link"

export default function Page() {
  return (
    <div className="flex min-h-svh p-6">
      <div className="flex max-w-md min-w-0 flex-col gap-4 text-sm leading-loose">
        <div>
          <h1 className="font-medium">tool-kit</h1>
          <p>A collection of small, focused dev tools.</p>
          <ul className="mt-2 list-inside list-disc">
            <li>
              <Link href="/json-parser" className="underline underline-offset-4">
                JSON Parser
              </Link>
            </li>
          </ul>
        </div>
        <div className="font-mono text-xs text-muted-foreground">
          (Press <kbd>d</kbd> to toggle dark mode)
        </div>
      </div>
    </div>
  )
}

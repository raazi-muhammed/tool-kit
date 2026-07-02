import { HugeiconsIcon } from "@hugeicons/react"
import type { IconSvgElement } from "@hugeicons/react"
import { AudioWave01Icon, BracesIcon, Calculator01Icon } from "@hugeicons/core-free-icons"
import Link from "next/link"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

const TOOLS: { href: string; icon: IconSvgElement; name: string; description: string }[] = [
  {
    href: "/json-parser",
    icon: BracesIcon,
    name: "JSON Parser",
    description: "Validate, format, and explore JSON as a tree.",
  },
  {
    href: "/inline-calculator",
    icon: Calculator01Icon,
    name: "Inline Calculator",
    description: "Evaluate math expressions inline as you type.",
  },
  {
    href: "/video-to-audio",
    icon: AudioWave01Icon,
    name: "Video → Audio",
    description: "Extract a video's audio track to a WAV file, in your browser.",
  },
]

export default function Page() {
  return (
    <div className="mx-auto flex min-h-svh max-w-5xl flex-col gap-8 p-6">
      <h1 className="flex items-center gap-3 font-[family-name:var(--font-display)] text-xl font-bold">
        Tool Kit
      </h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {TOOLS.map(({ href, icon, name, description }) => (
          <Link key={href} href={href}>
            <Card className="relative h-full transition-colors hover:bg-accent/50">
              <HugeiconsIcon
                icon={icon}
                aria-hidden
                className="pointer-events-none absolute -right-6 -bottom-6 size-32 rotate-12 text-foreground/5"
              />
              <CardHeader>
                <HugeiconsIcon icon={icon} className="mb-2 size-5" aria-hidden />
                <CardTitle>{name}</CardTitle>
                <CardDescription>{description}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}

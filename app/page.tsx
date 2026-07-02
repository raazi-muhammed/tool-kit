import { Braces, Calculator, type LucideIcon } from "lucide-react"
import Link from "next/link"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

const TOOLS: { href: string; icon: LucideIcon; name: string; description: string }[] = [
  {
    href: "/json-parser",
    icon: Braces,
    name: "JSON Parser",
    description: "Validate, format, and explore JSON as a tree.",
  },
  {
    href: "/inline-calculator",
    icon: Calculator,
    name: "Inline Calculator",
    description: "Evaluate math expressions inline as you type.",
  },
]

export default function Page() {
  return (
    <div className="mx-auto flex min-h-svh max-w-5xl flex-col gap-8 p-6">
      <h1 className="flex items-center gap-3 font-[family-name:var(--font-display)] text-xl font-bold">
        Tool Kit
      </h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {TOOLS.map(({ href, icon: Icon, name, description }) => (
          <Link key={href} href={href}>
            <Card className="relative h-full transition-colors hover:bg-accent/50">
              <Icon
                aria-hidden
                className="pointer-events-none absolute -right-6 -bottom-6 size-32 rotate-12 text-foreground/5"
              />
              <CardHeader>
                <Icon className="mb-2 size-5" aria-hidden />
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

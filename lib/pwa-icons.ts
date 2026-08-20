import type { ZipEntry } from "@/lib/download"
import { canvasToPngBytes } from "@/lib/canvas"
import { buildIco, renderIconCanvas, type IconShape } from "@/lib/ico"

// The favicon.ico itself packs these three resolutions, matching Favicon
// Creator's own default favicon set.
const FAVICON_ICO_SIZES = [16, 32, 48]

export type IconSpec = { name: string; size: number }

// The standard PWA/web-app icon file set — matches what tools like
// realfavicongenerator.net produce, so a project can drop these straight
// into `public/`.
export const PWA_ICON_SPECS: IconSpec[] = [
  { name: "favicon-16x16.png", size: 16 },
  { name: "favicon-32x32.png", size: 32 },
  { name: "apple-touch-icon.png", size: 180 },
  { name: "android-chrome-144x144.png", size: 144 },
  { name: "android-chrome-192x192.png", size: 192 },
  { name: "android-chrome-512x512.png", size: 512 },
]

function buildManifest(appName: string, bg: string | null): string {
  const themeColor = bg ?? "#ffffff"
  return JSON.stringify(
    {
      name: appName,
      short_name: appName,
      icons: [
        { src: "/android-chrome-144x144.png", sizes: "144x144", type: "image/png" },
        { src: "/android-chrome-192x192.png", sizes: "192x192", type: "image/png" },
        { src: "/android-chrome-512x512.png", sizes: "512x512", type: "image/png" },
      ],
      theme_color: themeColor,
      background_color: themeColor,
      display: "standalone",
    },
    null,
    2
  )
}

/**
 * Build the full PWA icon set from `source`: favicon.ico, every size in
 * `PWA_ICON_SPECS`, and a `site.webmanifest` referencing the Android Chrome
 * icons and `appName`. Each PNG is rasterized fresh at its own size (rather
 * than downscaled from one raster) so a vector source stays sharp
 * throughout, matching `buildIco`'s approach for the .ico entry.
 */
export async function buildPwaIconSet(
  source: CanvasImageSource,
  bg: string | null,
  shape: IconShape,
  appName: string
): Promise<ZipEntry[]> {
  const favicon = await buildIco(source, FAVICON_ICO_SIZES, bg, shape)
  const pngs = await Promise.all(
    PWA_ICON_SPECS.map(async (spec) => ({
      name: spec.name,
      blob: new Blob(
        [
          await canvasToPngBytes(renderIconCanvas(source, spec.size, bg, shape)),
        ] as BlobPart[],
        { type: "image/png" }
      ),
    }))
  )
  const manifest: ZipEntry = {
    name: "site.webmanifest",
    blob: new Blob([buildManifest(appName, bg)], {
      type: "application/manifest+json",
    }),
  }
  return [{ name: "favicon.ico", blob: favicon }, ...pngs, manifest]
}

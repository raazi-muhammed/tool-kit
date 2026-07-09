import type { IconSvgElement } from "@hugeicons/react"
import {
  AudioWave01Icon,
  BlurIcon,
  BracesIcon,
  Calculator01Icon,
  FileUnlockedIcon,
  Image01Icon,
  ImageCropIcon,
  ImageRotationClockwiseIcon,
  Png01Icon,
  Resize02Icon,
  ScanIcon,
  ScissorRectangleIcon,
  SquareIcon,
  SquareRoundCornerIcon,
} from "@hugeicons/core-free-icons"

export type Tool = {
  href: string
  icon: IconSvgElement
  name: string
  description: string
}

export const TOOLS: Tool[] = [
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
    name: "Video to Audio",
    description:
      "Extract a video's audio track to a WAV file, in your browser.",
  },
  {
    href: "/image-converter",
    icon: Image01Icon,
    name: "Image Converter",
    description:
      "Convert images between PNG, JPEG, WebP, and BMP, entirely in your browser.",
  },
  {
    href: "/image-blur",
    icon: BlurIcon,
    name: "Image Blur",
    description:
      "Select a rectangle on an image and blur just that region, in your browser.",
  },
  {
    href: "/image-crop",
    icon: ImageCropIcon,
    name: "Image Crop",
    description:
      "Crop images to a selection, and give transparent PNGs a background color.",
  },
  {
    href: "/image-trim",
    icon: ScissorRectangleIcon,
    name: "Image Trim",
    description:
      "Automatically crop away transparent margins around an image, in your browser.",
  },
  {
    href: "/image-resize",
    icon: Resize02Icon,
    name: "Image Resize",
    description: "Resize an image to any width and height, in your browser.",
  },
  {
    href: "/image-rotate",
    icon: ImageRotationClockwiseIcon,
    name: "Image Rotate",
    description: "Rotate images in 90° steps, in your browser.",
  },
  {
    href: "/image-scan",
    icon: ScanIcon,
    name: "Image Scan",
    description:
      "Drag a photographed document's corners to straighten it into a flat scan, in your browser.",
  },
  {
    href: "/pdf-unlock",
    icon: FileUnlockedIcon,
    name: "PDF Unlock",
    description:
      "Remove a PDF's password and download an unlocked copy, in your browser.",
  },
  {
    href: "/svg-to-png",
    icon: Png01Icon,
    name: "SVG to PNG",
    description: "Convert SVG files to PNG at any resolution, in your browser.",
  },
  {
    href: "/square-image-generator",
    icon: SquareIcon,
    name: "Square Image Generator",
    description: "Fit any image into a square canvas at any size, in your browser.",
  },
  {
    href: "/image-round-corners",
    icon: SquareRoundCornerIcon,
    name: "Image Round Corners",
    description: "Round an image's corners to any radius, in your browser.",
  },
]

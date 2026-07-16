import type { IconSvgElement } from "@hugeicons/react"
import {
  AudioWave01Icon,
  BlurIcon,
  BracesIcon,
  Calculator01Icon,
  CodeIcon,
  FileDiffIcon,
  FileLockedIcon,
  FileStackIcon,
  FileUnlockedIcon,
  IdentityCardIcon,
  Image01Icon,
  ImageCropIcon,
  ImageDownloadIcon,
  ImageRotationClockwiseIcon,
  Key01Icon,
  Pdf01Icon,
  Png01Icon,
  Resize02Icon,
  ScanIcon,
  ScissorRectangleIcon,
  SquareIcon,
  SquareRoundCornerIcon,
} from "@hugeicons/core-free-icons"

export type Category = "data" | "image" | "convert" | "pdf"

export const CATEGORIES: { id: Category; label: string }[] = [
  { id: "data", label: "Data & text" },
  { id: "image", label: "Image tools" },
  { id: "pdf", label: "PDF tools" },
  { id: "convert", label: "Convert & extract" },
]

export type Tool = {
  href: string
  icon: IconSvgElement
  name: string
  description: string
  category: Category
}

export const TOOLS: Tool[] = [
  {
    href: "/json-parser",
    icon: BracesIcon,
    name: "JSON Parser",
    description: "Validate, format, and explore JSON as a tree.",
    category: "data",
  },
  {
    href: "/inline-calculator",
    icon: Calculator01Icon,
    name: "Inline Calculator",
    description: "Evaluate math expressions inline as you type.",
    category: "data",
  },
  {
    href: "/text-diff",
    icon: FileDiffIcon,
    name: "Text Diff",
    description: "Compare two text files line by line and see what changed.",
    category: "data",
  },
  {
    href: "/text-escaper",
    icon: CodeIcon,
    name: "Text Escaper",
    description:
      "Escape or decode text for HTML, JavaScript, JSON, or a URL, side by side.",
    category: "data",
  },
  {
    href: "/env-example-creator",
    icon: Key01Icon,
    name: ".env.example Creator",
    description:
      "Paste a .env file and get a .env.example with keys kept and values blanked out.",
    category: "data",
  },
  {
    href: "/video-to-audio",
    icon: AudioWave01Icon,
    name: "Video to Audio",
    description:
      "Extract a video's audio track to a WAV file, in your browser.",
    category: "convert",
  },
  {
    href: "/image-converter",
    icon: Image01Icon,
    name: "Image Converter",
    description:
      "Convert images between PNG, JPEG, WebP, and BMP, entirely in your browser.",
    category: "convert",
  },
  {
    href: "/image-blur",
    icon: BlurIcon,
    name: "Image Blur",
    description:
      "Select a rectangle on an image and blur just that region, in your browser.",
    category: "image",
  },
  {
    href: "/image-crop",
    icon: ImageCropIcon,
    name: "Image Crop",
    description:
      "Crop images to a selection, and give transparent PNGs a background color.",
    category: "image",
  },
  {
    href: "/image-trim",
    icon: ScissorRectangleIcon,
    name: "Image Trim",
    description:
      "Automatically crop away transparent margins around an image, in your browser.",
    category: "image",
  },
  {
    href: "/image-resize",
    icon: Resize02Icon,
    name: "Image Resize",
    description: "Resize an image to any width and height, in your browser.",
    category: "image",
  },
  {
    href: "/image-rotate",
    icon: ImageRotationClockwiseIcon,
    name: "Image Rotate",
    description: "Rotate images in 90° steps, in your browser.",
    category: "image",
  },
  {
    href: "/image-scan",
    icon: ScanIcon,
    name: "Image Scan",
    description:
      "Drag a photographed document's corners to straighten it into a flat scan, in your browser.",
    category: "image",
  },
  {
    href: "/pdf-unlock",
    icon: FileUnlockedIcon,
    name: "PDF Unlock",
    description:
      "Remove a PDF's password and download an unlocked copy, in your browser.",
    category: "pdf",
  },
  {
    href: "/pdf-lock",
    icon: FileLockedIcon,
    name: "PDF Lock",
    description:
      "Add a password to a PDF and download a locked copy, in your browser.",
    category: "pdf",
  },
  {
    href: "/pdf-merge",
    icon: FileStackIcon,
    name: "PDF Merge",
    description:
      "Combine multiple PDFs into one, in any order, in your browser.",
    category: "pdf",
  },
  {
    href: "/image-to-pdf",
    icon: Pdf01Icon,
    name: "Image to PDF",
    description:
      "Combine images into a single PDF, one page each, in your browser.",
    category: "pdf",
  },
  {
    href: "/pdf-to-images",
    icon: ImageDownloadIcon,
    name: "PDF to Images",
    description:
      "Export every page of a PDF as a PNG or JPEG image, in your browser.",
    category: "pdf",
  },
  {
    href: "/id-card-merge",
    icon: IdentityCardIcon,
    name: "ID Card Merge",
    description:
      "Combine a front and back image, or a two-page PDF, onto a single page as an image or PDF, in your browser.",
    category: "pdf",
  },
  {
    href: "/svg-to-png",
    icon: Png01Icon,
    name: "SVG to PNG",
    description: "Convert SVG files to PNG at any resolution, in your browser.",
    category: "convert",
  },
  {
    href: "/square-image-generator",
    icon: SquareIcon,
    name: "Square Image Generator",
    description:
      "Fit any image into a square canvas at any size, in your browser.",
    category: "image",
  },
  {
    href: "/image-round-corners",
    icon: SquareRoundCornerIcon,
    name: "Image Round Corners",
    description: "Round an image's corners to any radius, in your browser.",
    category: "image",
  },
]

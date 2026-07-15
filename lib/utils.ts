import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Read the first file in a picked/dropped `FileList` as text, or `null` if empty. */
export async function readFirstFileAsText(
  files: FileList | null
): Promise<string | null> {
  const file = files?.[0]
  return file ? file.text() : null
}

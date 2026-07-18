// Tailwind's preflight resets heading/list/link/code styling to `inherit`
// or `none`, so every one of those needs an explicit override here - there's
// no `@tailwindcss/typography` plugin in this project to fall back on.
const PROSE_CLASSNAME =
  "max-w-none text-sm leading-relaxed text-foreground " +
  "[&_h1]:mt-6 [&_h1]:mb-3 [&_h1]:text-2xl [&_h1]:font-semibold [&_h1]:first:mt-0 " +
  "[&_h2]:mt-6 [&_h2]:mb-3 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:first:mt-0 " +
  "[&_h3]:mt-5 [&_h3]:mb-2 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:first:mt-0 " +
  "[&_h4]:mt-4 [&_h4]:mb-2 [&_h4]:text-base [&_h4]:font-semibold " +
  "[&_h5]:mt-4 [&_h5]:mb-2 [&_h5]:text-sm [&_h5]:font-semibold " +
  "[&_h6]:mt-4 [&_h6]:mb-2 [&_h6]:text-sm [&_h6]:font-semibold [&_h6]:text-muted-foreground " +
  "[&_p]:my-3 [&_p]:first:mt-0 " +
  "[&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2 " +
  "[&_strong]:font-semibold [&_em]:italic [&_del]:line-through " +
  "[&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-6 " +
  "[&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-6 " +
  "[&_li]:my-1 " +
  "[&_blockquote]:my-3 [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-4 [&_blockquote]:text-muted-foreground " +
  "[&_hr]:my-6 [&_hr]:border-border " +
  "[&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-xs " +
  "[&_pre]:my-3 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-muted [&_pre]:p-3 " +
  "[&_pre_code]:bg-transparent [&_pre_code]:p-0 " +
  "[&_img]:my-3 [&_img]:max-w-full [&_img]:rounded-lg " +
  "[&_table]:my-3 [&_table]:w-full [&_table]:border-collapse [&_table]:text-left " +
  "[&_th]:border [&_th]:border-border [&_th]:bg-muted [&_th]:p-2 [&_th]:font-semibold " +
  "[&_td]:border [&_td]:border-border [&_td]:p-2"

/** Renders sanitized markdown HTML (see `renderMarkdownToHtml`) with the app's own heading/list/code styling. */
export function MarkdownView({ html }: { html: string }) {
  return (
    <div
      className={PROSE_CLASSNAME}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

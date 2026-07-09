# Project instructions

- Do not use the Claude Preview dev server tools (preview_start, preview_*) for this project. Removed `.claude/launch.json`; do not recreate it or start a dev server via the preview tooling.
- Before touching any `app/<tool-name>/page.tsx` or a shared component under `components/`, read [AGENTS.md](AGENTS.md) — it documents this codebase's conventions (the `ToolPage` wrapper props like `segments`/`footer`/`onAddFile`, the Hugeicons icon convention, `useRectSelection`, `Dropzone`/`Attachment` usage, button styling, etc.). Follow it exactly; it is not optional background reading.
- Never run `git commit` without asking the user first, even if a task's instructions seem to imply committing is the obvious next step. Make the code changes, then explicitly ask before committing. This applies regardless of branch.
- Commit messages and PR titles follow the Conventional Commits standard: `type(scope): description`, with `scope` naming the affected tool/module (e.g. `feat(image-round-corners): add image round corners tool`).

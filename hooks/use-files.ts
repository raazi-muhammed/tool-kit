"use client"

import { useRef, useState } from "react"

/**
 * Unified queue of picked files for every tool: each file becomes a job via
 * `createJob`, optionally decoded into a working `resource` (a canvas,
 * image, …) via `loadResource` — kept in a ref map since editors mutate it
 * imperatively (`setResource`) rather than through React state — with one
 * job tracked as `active`, auto-advancing on add/remove/clear, for
 * single-editor tools (crop, blur, resize, …). Batch tools (convert,
 * unlock, …) that show every job at once simply ignore
 * `activeId`/`activeJob`/the resource helpers.
 */
export function useFiles<TJob extends { id: number; file: File }, TResource = never>({
  createJob,
  loadResource,
  cleanupJob,
}: {
  /** Build a job for a newly picked (and, if `loadResource` is set, successfully decoded) file. */
  createJob: (file: File, id: number) => TJob
  /** Decode a picked file into its working resource. Throw to skip the file. */
  loadResource?: (file: File) => Promise<TResource>
  /** Release any resources (object URLs, etc.) a job was holding when it's removed or the queue is cleared. */
  cleanupJob?: (job: TJob) => void
}) {
  const [jobs, setJobs] = useState<TJob[]>([])
  const [activeId, setActiveId] = useState<number | null>(null)
  const resourcesRef = useRef<Map<number, TResource>>(new Map())
  const idRef = useRef(0)

  const activeJob = jobs.find((job) => job.id === activeId) ?? null

  /** Returns the newly created jobs, plus how many files were skipped (loadResource threw). */
  async function addFiles(fileList: FileList | null | undefined) {
    const files = fileList ? Array.from(fileList) : []
    if (!files.length) return { jobs: [] as TJob[], addedCount: 0, failedCount: 0 }

    const loaded = await Promise.all(
      files.map(async (file) => {
        if (!loadResource) return { file, resource: undefined as TResource | undefined }
        try {
          return { file, resource: await loadResource(file) }
        } catch {
          return null
        }
      })
    )

    const valid = loaded.filter((v): v is NonNullable<typeof v> => v !== null)
    const created = valid.map((v) => {
      const id = idRef.current++
      if (v.resource !== undefined) resourcesRef.current.set(id, v.resource)
      return createJob(v.file, id)
    })

    if (created.length) {
      setJobs((prev) => [...prev, ...created])
      setActiveId((prev) => prev ?? created[0].id)
    }
    return { jobs: created, addedCount: created.length, failedCount: files.length - created.length }
  }

  /**
   * Patch a job's fields. Pass a function to compute the patch from the
   * job's current state (e.g. to revoke a stale result URL before replacing
   * it) — it naturally no-ops if the job was already removed, since `map`
   * only invokes it for a matching id.
   */
  function updateJob(id: number, patch: Partial<TJob> | ((job: TJob) => Partial<TJob>)) {
    setJobs((prev) =>
      prev.map((job) => (job.id === id ? { ...job, ...(typeof patch === "function" ? patch(job) : patch) } : job))
    )
  }

  function removeJob(id: number) {
    const job = jobs.find((j) => j.id === id)
    if (job) cleanupJob?.(job)
    resourcesRef.current.delete(id)
    const next = jobs.filter((j) => j.id !== id)
    setJobs(next)
    if (activeId === id) setActiveId(next.length ? next[0].id : null)
  }

  function clear() {
    jobs.forEach((job) => cleanupJob?.(job))
    resourcesRef.current.clear()
    setJobs([])
    setActiveId(null)
  }

  /** The current resource for a job (the active one by default). */
  function getResource(id: number | null = activeId): TResource | undefined {
    return id == null ? undefined : resourcesRef.current.get(id)
  }

  function setResource(id: number, resource: TResource) {
    resourcesRef.current.set(id, resource)
  }

  return {
    jobs,
    activeId,
    setActiveId,
    activeJob,
    addFiles,
    updateJob,
    removeJob,
    clear,
    getResource,
    setResource,
  }
}

/**
 * Wraps a `useFiles().addFiles` call to surface a message via `setError`
 * when every picked file was skipped (`loadResource` threw for all of
 * them), clearing it otherwise.
 */
export async function addFilesReportingErrors(
  addFiles: (fileList: FileList | null | undefined) => Promise<{ addedCount: number; failedCount: number }>,
  fileList: FileList | null | undefined,
  message: string,
  setError: (error: string | null) => void
) {
  const { addedCount, failedCount } = await addFiles(fileList)
  setError(addedCount === 0 && failedCount > 0 ? message : null)
}

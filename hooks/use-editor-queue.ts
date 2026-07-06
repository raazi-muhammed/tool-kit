"use client"

import { useRef, useState } from "react"

/**
 * Queue of files edited one at a time in an interactive canvas editor
 * (crop, blur): each picked file is decoded into a working `resource` (a
 * canvas, kept in a ref map since it's mutated imperatively rather than
 * through React state) and the queue tracks which job is currently active,
 * switching automatically when the active one is removed.
 */
export function useEditorQueue<TJob extends { id: number; file: File }, TResource>({
  loadResource,
  createJob,
  cleanupJob,
}: {
  /** Decode a picked file into its working resource. Throw to skip the file. */
  loadResource: (file: File) => Promise<TResource>
  createJob: (file: File, id: number) => TJob
  cleanupJob?: (job: TJob) => void
}) {
  const [jobs, setJobs] = useState<TJob[]>([])
  const [activeId, setActiveId] = useState<number | null>(null)
  const resourcesRef = useRef<Map<number, TResource>>(new Map())
  const idRef = useRef(0)

  const activeJob = jobs.find((job) => job.id === activeId) ?? null

  async function addFiles(fileList: FileList | null | undefined) {
    const files = fileList ? Array.from(fileList) : []
    if (!files.length) return { addedCount: 0, failedCount: 0 }

    const loaded = await Promise.all(
      files.map(async (file) => {
        try {
          const resource = await loadResource(file)
          return { id: idRef.current++, file, resource }
        } catch {
          return null
        }
      })
    )

    const valid = loaded.filter((v): v is NonNullable<typeof v> => v !== null)
    if (valid.length) {
      valid.forEach((v) => resourcesRef.current.set(v.id, v.resource))
      const newJobs = valid.map((v) => createJob(v.file, v.id))
      setJobs((prev) => [...prev, ...newJobs])
      setActiveId((prev) => prev ?? newJobs[0].id)
    }
    return { addedCount: valid.length, failedCount: files.length - valid.length }
  }

  function updateJob(id: number, patch: Partial<TJob>) {
    setJobs((prev) => prev.map((job) => (job.id === id ? { ...job, ...patch } : job)))
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

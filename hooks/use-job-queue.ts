"use client"

import { useRef, useState } from "react"

/**
 * Generic queue of per-file jobs for batch-processing tools (convert,
 * resize, unlock, …): add a `FileList`, get back one job per file via
 * `createJob`, then patch/remove/clear them as processing progresses.
 * `cleanupJob` releases any resources (object URLs, etc.) a job was
 * holding when it's removed or the queue is cleared.
 */
export function useJobQueue<TJob extends { id: number }>({
  createJob,
  cleanupJob,
}: {
  createJob: (file: File, id: number) => TJob
  cleanupJob?: (job: TJob) => void
}) {
  const [jobs, setJobs] = useState<TJob[]>([])
  const idRef = useRef(0)

  /** Returns the newly created jobs, e.g. to kick off async work per job. */
  function addFiles(fileList: FileList | null | undefined): TJob[] {
    const files = fileList ? Array.from(fileList) : []
    if (!files.length) return []
    const created = files.map((file) => createJob(file, idRef.current++))
    setJobs((prev) => [...prev, ...created])
    return created
  }

  function updateJob(id: number, patch: Partial<TJob>) {
    setJobs((prev) => prev.map((job) => (job.id === id ? { ...job, ...patch } : job)))
  }

  function removeJob(id: number) {
    setJobs((prev) =>
      prev.filter((job) => {
        if (job.id === id) cleanupJob?.(job)
        return job.id !== id
      })
    )
  }

  function clear() {
    setJobs((prev) => {
      prev.forEach((job) => cleanupJob?.(job))
      return []
    })
  }

  return { jobs, setJobs, addFiles, updateJob, removeJob, clear }
}

"use client"

import { useState } from "react"

import { useFiles } from "@/hooks/use-files"

/**
 * Wraps `useFiles` for tools that combine every queued file into one output
 * in a user-chosen order (PDF Merge, Image to PDF, …) — `useFiles` itself
 * only tracks append order with no reordering of its own, so this layers a
 * separate permutation of job ids on top: appended to in `addFilesOrdered`,
 * trimmed in `removeOrdered`, and shuffled via `moveJob`.
 */
export function useOrderedFiles<
  TJob extends { id: number; file: File },
  TResource = never,
>(options: {
  createJob: (file: File, id: number) => TJob
  loadResource?: (file: File) => Promise<TResource>
  cleanupJob?: (job: TJob) => void
}) {
  const { jobs, addFiles, removeJob, ...rest } = useFiles<TJob, TResource>(
    options
  )
  const [order, setOrder] = useState<number[]>([])

  async function addFilesOrdered(fileList: FileList | null | undefined) {
    const result = await addFiles(fileList)
    if (result.jobs.length)
      setOrder((prev) => [...prev, ...result.jobs.map((job) => job.id)])
    return result
  }

  function removeOrdered(id: number) {
    removeJob(id)
    setOrder((prev) => prev.filter((jobId) => jobId !== id))
  }

  function moveJob(id: number, direction: -1 | 1) {
    setOrder((prev) => {
      const index = prev.indexOf(id)
      const swapIndex = index + direction
      if (index < 0 || swapIndex < 0 || swapIndex >= prev.length) return prev
      const next = [...prev]
      ;[next[index], next[swapIndex]] = [next[swapIndex], next[index]]
      return next
    })
  }

  const orderedJobs = order
    .map((id) => jobs.find((job) => job.id === id))
    .filter((job): job is TJob => !!job)

  return {
    jobs,
    orderedJobs,
    addFilesOrdered,
    removeOrdered,
    moveJob,
    ...rest,
  }
}

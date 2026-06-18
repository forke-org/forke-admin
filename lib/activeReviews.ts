/**
 * Active Review Job Controller
 * Manages running AI review jobs with AbortController support
 * so newer pushes can cancel in-flight reviews.
 */

export interface ActiveReviewJob {
  abortController: AbortController
}

const globalForActiveReviews = globalThis as unknown as {
  activeReviews: Map<string, ActiveReviewJob> | undefined
}

export const activeReviews =
  globalForActiveReviews.activeReviews ?? new Map<string, ActiveReviewJob>()
if (process.env.NODE_ENV !== 'production')
  globalForActiveReviews.activeReviews = activeReviews

/** Unique key per PR for tracking */
export function getJobKey(sandboxRepo: string, prNumber: number): string {
  return `${sandboxRepo.toLowerCase()}-${prNumber}`
}

/**
 * Registers a new review job. Aborts any existing job for the same PR.
 */
export function registerReviewJob(
  sandboxRepo: string,
  prNumber: number
): AbortController {
  const key = getJobKey(sandboxRepo, prNumber)

  const existing = activeReviews.get(key)
  if (existing) {
    console.log(
      `[Job Manager] Aborting previous review for ${sandboxRepo} PR #${prNumber}`
    )
    try {
      existing.abortController.abort()
    } catch (e) {
      console.error(`[Job Manager] Abort error:`, e)
    }
  }

  const abortController = new AbortController()
  activeReviews.set(key, { abortController })
  return abortController
}

/** Cleans up a completed/failed job */
export function unregisterReviewJob(
  sandboxRepo: string,
  prNumber: number
): void {
  const key = getJobKey(sandboxRepo, prNumber)
  activeReviews.delete(key)
}

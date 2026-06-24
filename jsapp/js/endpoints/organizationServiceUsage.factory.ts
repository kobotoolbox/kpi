import type { UserReportsServiceUsageResponse } from '#/api/models/userReportsServiceUsageResponse'

/**
 * Factory functions for creating mock usage data with different limit scenarios.
 * Useful in Storybook to test how the UI responds to warnings and exceeded limits.
 *
 * Instead of writing out full balance objects with calculated values, just call
 * the preset that matches your scenario:
 *   - storageWarning() for 95% storage used (triggers warning banner)
 *   - storageExceeded() for 110% storage used (triggers error banner)
 *   - submissionExceeded() for 110% submissions used
 *   - bothExceeded() for both limits at 110%
 */

const SUBMISSION_LIMIT = 10000
const STORAGE_LIMIT = 1000000000

/**
 * Helper that builds a usage response from two percentages.
 * Why percentages? The UI cares about percent thresholds (80%+ = warning, 100%+ = error).
 * This helper calculates balance_value (how much is left) and exceeded flag for you.
 *
 * How balance_value works:
 * - If you used 90% of 10000, you have 10% left = 10000 * 0.1 = 1000 remaining
 * - If you used 110%, you're over by 10% = 10000 * -0.1 = -1000 (negative = over limit)
 *
 * @param submissionPercent - How full the submission quota is (0-100+ where >100 = exceeded)
 * @param storagePercent - How full the storage quota is (0-100+)
 */
function createUsageLimits(
  submissionPercent: number,
  storagePercent: number,
): Partial<UserReportsServiceUsageResponse> {
  const submissionBalance = Math.round(SUBMISSION_LIMIT * (1 - submissionPercent / 100))
  const storageBalance = Math.round(STORAGE_LIMIT * (1 - storagePercent / 100))

  return {
    balances: {
      submission: {
        effective_limit: SUBMISSION_LIMIT,
        balance_value: submissionBalance,
        balance_percent: submissionPercent,
        exceeded: submissionPercent > 100,
      },
      storage_bytes: {
        effective_limit: STORAGE_LIMIT,
        balance_value: storageBalance,
        balance_percent: storagePercent,
        exceeded: storagePercent > 100,
      },
      asr_seconds: null,
      mt_characters: null,
      llm_requests: null,
    },
  }
}

// Preset 1: Storage approaching the limit (triggers warning banner)
export function storageWarning(): Partial<UserReportsServiceUsageResponse> {
  return createUsageLimits(90, 95)
}

// Preset 2: Storage over the limit (triggers error banner)
export function storageExceeded(): Partial<UserReportsServiceUsageResponse> {
  return createUsageLimits(90, 110)
}

// Preset 3: Submissions over the limit (triggers error banner)
export function submissionExceeded(): Partial<UserReportsServiceUsageResponse> {
  return createUsageLimits(110, 87)
}

// Preset 4: Both limits exceeded (triggers error banner)
export function bothExceeded(): Partial<UserReportsServiceUsageResponse> {
  return createUsageLimits(110, 110)
}

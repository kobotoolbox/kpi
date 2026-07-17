import type { ServiceUsageResponse } from '#/api/models/serviceUsageResponse'

/**
 * Factory functions for creating mock service usage data with different limit scenarios.
 * Useful for testing bulk processing alerts for ASR (transcription) and MT (translation).
 *
 * Note: NOT migrated to Orval because this file provides valuable domain-specific
 * presets (asrExceeded, mtExceeded, asrNearLimit, etc.) that calculate percentage-based
 * quotas. These presets encode business logic about ASR (transcription) and MT (translation)
 * service limits and make tests more readable than passing raw quota values to Orval mocks.
 *
 * Instead of writing out full balance objects with calculated values, just call
 * the preset that matches your scenario:
 *   - asrExceeded() for transcription quota exceeded
 *   - mtExceeded() for translation quota exceeded
 *   - asrNearLimit() for transcription near limit (custom percentage)
 *   - mtNearLimit() for translation near limit (custom percentage)
 */

const ASR_SECONDS_LIMIT = 600 // 10 minutes default
const MT_CHARACTERS_LIMIT = 50000 // 50k characters default

/**
 * Helper that builds a complete service usage response from percentages for ASR and MT.
 * The UI cares about percent thresholds (100%+ = exceeded).
 * This helper calculates balance_value (how much is left) and exceeded flag for you.
 *
 * How balance_value works:
 * - If you used 90% of 600 seconds, you have 10% left = 600 * 0.1 = 60 seconds remaining
 * - If you used 110%, you're over by 10% = 600 * -0.1 = -60 (negative = over limit)
 *
 * @param asrPercent - How full the ASR quota is (0-100+ where >100 = exceeded)
 * @param mtPercent - How full the MT quota is (0-100+ where >100 = exceeded)
 */
function createServiceUsage(asrPercent: number, mtPercent: number): ServiceUsageResponse {
  const asrBalance = Math.round(ASR_SECONDS_LIMIT * (1 - asrPercent / 100))
  const mtBalance = Math.round(MT_CHARACTERS_LIMIT * (1 - mtPercent / 100))

  return {
    balances: {
      asr_seconds: {
        effective_limit: ASR_SECONDS_LIMIT,
        balance_value: asrBalance,
        balance_percent: asrPercent,
        exceeded: asrPercent >= 100,
      },
      mt_characters: {
        effective_limit: MT_CHARACTERS_LIMIT,
        balance_value: mtBalance,
        balance_percent: mtPercent,
        exceeded: mtPercent >= 100,
      },
      submission: null,
      storage_bytes: null,
      llm_requests: null,
    },
    total_nlp_usage: {
      asr_seconds_current_period: 0,
      llm_requests_current_period: 0,
      mt_characters_current_period: 0,
      asr_seconds_all_time: 0,
      llm_requests_all_time: 0,
      mt_characters_all_time: 0,
    },
    total_storage_bytes: 0,
    total_submission_count: {
      current_period: 0,
      all_time: 0,
    },
    current_period_start: '2026-06-01T00:00:00Z',
    current_period_end: '2026-07-01T00:00:00Z',
    last_updated: '2026-06-25T00:00:00Z',
  }
}

// Preset: ASR (transcription) quota exceeded
export function asrExceeded(): ServiceUsageResponse {
  return createServiceUsage(110, 50)
}

// Preset: MT (translation) quota exceeded
export function mtExceeded(): ServiceUsageResponse {
  return createServiceUsage(50, 110)
}

// Preset: Both ASR and MT quotas exceeded
export function bothExceeded(): ServiceUsageResponse {
  return createServiceUsage(110, 110)
}

// Preset: ASR near limit (custom percentage, default 95%)
export function asrNearLimit(percent = 95): ServiceUsageResponse {
  return createServiceUsage(percent, 50)
}

// Preset: MT near limit (custom percentage, default 95%)
export function mtNearLimit(percent = 95): ServiceUsageResponse {
  return createServiceUsage(50, percent)
}

// Preset: Well within limits
export function withinLimits(): ServiceUsageResponse {
  return createServiceUsage(50, 50)
}

import type { AlertSeverity, AlertValidationResult } from './types'

/**
 * Helper function to create an inactive alert result
 * Use this when a validator determines no alert should be shown
 */
export function createInactiveResult(type: AlertSeverity = 'warning'): AlertValidationResult {
  return {
    shouldShow: false,
    type,
    filteredSubmissionUuids: [],
    computedValues: {},
  }
}

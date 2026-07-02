import type { AlertEvaluationResult, AlertSeverity } from './types'

/**
 * Helper function to create an inactive alert result
 * Use this when an evaluator determines no alert should be shown
 */
export function createInactiveResult(type: AlertSeverity = 'warning'): AlertEvaluationResult {
  return {
    shouldShow: false,
    type,
    filteredSubmissionUuids: [],
    computedValues: {},
  }
}

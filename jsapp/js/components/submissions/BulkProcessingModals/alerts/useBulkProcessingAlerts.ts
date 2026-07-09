import { useMemo } from 'react'
import type { BulkActionResponse } from '#/api/models/bulkActionResponse'
import type { ServiceUsageResponse } from '#/api/models/serviceUsageResponse'
import type { LanguageCode } from '#/components/languages/languagesStore'
import type { SubmissionResponse } from '#/dataInterface'
import { getAlertDefinitions } from './alertDefinitions'
import type { ActiveAlert, AlertEvaluationContext, BulkActionType } from './types'

interface UseBulkProcessingAlertsProps {
  actionType: BulkActionType
  selectedSubmissions: SubmissionResponse[]
  selectedLanguage?: LanguageCode
  /** Selected region (transcription only) */
  selectedRegion?: string
  fieldXpath: string
  /** Required amount for full job in base units: seconds (transcription) or characters (translation). */
  nearLimitRequiredAmount?: number
  serviceUsageData?: ServiceUsageResponse
  activeBulkActions: BulkActionResponse[]
}

interface UseBulkProcessingAlertsReturn {
  activeAlerts: ActiveAlert[]
  hasErrors: boolean
  hasWarnings: boolean
  /** True if there are errors other than 'no-eligible-submissions' */
  hasBlockingError: boolean
  /** Submissions eligible after filtering */
  eligibleSubmissions: SubmissionResponse[]
  /** UUIDs of eligible submissions */
  eligibleSubmissionUuids: string[]
}

/**
 * Custom hook for bulk processing alerts evaluation
 *
 * This hook evaluates all alert evaluators for the given action type, tracks which submissions are filtered
 * by warnings, and returns the active alerts along with evaluation state.
 */
export function useBulkProcessingAlerts(props: UseBulkProcessingAlertsProps): UseBulkProcessingAlertsReturn {
  const {
    actionType,
    selectedSubmissions,
    selectedLanguage,
    selectedRegion,
    fieldXpath,
    nearLimitRequiredAmount,
    serviceUsageData,
    activeBulkActions,
  } = props

  const alertDefinitions = useMemo(() => getAlertDefinitions(actionType), [actionType])

  // Evaluate all evaluators and compute active alerts
  const evaluationResult = useMemo(() => {
    // Track filtered submissions across all evaluators
    const filteredSubmissionUuids = new Set<string>()

    // Track active alerts
    const activeAlerts: ActiveAlert[] = []

    // Build evaluation context
    const context: AlertEvaluationContext = {
      submissions: selectedSubmissions,
      fieldXpath,
      selectedLanguage,
      selectedRegion,
      actionType,
      nearLimitRequiredAmount,
      serviceUsageData,
      activeBulkActions,
      previouslyFilteredSubmissionUuids: filteredSubmissionUuids,
    }

    // Evaluate each evaluator in priority order
    for (const alertDef of alertDefinitions) {
      const result = alertDef.evaluator(context)

      if (result.shouldShow) {
        // Add filtered submission uuids to the set (for warnings)
        if (result.type === 'warning') {
          result.filteredSubmissionUuids.forEach((uuid) => filteredSubmissionUuids.add(uuid))
        }

        // Create active alert
        const message = alertDef.messageTemplate(result.computedValues)
        activeAlerts.push({
          id: alertDef.id,
          type: alertDef.type,
          message,
          computedValues: result.computedValues,
          filteredSubmissionUuids: result.filteredSubmissionUuids,
        })
      }
    }

    // Compute eligible submissions (not filtered)
    const eligibleSubmissions = selectedSubmissions.filter(
      (submission) => !filteredSubmissionUuids.has(submission._uuid),
    )

    const eligibleSubmissionUuids = eligibleSubmissions.map((s) => s._uuid)

    // Compute evaluation state
    const hasErrors = activeAlerts.some((alert) => alert.type === 'error')
    const hasWarnings = activeAlerts.some((alert) => alert.type === 'warning')
    // This allows language selection even when only no-eligible-submissions error is present. We want users to be able
    // to select different language, as it could mean there will be eligible submissions.
    const hasBlockingError =
      hasErrors && activeAlerts.some((alert) => alert.type === 'error' && alert.id !== 'no-eligible-submissions')

    return {
      activeAlerts,
      hasErrors,
      hasWarnings,
      hasBlockingError,
      eligibleSubmissions,
      eligibleSubmissionUuids,
    }
  }, [
    selectedSubmissions,
    fieldXpath,
    selectedLanguage,
    selectedRegion,
    actionType,
    nearLimitRequiredAmount,
    serviceUsageData,
    activeBulkActions,
    alertDefinitions,
  ])

  return evaluationResult
}

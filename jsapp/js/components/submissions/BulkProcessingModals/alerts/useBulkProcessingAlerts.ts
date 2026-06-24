import { useMemo } from 'react'
import type { BulkActionResponse } from '#/api/models/bulkActionResponse'
import type { ServiceUsageResponse } from '#/api/models/serviceUsageResponse'
import type { LanguageCode } from '#/components/languages/languagesStore'
import type { SubmissionResponse } from '#/dataInterface'
import { getAlertDefinitions } from './alertDefinitions'
import type { ActiveAlert, AlertValidationContext, BulkActionType } from './types'

interface UseBulkProcessingAlertsProps {
  actionType: BulkActionType
  selectedSubmissions: SubmissionResponse[]
  selectedLanguage?: LanguageCode
  /** Selected region (transcription only) */
  selectedRegion?: string
  fieldXpath: string
  serviceUsageData?: ServiceUsageResponse
  activeBulkActions: BulkActionResponse[]
}

interface UseBulkProcessingAlertsReturn {
  activeAlerts: ActiveAlert[]
  hasErrors: boolean
  hasWarnings: boolean
  /** Submissions eligible after filtering */
  eligibleSubmissions: SubmissionResponse[]
  /** UUIDs of eligible submissions */
  eligibleSubmissionUuids: string[]
}

/**
 * Custom hook for bulk processing alerts validation
 *
 * This hook evaluates all alert validators for the given action type, tracks which submissions are filtered
 * by warnings, and returns the active alerts along with validation state.
 */
export function useBulkProcessingAlerts(props: UseBulkProcessingAlertsProps): UseBulkProcessingAlertsReturn {
  const {
    actionType,
    selectedSubmissions,
    selectedLanguage,
    selectedRegion,
    fieldXpath,
    serviceUsageData,
    activeBulkActions,
  } = props

  const alertDefinitions = useMemo(() => getAlertDefinitions(actionType), [actionType])

  // Evaluate all validators and compute active alerts
  const validationResult = useMemo(() => {
    // Track filtered submissions across all validators
    const filteredSubmissionUuids = new Set<string>()

    // Track active alerts
    const activeAlerts: ActiveAlert[] = []

    // Build validation context
    const context: AlertValidationContext = {
      submissions: selectedSubmissions,
      fieldXpath,
      selectedLanguage,
      selectedRegion,
      actionType,
      serviceUsageData,
      activeBulkActions,
      previouslyFilteredSubmissionUuids: filteredSubmissionUuids,
    }

    // Evaluate each validator in priority order
    for (const alertDef of alertDefinitions) {
      const result = alertDef.validator(context)

      if (result.shouldShow) {
        // Add filtered submission uuids to the set (for warnings)
        if (result.type === 'warning') {
          result.filteredSubmissionUuids.forEach((uuid) => filteredSubmissionUuids.add(uuid))

          // Debug logging
          console.info(
            `[BulkProcessingAlerts] Alert "${alertDef.id}" filtered ${result.filteredSubmissionUuids.length} submissions:`,
            result.filteredSubmissionUuids,
          )
        }

        // Create active alert
        const message = alertDef.messageTemplate(result.computedValues)
        activeAlerts.push({
          id: alertDef.id,
          type: alertDef.type,
          message,
          computedValues: result.computedValues,
        })
      }
    }

    // Compute eligible submissions (not filtered)
    const eligibleSubmissions = selectedSubmissions.filter(
      (submission) => !filteredSubmissionUuids.has(submission._uuid),
    )

    const eligibleSubmissionUuids = eligibleSubmissions.map((s) => s._uuid)

    // Compute validation state
    const hasErrors = activeAlerts.some((alert) => alert.type === 'error')
    const hasWarnings = activeAlerts.some((alert) => alert.type === 'warning')

    return {
      activeAlerts,
      hasErrors,
      hasWarnings,
      eligibleSubmissions,
      eligibleSubmissionUuids,
    }
  }, [
    selectedSubmissions,
    fieldXpath,
    selectedLanguage,
    selectedRegion,
    actionType,
    serviceUsageData,
    activeBulkActions,
    alertDefinitions,
  ])

  return validationResult
}

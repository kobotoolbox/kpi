import type { BulkActionResponse } from '#/api/models/bulkActionResponse'
import type { ServiceUsageResponse } from '#/api/models/serviceUsageResponse'
import type { LanguageCode } from '#/components/languages/languagesStore'
import type { SubmissionResponse } from '#/dataInterface'

/**
 * Alert severity types
 * - error: Blocks requesting bulk action (e.g., quota exceeded, no eligible submissions)
 * - warning: Informational, some submissions were filtered out (e.g., already transcribed)
 */
export type AlertSeverity = 'error' | 'warning'

export type BulkActionType = 'transcript' | 'translation'

/**
 * Context passed to alert validators
 */
export interface AlertValidationContext {
  /** Submissions to validate */
  submissions: SubmissionResponse[]
  fieldXpath: string
  selectedLanguage?: LanguageCode
  /** For transcription only */
  selectedRegion?: string
  actionType: BulkActionType
  serviceUsageData?: ServiceUsageResponse
  activeBulkActions: BulkActionResponse[]
  previouslyFilteredSubmissionUuids: Set<string>
}

/**
 * Result returned by alert validators
 */
export interface AlertValidationResult {
  /** Whether this alert should be displayed */
  shouldShow: boolean
  type: AlertSeverity
  /** Submission Uuids filtered out by this validator */
  filteredSubmissionUuids: string[]
  /** Computed values for messages */
  computedValues: Record<string, any>
}

/**
 * Alert definition configuration
 * Alerts are evaluated in array order - first alert has highest priority
 */
export interface AlertDefinition {
  /** Unique alert identifier */
  id: string
  type: AlertSeverity
  validator: (context: AlertValidationContext) => AlertValidationResult
  messageTemplate: (values: Record<string, any>) => string
}

/**
 * Active alert with resolved message
 */
export interface ActiveAlert {
  /** Alert ID */
  id: string
  type: AlertSeverity
  message: string
  computedValues: Record<string, any>
}

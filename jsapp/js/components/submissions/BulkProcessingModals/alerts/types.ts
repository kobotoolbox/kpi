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

/**
 * Bulk actions that can show alerts.
 *
 * `approve` only accepts content that is already there, so it doesn't need the
 * quota, language or source checks the other two use. It gets its own short list
 * of alerts in `getAlertDefinitions`, which is why evaluators that look at
 * `actionType` only ever see `transcript` or `translation`.
 */
export type BulkActionType = 'transcript' | 'translation' | 'approve'

/**
 * Context passed to alert evaluators
 */
export interface AlertEvaluationContext {
  /** Submissions to evaluate */
  submissions: SubmissionResponse[]
  fieldXpath: string
  selectedLanguage?: LanguageCode
  /** For transcription only */
  selectedRegion?: string
  actionType: BulkActionType
  /** Required amount to process all selected submissions in base units: seconds (transcription) or characters (translation). */
  requiredAmount?: number
  serviceUsageData?: ServiceUsageResponse
  activeBulkActions: BulkActionResponse[]
  /**
   * Every submission uuid in this pipeline is a root uuid (`getSubmissionRootUuid`), since that is the only id the
   * bulk endpoints know. Evaluators must keep it that way, or an edited submission slips past the skip check below and
   * gets evaluated twice.
   */
  previouslyFilteredSubmissionUuids: Set<string>
}

/**
 * A "show alert" result returned by alert evaluators (otherwise it returns `null`)
 */
export interface AlertEvaluationResult {
  type: AlertSeverity
  /** Root uuids of the submissions this evaluator filtered out */
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
  evaluator: (context: AlertEvaluationContext) => AlertEvaluationResult | null
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
  /** Optional root uuids filtered by this alert, used by modal-specific follow-up calculations */
  filteredSubmissionUuids?: string[]
}

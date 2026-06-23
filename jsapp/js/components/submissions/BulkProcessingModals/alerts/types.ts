import type { BulkActionResponse } from '#/api/models/bulkActionResponse'
import type { ServiceUsageResponse } from '#/api/models/serviceUsageResponse'
import type { LanguageCode } from '#/components/languages/languagesStore'
import type { SubmissionResponse } from '#/dataInterface'

/**
 * Alert severity types
 * - error: Blocks requesting bulk action (e.g., quota exceeded, no eligible submissions)
 * - warning: Informational, some submissions were filtered out (e.g., already transcribed)
 */
export type AlertType = 'error' | 'warning'

/**
 * Action type for bulk processing
 */
export type ActionType = 'transcript' | 'translation'

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
  actionType: ActionType
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
  type: AlertType
  /** Submission Uuids filtered out by this validator (for warnings) */
  filteredSubmissionUuids: string[]
  /** Computed values for messages */
  computedValues: Record<string, any>
}

/**
 * Message template function
 */
export type MessageTemplate = (values: Record<string, any>) => string

/**
 * Alert validator function type
 */
export type AlertValidator = (context: AlertValidationContext) => AlertValidationResult

/**
 * Alert definition configuration
 */
export interface AlertDefinition {
  /** Unique alert identifier */
  id: string
  type: AlertType
  priority: number
  validator: AlertValidator
  messageTemplate: MessageTemplate
}

/**
 * Active alert with resolved message
 */
export interface ActiveAlert {
  /** Alert ID */
  id: string
  type: AlertType
  message: string
  computedValues: Record<string, any>
}

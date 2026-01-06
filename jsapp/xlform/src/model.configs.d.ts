import type * as Backbone from 'backbone'

/**
 * Metadata definition for survey-level details (start, end, audit, etc.)
 */
export interface SurveyDetailDefinition {
  name: string
  label: string
  description: string
  default: boolean
  deprecated?: boolean
  aliases?: string[]
}

/**
 * Config for a RowDetail (XLSForm cell)
 */
export interface DefaultValueConfig {
  value: any | (() => any)
  _hideUnlessChanged?: boolean
}

/**
 * Master Question Type Metadata
 */
export interface QuestionType {
  name: string
  label: string
  preventRequired?: boolean
  isMedia?: boolean
  orOtherOption?: boolean
  specifyChoice?: boolean
  supportedByUI?: boolean
}

/**
 * The Configs module interface
 */
export interface Configs {
  defaultSurveyDetails: Record<string, SurveyDetailDefinition>
  surveyDetailSchema: Backbone.Collection<Backbone.Model>

  /** Default settings for a brand new standard question */
  newRowDetails: Record<string, DefaultValueConfig>

  /** Default settings for a brand new group or repeat */
  newGroupDetails: Record<string, DefaultValueConfig>

  /** Type-specific overrides (e.g. Geopoint defaults to 'Record your current location') */
  defaultsForType: Record<string, Record<string, DefaultValueConfig>>

  /** The master order of columns in the exported XLSForm */
  columns: string[]

  /** Helper to determine the index of a column for CSV ordering */
  columnOrder(key: string): number

  /** * Dictionary of parameter definitions (e.g. range start/end/step)
   */
  questionParams: Record<string, Record<string, { type: string; defaultValue?: any }>>

  /**
   * Returns metadata for a question type (e.g. lookupRowType('select_one'))
   */
  lookupRowType: {
    (typeId: string): QuestionType | undefined
    typeSelectList(): QuestionType[]
  }

  /** Valid strings that equate to true/false in XLSForm columns */
  truthyValues: string[]
  falsyValues: string[]
  boolOutputs: { true: string; false: string }

  autoset_kuid: boolean
}

declare const configs: Configs
export default configs

// Note: please be cautious in trusting those types. They should be fine, but AI helped build them.
//
// Context: this types definition file was built with AI assistance to significantly cut the time on building them.
// It was reviewed by a dev, but one who doesn't have full understanding of Backbone, plus Form Builder code written in
// CoffeeScript is quite old and rarely maintained - increasing the risk of having errors in here.
import type * as Backbone from 'backbone'

/** Metadata definition for survey-level details (start, end, audit, etc.) */
export interface SurveyDetailDefinition {
  name: string
  label: string
  description: string
  default: boolean
  deprecated?: boolean
  aliases?: string[]
}

/** Config for a RowDetail (XLSForm cell) */
export interface DefaultValueConfig {
  value: any | (() => any)
  _hideUnlessChanged?: boolean
}

export interface QuestionType {
  name: string
  label: string
  preventRequired?: boolean
  isMedia?: boolean
  orOtherOption?: boolean
  specifyChoice?: boolean
  supportedByUI?: boolean
}

/** The Configs module interface */
export interface Configs {
  defaultSurveyDetails: Record<string, SurveyDetailDefinition>
  surveyDetailSchema: Backbone.Collection<Backbone.Model>

  /** Default settings for a brand new standard question */
  newRowDetails: Record<string, DefaultValueConfig>

  /** Default settings for a brand new group or repeat */
  newGroupDetails: Record<string, DefaultValueConfig>

  /** Type-specific overrides */
  defaultsForType: Record<string, Record<string, DefaultValueConfig>>

  /** The master order of columns in the exported XLSForm */
  columns: string[]

  /** Helper to determine the index of a column for CSV ordering */
  columnOrder(key: string): number

  /** Dictionary of parameter definitions */
  questionParams: Record<string, Record<string, { type: string; defaultValue?: any }>>

  /** Returns metadata for a question type */
  lookupRowType: {
    (typeId: string): QuestionType | undefined
    typeSelectList(): QuestionType[]
  }

  // Valid strings that equate to true/false in XLSForm columns
  truthyValues: string[]
  falsyValues: string[]
  boolOutputs: { true: string; false: string }

  autoset_kuid: boolean
}

declare const configs: Configs
export default configs

import type { QuestionTypeName } from '#/constants'
import type { AssetResponseFile } from '#/dataInterface'
import { BaseModel } from './model.base'
import type { ChoiceLists } from './model.choices'
import type { SurveyDetails } from './model.surveyDetail'
import { SurveyFragment } from './model.surveyFragment'

export interface FlatRow {
  type: QuestionTypeName
  name?: string // `end_kobomatrix` might not have `name`
  label?: string | string[] // KPI often stores labels as arrays for translations
  hint?: string | string[]
  required?: string | boolean
  relevant?: string
  constraint?: string
  calculation?: string
  appearance?: string
  [key: string]: any // Allows for dynamic Kobo-specific attributes
}

export interface FlatChoice {
  list_name: string
  name: string
  label?: string | string[]
  [key: string]: any
}

export interface FlatSurvey {
  survey: FlatRow[]
  choices?: FlatChoice[] // Optional because it might be empty
  settings: Record<string, any>[] // CoffeeScript wraps settings in an array
  [key: string]: any // For dynamic props like lockingProfiles
}

/**
 * Interface representing the structure of a serialized XLSForm
 */
export interface CsvJsonStructure {
  columns: string[]
  rowObjects: Array<Record<string, any>>
}

export interface FullCsvJson {
  survey: CsvJsonStructure
  choices?: CsvJsonStructure
  settings: CsvJsonStructure
}

/**
 * Settings model for the Survey
 */
export class Settings extends BaseModel {
  auto_name: boolean
  changing_form_title: boolean
  toCsvJson(): CsvJsonStructure
  enable_auto_name(): void
}

/**
 * Main Survey Class
 */
export class Survey extends SurveyFragment {
  // Properties initialized in constructor
  settings: Settings
  lockingProfiles: any
  newRowDetails: any
  defaultsForType: any
  surveyDetails: SurveyDetails
  choices: ChoiceLists
  context: {
    warnings: any[]
    errors: any[]
  }

  availableFiles?: AssetResponseFile[]

  constructor(options?: any, addlOpts?: any)

  // Instance Methods
  linkUpChoiceLists(): void
  insert_row(row: any, index: number): any
  insertSurvey(survey: Survey, index?: number, targetGroupId?: string): void

  /** `stringify` is `false` by default, `spaces` is `4` by default */
  toFlatJSON(stringify?: boolean, spaces?: number): FlatSurvey
  toJSON(stringify?: boolean, spaces?: number): any

  getSurvey(): Survey
  log(opts?: { log?: (...args: any[]) => void }): void
  summarize(): { rowCount: number; hasGps: boolean }

  prepCols(cols: string[][], opts?: { exclude?: string[]; add?: string[] }): string[]
  toSsStructure(): Record<string, any[]>
  toCsvJson(): FullCsvJson
  toMarkdown(): string
  toCSV(): string

  // Internal/Helper Methods (often prefixed with _)
  _ensure_row_list_is_copied(row: any): void
  _insertRowInPlace(row: any, opts?: any): void

  /** * Static Methods
   */
  static create(options?: any, addlOpts?: any): Survey

  /**
   * Static Loaders
   */
  static load: {
    (csv_repr: string | any, _usingSurveyLoadCsv?: boolean): Survey
    csv(csv_repr: string): Survey
    md(md: string): Survey
  }

  static loadDict(obj: any, baseSurvey?: Survey): Survey
}

// The module exports an object containing these classes
declare const _default: {
  Survey: typeof Survey
  Settings: typeof Settings
}

export default _default

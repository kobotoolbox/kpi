import { BaseCollection, BaseModel } from './model.base'

/**
 * Represents a single metadata/survey-level detail row (e.g., start, deviceid).
 */
export class SurveyDetail extends BaseModel {
  idAttribute: 'name'

  attributes: {
    name: string
    value: any // Can be string ("true") or boolean depending on parsing
    parameters?: string
    [key: string]: any
  }

  /**
   * Serializes the detail for XLSForm export.
   * Returns false if the detail has no value (i.e., is toggled off).
   */
  toJSON(): { name: string; type: string; parameters?: string } | false
}

/**
 * Collection of SurveyDetail models.
 * Manages the available metadata options based on a provided schema.
 */
export class SurveyDetails extends BaseCollection<SurveyDetail> {
  model: typeof SurveyDetail
  private _schema: any

  /**
   * Initializes the collection based on a schema (usually from model.configs).
   * Note: After loading, the .add method is locked to prevent manual additions.
   */
  loadSchema(schema: { models: any[] }): this

  /**
   * Sets the value of each detail to its default defined in the schema.
   */
  importDefaults(): void

  /**
   * Imports a detail from a raw object (e.g., during file parsing).
   * Typically sets the value to 'true' to indicate it is active.
   */
  importDetail(detail: { type: string; parameters?: string }): void
}

declare const surveyDetail: {
  SurveyDetail: typeof SurveyDetail
  SurveyDetails: typeof SurveyDetails
}

export default surveyDetail

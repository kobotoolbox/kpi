// Note: please be cautious in trusting those types. They should be fine, but AI helped build them.
//
// Context: this types definition file was built with AI assistance to significantly cut the time on building them.
// It was reviewed by a dev, but one who doesn't have full understanding of Backbone, plus Form Builder code written in
// CoffeeScript is quite old and rarely maintained - increasing the risk of having errors in here.
import { BaseCollection, BaseModel } from './model.base'

/** Represents a single metadata/survey-level detail row */
export class SurveyDetail extends BaseModel {
  idAttribute: 'name'
  attributes: {
    name: string
    // NOTE: For truthy values it can be a string ("true") or boolean
    value: any
    parameters?: string
    [key: string]: any
  }
  /**
   * Serializes the detail for XLSForm export.
   * Returns false if the detail has no value (i.e. is toggled off).
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

  /** Initializes the collection based on a schema (usually from model.configs) */
  loadSchema(schema: { models: any[] }): this

  /** Sets the value of each detail to its default defined in the schema */
  importDefaults(): void

  /** Imports a detail from a raw object */
  importDetail(detail: { type: string; parameters?: string }): void
}

declare const surveyDetail: {
  SurveyDetail: typeof SurveyDetail
  SurveyDetails: typeof SurveyDetails
}
export default surveyDetail

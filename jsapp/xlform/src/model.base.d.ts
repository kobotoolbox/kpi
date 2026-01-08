import * as Backbone from 'backbone'

/** Base configuration for the XLForm model structure */
export interface BaseOptions {
  _parent?: any
}

/** Enhanced Collection that supports tree traversal back to the root Survey */
export class BaseCollection<T extends Backbone.Model> extends Backbone.Collection<T> {
  _parent: any
  constructor(models?: TModel[] | any[], options?: BaseOptions)

  /** Traverses up the parent chain until it finds the root Survey object */
  getSurvey(): any
}

/** Enhanced Model providing XLSForm-specific lifecycle and traversal methods */
export class BaseModel extends Backbone.Model {
  _parent: any
  constructor(attributes?: any, options?: BaseOptions)

  // Lifecycle placeholders
  parse(): void
  linkUp(ctx: any): void
  finalize(): void

  /**
   * Retrieves the value of an attribute from the RowDetail model.
   * Note: This usually returns a RowDetail object, not the raw string value.
   * Use `.getValue()` if you want the actual content.
   */
  get(attributeName: string): any

  /** Sets a hash of attributes (one or many) on the model */
  set(attributeName: string, value: any, options?: any): this
  set(attributes: any, options?: any): this

  /**
   * Smart getter: if the attribute is a RowDetail, returns its inner value.
   * If 'what' is omitted, looks for the "value" attribute.
   */
  getValue(what?: string): any

  /** Sets an attribute as a RowDetail object rather than a primitive */
  setDetail(what: string, value: any): void

  /** Navigation Helpers */
  parentRow(): any
  precedingRow(): any
  nextRow(): any

  /** Traverses up through parents or collections to find the root Survey */
  getSurvey(): any
}

/**
 * Represents a single "cell" or property of a Row (e.g. its label or name).
 * Supports complex mixins and cell-level validation.
 */
export class RowDetail extends BaseModel {
  key: string
  _order: number
  hidden: boolean
  idAttribute: 'name'

  constructor(attributes: { key: string; value: any }, options: BaseOptions)

  /** Hook for post-constructor logic */
  postInitialize(): void

  /** Validation logic that checks for uniqueness (for `name`) and requirements based on the key type */
  validation(): any
}

declare const base: {
  BaseCollection: typeof BaseCollection
  BaseModel: typeof BaseModel
  RowDetail: typeof RowDetail
}
export default base

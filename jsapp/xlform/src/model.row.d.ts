// Note: please be cautious in trusting those types. They should be fine, but AI helped build them.
//
// Context: this types definition file was built with AI assistance to significantly cut the time on building them.
// It was reviewed by a dev, but one who doesn't have full understanding of Backbone, plus Form Builder code written in
// CoffeeScript is quite old and rarely maintained - increasing the risk of having errors in here.
import * as Backbone from 'backbone'
import { BaseModel } from './model.base'
import type { ChoiceList } from './model.choices'
import type { RowDetail } from './model.rowDetail'

export interface RowOptions extends Backbone.ModelSetOptions {
  _parent?: any
  error?: Error
}

/** The base class for every row-like object (Question, Group, Error) */
export class BaseRow extends BaseModel {
  static kls: string
  _parent: any
  hidden?: boolean

  constructor(attributes?: any, options?: RowOptions)

  ensureKuid(): void
  isError(): boolean
  convertAttributesToRowDetails(): void
  attributesArray(): [string, RowDetail][]

  isGroup(): boolean
  isInGroup(): boolean
  detach(opts?: any): void

  /** Returns questions occurring before this row in the survey */
  selectableRows(): Row[] | null

  export_relevant_values(survey_arr: any[], additionalSheets: any): void

  /** Serializes row for XLSForm export, handling select question logic */
  toJSON2(): Record<string, any>
  toJSON(): Record<string, any>
}

/** Standard survey question */
export class Row extends BaseRow {
  static kls: 'Row'

  constructor(attributes?: any, options?: RowOptions)

  getTypeId(): string
  /** Returns question type config */
  get_type(): any
  _isSelectQuestion(): boolean

  // File type restrictions (body::accept) handling
  getAcceptedFiles(): string | undefined
  setAcceptedFiles(bodyAcceptString: string): void

  // XLSForm parameters (e.g. start-date, end-date) handling
  getParameters(): Record<string, any>
  setParameters(paramObject: Record<string, any>): void

  // Choice List Management
  getList(): ChoiceList
  setList(list: ChoiceList | string): void

  clone(): Row
  finalize(): this
  parse(): void
  linkUp(ctx: any): void
}

/** Fallback class for rows that failed to parse correctly */
export class RowError extends BaseRow {
  _error: Error
  constructor(obj: any, options: RowOptions)
  isError(): true
}

/** Simplified row used as sub-items in Score/Rank questions */
declare class SimpleRow extends Backbone.Model {
  finalize(): void
  simpleEnsureKuid(): void
  getTypeId(): string
  linkUp(): void
  _isSelectQuestion(): boolean
  get_type(): any
  getValue(which: string): any
}

/** Mixin functionality for complex question types (Score/Rank) */
export interface ScoreRankMixin {
  _rowAttributeName: string
  _extendAll(rr: Row): void
  getValue(which: string): any
  end_json(mrg?: any): any
  forEachRow(cb: (row: any) => void, ctx: any): void
}

declare const row: {
  BaseRow: typeof BaseRow
  Row: typeof Row
  RowError: typeof RowError
}
export default row

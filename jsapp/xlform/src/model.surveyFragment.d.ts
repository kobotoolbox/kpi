import type * as Backbone from 'backbone'
import { BaseCollection } from './model.base'
import { BaseRow, type Row } from './model.row'

/**
 * Options for iterating through rows in a Survey or Group
 */
export interface ForEachRowOptions {
  includeGroups?: boolean
  includeErrors?: boolean
  includeGroupEnds?: boolean
  flat?: boolean
}

export interface RowDescriptor {
  label: string
  name: string
}

/**
 * The collection that holds rows. It uses a dynamic model factory
 * to decide whether to create a Row, Group, or RowError.
 */
export class Rows extends BaseCollection<BaseRow> {
  _parent: SurveyFragment | Group
  comparator(m: BaseRow): number
}

/**
 * Base class for both the Survey and Groups,
 * providing common row manipulation logic.
 */
export class SurveyFragment extends BaseCollection<any> {
  rows: Rows
  errors: string[]
  _meta: Backbone.Model

  constructor(arg?: any, opts?: any)

  // Core Iteration
  forEachRow(cb: (row: any) => void, ctx?: ForEachRowOptions): void

  // Validation
  _validate(): boolean
  clearErrors(): void
  addError(message: string): void

  // Search and Retrieval
  getRowDescriptors(): RowDescriptor[]
  findRowByCid(cid: string, options?: ForEachRowOptions): any
  findRowByName(name: string, opts?: ForEachRowOptions): any

  // Row Manipulation
  addRow(r: any, opts?: { after?: any; before?: any; at?: number; [key: string]: any }): any
  addRowAtIndex(r: any, index: number): any
  detach(): void
  remove(item: any): void

  // Group Logic
  _addGroup(opts: { type?: string; __rows?: any[]; label?: string; [key: string]: any }): void
  _allRows(): Row[]
  finalize(): this

  // Internal Meta-model proxies (bound in constructor)
  get(attr: string): any
  set(attr: string, value: any, options?: any): void
  set(obj: any, options?: any): void
  on(eventName: string, callback: Function, context?: any): any
  off(eventName?: string, callback?: Function, context?: any): any
  trigger(eventName: string, ...args: any[]): any
}

/**
 * Represents a group or repeat in the XLSForm
 */
export class Group extends BaseRow {
  static kls: 'Group'
  static key: 'group'
  rows: Rows

  constructor(arg?: any, opts?: any)

  _isSelectQuestion(): boolean
  get_type(): any
  _isRepeat(): boolean
  autoname(): void
  finalize(): void
  detach(opts?: any): void
  splitApart(): void

  // Already there in `BaseRow`, but TypeScript wasn't catching that…
  toJSON2(): Record<string, any>
  get(attributeName: string): any
  set(attributeName: string, value: any, options?: any): this
  set(attributes: any, options?: any): this

  // Specialized iterator logic
  _beforeIterator(cb: Function, ctxt: ForEachRowOptions): void
  _afterIterator(cb: Function, ctxt: ForEachRowOptions): void
  forEachRow(cb: (row: any) => void, ctx?: ForEachRowOptions): void

  // XLSForm Structure Helpers
  _groupOrRepeatKey(): 'group' | 'repeat'
  groupStart(): {
    export_relevant_values: (surv: any[], shts: any) => void
    toJSON: () => any
  }
  groupEnd(): {
    export_relevant_values: (surv: any[], shts: any) => void
    toJSON: () => any
  }
}

/**
 * Internal Matrix Mixin types
 */
export interface KobomatrixMixin {
  _kobomatrix_columns: Backbone.Collection<any>
  linkUp(ctx: any): Record<string, any>
  _beginEndKey(): string
}

declare const surveyFragment: {
  SurveyFragment: typeof SurveyFragment
  Group: typeof Group
}

export default surveyFragment

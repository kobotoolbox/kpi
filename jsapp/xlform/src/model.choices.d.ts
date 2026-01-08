import { BaseCollection, BaseModel } from './model.base'

/** A single row in the choices sheet (e.g. an option in a dropdown) */
export class Option extends BaseModel {
  initialize(): void
  destroy(): void
  /** Returns the collection this option belongs to */
  list(): Options
  /** Returns XLSForm column names for this option */
  getKeys(with_val?: boolean): string[]
  toJSON(): Record<string, any>
}

/** Collection of Option models for a specific ChoiceList */
export class Options extends BaseCollection<Option> {
  model: typeof Option
}

/** A list of choices (e.g. "list_name" in XLSForm) */
export class ChoiceList extends BaseModel {
  idAttribute: 'name'
  options: Options

  /** Reference to a linked list for cascading selects */
  __cascadedList?: ChoiceList

  constructor(opts?: { name?: string; options?: any[] }, context?: any)

  summaryObj(): any
  getSurvey(): any
  getList(): ChoiceList | null

  // Logic for traversing linked cascading lists
  _get_previous_linked_choice_list(): ChoiceList | undefined
  _get_last_linked_choice_list(): ChoiceList
  _get_first_linked_choice_list(): ChoiceList

  /** Checks if any survey row currently uses this list */
  _has_corresponding_row(): boolean

  /** Generates data for select questions based on cascading logic */
  _create_corresponding_row_data(opts?: { _full_path_choice_filter?: boolean }): any[]

  /** Automatically adds select questions to the survey for this cascading chain */
  create_corresponding_rows(opts?: { at?: number }): void

  /** Returns all unique column keys used across all options in this list */
  getOptionKeys(with_val?: boolean): string[]

  /** Ensures all options have valid XML-compatible names (slugs) */
  finalize(): void

  clone(): ChoiceList
  toJSON(): { name: string; options: any[] }
  getNames(): string[]
}

/** Collection of all ChoiceLists in the survey */
export class ChoiceLists extends BaseCollection<ChoiceList> {
  model: typeof ChoiceList

  /** Creates a new ChoiceList with a random unique ID */
  create(): ChoiceList

  /** Returns an array of all list names currently defined */
  getListNames(): string[]

  /** Generates a summary object of all lists, often used for serialization */
  summaryObj(shorter?: boolean): Record<string, any>
}

declare const choices: {
  Option: typeof Option
  Options: typeof Options
  ChoiceList: typeof ChoiceList
  ChoiceLists: typeof ChoiceLists
}
export default choices

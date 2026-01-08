import * as Backbone from 'backbone'
import type { Row } from './model.row'
import type { Survey } from './model.survey'

/** Interface for React (called "ng" because we wanted (did we?) to use angular years ago?) */
export interface NgScope {
  rawSurvey?: any
  assetType?: { id: string }
  handleItem?: (data: { position: number; itemUid: string; groupId?: string }) => void
  [key: string]: any
}

/** Interface for the surveyState Reflux store */
export interface SurveyStateStore {
  trigger: (event: any) => void
  setState: (state: Record<string, any>) => void
}

export interface SurveyAppOptions extends Backbone.ViewOptions<Backbone.Model> {
  // Allow null here because user code initializes it as nullable
  survey?: Survey | null
  warnings?: any[]
  ngScope?: SurveyScope
  stateStore?: SurveyStateStore

  // Callbacks
  publish?: () => void
  save?: () => void
  preview?: () => void
}

/** Base class for the Form Builder "app" - it handles the DOM events, Drag & Drop, and Selection logic */
export class SurveyFragmentApp extends Backbone.View<Backbone.Model> {
  /**
   * Explicitly define the constructor to accept `SurveyAppOptions` (this overrides the default Backbone constructor)
   */
  constructor(options?: SurveyAppOptions)

  survey: Survey
  warnings: any[]
  ngScope: SurveyScope
  surveyStateStore: SurveyStateStore

  /**
   * A Backbone Model acting as a Map<RowCid, RowView>.
   * Stores references to the sub-views for every question.
   */
  __rowViews: Backbone.Model

  /** Reference to the jQuery element for the editor container */
  formEditorEl: JQuery

  /** Reference to "initial row in the survey" */
  null_top_row_view_selector: any

  features: {
    multipleQuestions?: boolean
    skipLogic?: boolean
    copyToLibrary?: boolean
    [key: string]: any
  }

  /** Factory method to create an instance */
  static create(params?: SurveyAppOptions): SurveyFragmentApp

  initialize(options: SurveyAppOptions): void
  render(): this

  // Internal render steps
  _render_html(): void
  _render_attachEvents(): void
  _render_addSubViews(): void
  _render_hideConditionallyDisplayedContent(): void

  /** Resets the view, re-rendering rows. If `newlyAddedRow` is provided, it focuses/scrolls to this row. */
  _reset(newlyAddedRow?: Row | false): void
  // Debounced version of the above(?)
  reset: (newlyAddedRow?: Row | false) => JQuery.Promise<void>

  switchTab(event: JQuery.TriggeredEvent): void

  // Drag and Drop (Sortable) Logic
  activateSortable(): void
  surveyRowSortableStop(evt: JQuery.TriggeredEvent): void
  updateSort(evt: any, model: Row, position: number): void
  _preventSortableIfGroupTooSmall(index: number, element: HTMLElement): void

  // Row Selection Logic
  selectRow(evt: JQuery.TriggeredEvent): void
  forceSelectRow(evt: JQuery.TriggeredEvent): void
  deselect_rows(evt: JQuery.TriggeredEvent): void
  deselect_all_rows(): void
  select_group_if_all_items_selected($group: JQuery): void
  questionSelect(): void
  activateGroupButton(active: boolean): void

  /** Returns an array of currently selected rows */
  selectedRows(): Row[]

  /** Takes selected rows and wraps them in a new Group. Returns true if successful. */
  groupSelectedRows(): boolean

  // Actions
  clickRemoveRow(evt: JQuery.TriggeredEvent): void
  clickDeleteGroup(evt: JQuery.TriggeredEvent): void
  clickAddRowToQuestionLibrary(evt: JQuery.TriggeredEvent): void
  clickAddGroupToLibrary(evt: JQuery.TriggeredEvent): void
  clickCloneQuestion(evt: JQuery.TriggeredEvent): void

  // Expand/Collapse Logic
  toggleCardSettings(evt: JQuery.TriggeredEvent): void
  toggleGroupExpansion(evt: JQuery.TriggeredEvent): void
  toggleRowMultioptions(evt: JQuery.TriggeredEvent): void
  expandRowSelector(evt: JQuery.TriggeredEvent): void
  shrinkAllGroups(): void
  expandAllGroups(): void
  expandMultioptions(): void
  expand_all_multioptions: () => boolean

  // Locking / Permissions
  hasRestriction(restrictionName: string): boolean
  isLockable(): boolean
  applyLocking(): void

  // View Retrieval & DOM Helpers
  getView(cid: string): Backbone.View<Backbone.Model>
  getViewForRow(row: Row): Backbone.View<Backbone.Model> // Returns specific sub-view
  _getViewForTarget(evt: JQuery.TriggeredEvent | { currentTarget: HTMLElement }): any // Returns the sub-view associated with the event target
  ensureElInView(row: Row, parentView: any, $parentEl: JQuery): any
  getItemPosition(item: JQuery): number

  // Validation
  validateSurvey(): boolean
  closeWarningBox(evt: JQuery.TriggeredEvent): void

  // Button hover callbacks
  buttonHoverIn(evt: JQuery.TriggeredEvent): void
  buttonHoverOut(evt: JQuery.TriggeredEvent): void

  getApp(): this
}

/** The actual implementation used in the application */
export class SurveyApp extends SurveyFragmentApp {
  features: {
    multipleQuestions: true
    skipLogic: true
    copyToLibrary: true
  }
  // Note: It inherits constructor from SurveyFragmentApp
}

declare const surveyAppModule: {
  SurveyFragmentApp: typeof SurveyFragmentApp
  SurveyApp: typeof SurveyApp
}
export default surveyAppModule

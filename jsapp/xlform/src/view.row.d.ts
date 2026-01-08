import * as Backbone from 'backbone'
import type SurveyScope from '#/models/surveyScope'
import type { Row } from './model.row'
import type { Group } from './model.surveyFragment'
import type { SurveyFragmentApp } from './view.surveyApp'

/** Base Options for any Row View */
export interface RowViewOptions extends Backbone.ViewOptions<Row | Group> {
  ngScope?: SurveyScope
  surveyView: SurveyFragmentApp
  shrunk?: boolean
  fixScroll?: boolean
}

/** Base class for all row-like views (questions, groups). */
export class BaseRowView extends Backbone.View<Row | Group> {
  model: Row | Group
  ngScope: SurveyScope
  surveyView: SurveyFragmentApp
  options: RowViewOptions

  // State flags
  already_rendered: boolean
  is_expanded: boolean
  _settingsExpanded: boolean

  // DOM pointers
  $card: JQuery
  $header: JQuery
  $label: JQuery
  $hint: JQuery
  $settings: JQuery

  initialize(opts: RowViewOptions): void

  /** Handles drag-and-drop's drop event */
  drop(evt: JQuery.TriggeredEvent, index: number): void

  getApp(): SurveyFragmentApp
  getRawType(): string
  isSupportedByUI(): boolean

  /** Safe method to get the row name (or autoname) */
  getRowName(): string | null

  /** Locking & Permissions */
  hasRestriction(restrictionName: string): boolean
  isLockable(): boolean
  applyLocking(): void

  render(opts?: { fixScroll?: boolean }): this

  _renderError(): this
  _renderRow(): this

  toggleSettings(show?: boolean): void
  _expandedRender(): void
  _cleanupExpandedRender(): void

  clone(event: JQuery.TriggeredEvent): void
  addItemToLibrary(evt: JQuery.TriggeredEvent): void
}

/** Standard Question View (select_one, text, note, etc.) */
export class RowView extends BaseRowView {
  model: Row
  paramsView?: any
  acceptedFilesView?: any
  listView?: any
  mandatorySetting?: any
  _onMandatorySettingChange(newVal: any): void
  hideMultioptions(): void
  showMultioptions(): void
  toggleMultioptions(): void
}

/** Group View (contains nested rows) */
export class GroupView extends BaseRowView {
  model: Group
  $rows: JQuery
  _shrunk: boolean
  deleteGroup(evt: JQuery.TriggeredEvent): void
  _deleteGroup(): void
  _deleteGroupWithContent(): void
  hasNestedGroups(): boolean
  add_group_to_library(evt: JQuery.TriggeredEvent): void
}

/** Matrix Question View (specialized group) */
export class KoboMatrixView extends RowView {
  matrix: JQuery
}

/** Shared logic for Rank and Score views */
export class RankScoreView extends RowView {
  // Overrides _expandedRender to hide certain standard settings
  _expandedRender(): void
}

/** Score Question View */
export class ScoreView extends RankScoreView {
  // Complex logic for rendering score grids and handling inline edits
  // TODO: Although this is named editRanks, it should probably be `editScores` or something… possibly not renamed when
  // copy-pasted or shared with `RankView` below?
  editRanks(): void
}

/** Rank Question View */
export class RankView extends RankScoreView {
  editRanks(): void
}

declare const rowViewModule: {
  RowView: typeof RowView
  GroupView: typeof GroupView
  KoboMatrixView: typeof KoboMatrixView
  ScoreView: typeof ScoreView
  RankView: typeof RankView
}
export default rowViewModule

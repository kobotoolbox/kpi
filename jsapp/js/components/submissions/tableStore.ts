import clonedeep from 'lodash.clonedeep'
import Reflux from 'reflux'
import type { BulkActionResponse } from '#/api/models/bulkActionResponse'
import {
  DATA_TABLE_SETTINGS,
  SUBMISSION_ACTIONS_ID,
  VALIDATION_STATUS_ID_PROP,
} from '#/components/submissions/tableConstants'
import type { SortValues } from '#/components/submissions/tableConstants'
import { getAllDataColumns } from '#/components/submissions/tableUtils'
import type { AssetResponse, AssetTableSettings, SubmissionResponse, TableSortBySetting } from '#/dataInterface'
import { getRouteAssetUid } from '#/router/routerUtils'
import { recordEntries } from '#/utils'

/** Prefix for the per-user `localStorage` key, see `useSafeUsernameStorageKey`. */
export const TABLE_SETTINGS_STORAGE_KEY_PREFIX = 'kpiDataTableSettings'

export interface TableStoreData {
  /** Settings of the asset from the current route. */
  tableSettings: AssetTableSettings
}

/** One key per user holds the settings of every asset they've opened. */
type TableSettingsByAsset = Record<string, AssetTableSettings>

function readStoredSettings(storageKey: string): TableSettingsByAsset {
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey) || '{}')
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed
    }
  } catch {
    // Malformed JSON or storage being unavailable, so we start fresh.
  }
  return {}
}

/**
 * Keeps Data Table settings (sorting, hidden and frozen columns, etc.) in
 * `localStorage`, per user and per asset.
 *
 * NOTE: we assume this is used only on the table route, i.e. assetUid comes
 * from url.
 *
 * NOTE: nothing is persisted until `setStorageKey` is called (see
 * `DataTableWrapper`), only kept in memory.
 *
 * @deprecated migrate out of Reflux (DEV-3191) whenever you need to adjust things beyond simple rename
 */
class TableStore extends Reflux.Store {
  private storageKey: string | null = null
  private settingsByAsset: TableSettingsByAsset = {}
  /** Assets with changes that failed to persist, kept in memory only. */
  private unsavedAssetUids = new Set<string>()

  /** Loads the settings stored under given key and persists future changes there. */
  setStorageKey(storageKey: string) {
    if (storageKey === this.storageKey) {
      return
    }
    this.storageKey = storageKey
    this.settingsByAsset = readStoredSettings(storageKey)
    this.unsavedAssetUids.clear()
    this.trigger(this.getData())
  }

  private getData(): TableStoreData {
    return { tableSettings: this.getTableSettings() }
  }

  /** Returns settings or empty object if no settings exist */
  getTableSettings(): AssetTableSettings {
    const assetUid = getRouteAssetUid()
    // Clone, as consumers mutate these arrays/objects in place (e.g. `table.tsx`
    // prepends the frozen columns to the selected columns).
    return clonedeep((assetUid && this.settingsByAsset[assetUid]) || {})
  }

  /**
   * @param newTableSettings - will be merged into current settings. Passing
   * `null` for a setting brings back its default.
   */
  saveTableSettings(newTableSettings: AssetTableSettings) {
    const assetUid = getRouteAssetUid()
    if (assetUid === null) {
      console.error('No asset?')
      return
    }

    // Other tabs may have saved other assets since we loaded, so pick these up
    // to avoid overwriting them. Unsaved changes still win.
    if (this.storageKey) {
      const unsavedSettings = Object.fromEntries(
        [...this.unsavedAssetUids].map((uid) => [uid, this.settingsByAsset[uid]]),
      )
      this.settingsByAsset = { ...this.settingsByAsset, ...readStoredSettings(this.storageKey), ...unsavedSettings }
    }

    const mergedSettings = { ...this.settingsByAsset[assetUid], ...newTableSettings }
    // `null` means "use default", so there's no point storing it.
    this.settingsByAsset[assetUid] = Object.fromEntries(
      recordEntries(mergedSettings).filter(([, value]) => value !== null),
    ) as AssetTableSettings

    if (this.storageKey) {
      try {
        localStorage.setItem(this.storageKey, JSON.stringify(this.settingsByAsset))
        this.unsavedAssetUids.clear()
      } catch {
        // Storage is full or disabled. Settings still work until page reload.
        this.unsavedAssetUids.add(assetUid)
      }
    }

    this.trigger(this.getData())
  }

  /** Returns a list of columns that user can hide */
  getHideableColumns(asset: AssetResponse, submissions: SubmissionResponse[], bulkActions?: BulkActionResponse[]) {
    const columns = getAllDataColumns(asset, submissions, bulkActions)
    // Validation status is not submission data, so `getAllDataColumns` doesn't
    // return it, but users still get to hide this column. It goes first, to
    // match its position in Data Table.
    columns.unshift(VALIDATION_STATUS_ID_PROP)
    return columns
  }

  /**
   * `null` means no selection, i.e. all columns
   */
  getSelectedColumns(): string[] | null {
    const tableSettings = this.getTableSettings()
    if (Array.isArray(tableSettings[DATA_TABLE_SETTINGS.SELECTED_COLUMNS])) {
      return tableSettings[DATA_TABLE_SETTINGS.SELECTED_COLUMNS] || null
    }
    return null
  }

  /** Returns ids of frozen columns, in the order they were frozen. */
  getFrozenColumns(): string[] {
    const frozenColumns = this.getTableSettings()[DATA_TABLE_SETTINGS.FROZEN_COLUMN]
    // Old settings keep a single column id as a string.
    if (typeof frozenColumns === 'string') {
      return [frozenColumns]
    }
    return Array.isArray(frozenColumns) ? frozenColumns : []
  }

  isFieldVisible(fieldId: string) {
    // frozen column is never hidden
    if (this.isFieldFrozen(fieldId)) {
      return true
    }

    // submission actions is never hidden
    if (fieldId === SUBMISSION_ACTIONS_ID) {
      return true
    }

    const selectedColumns = this.getSelectedColumns()
    // nothing is selected, so all columns are visible
    if (selectedColumns === null) {
      return true
    }

    if (Array.isArray(selectedColumns)) {
      return selectedColumns.includes(fieldId)
    }

    return true
  }

  isFieldFrozen(fieldId: string) {
    return this.getFrozenColumns().includes(fieldId)
  }

  /** Freezes or unfreezes given column, leaving other frozen columns as they are. */
  setFrozenColumn(fieldId: string, isFrozen: boolean) {
    const otherColumns = this.getFrozenColumns().filter((id) => id !== fieldId)
    const newFrozenColumns = isFrozen ? [...otherColumns, fieldId] : otherColumns
    this.saveTableSettings({ [DATA_TABLE_SETTINGS.FROZEN_COLUMN]: newFrozenColumns.length ? newFrozenColumns : null })
  }

  /**
   * Returns `null` for no option, or one of SortValues
   */
  getFieldSortValue(fieldId: string): SortValues | null {
    const sortBy = this.getSortBy()
    if (sortBy === null) {
      return null
    }

    if (sortBy?.fieldId === fieldId) {
      return sortBy.value
    }

    return null
  }

  setSortBy(fieldId: string, sortValue: SortValues | null) {
    let newSortBy = null
    if (sortValue !== null) {
      newSortBy = {
        fieldId: fieldId,
        value: sortValue,
      }
    }

    const settingsObj: AssetTableSettings = {}
    settingsObj[DATA_TABLE_SETTINGS.SORT_BY] = newSortBy
    this.saveTableSettings(settingsObj)
  }

  getSortBy(): TableSortBySetting | null {
    let sortBy = null
    const tableSettings = this.getTableSettings()
    if (typeof tableSettings[DATA_TABLE_SETTINGS.SORT_BY] !== 'undefined') {
      sortBy = tableSettings[DATA_TABLE_SETTINGS.SORT_BY]
    }
    return sortBy || null
  }

  showAllFields() {
    const settingsObj: AssetTableSettings = {}
    settingsObj[DATA_TABLE_SETTINGS.SELECTED_COLUMNS] = null
    this.saveTableSettings(settingsObj)
  }

  /** Show single column - shortcut method for setFieldsVisibility */
  showField(
    asset: AssetResponse,
    submissions: SubmissionResponse[],
    bulkActions: BulkActionResponse[],
    fieldId: string,
  ) {
    const selectedColumns = this.getSelectedColumns()

    // We start with `null` just to be safe, but the case when selectedColumns
    // is `null` already (i.e. all columns visible) and we show column should
    // never happen.
    let newSelectedColumns = null

    // Some fields are selected and we show one column
    if (Array.isArray(selectedColumns)) {
      newSelectedColumns = [...selectedColumns]
      newSelectedColumns.push(fieldId)
    }

    this.setFieldsVisibility(asset, submissions, bulkActions, newSelectedColumns)
  }

  /** Hide single column - a shortcut method for setFieldsVisibility */
  hideField(
    asset: AssetResponse,
    submissions: SubmissionResponse[],
    bulkActions: BulkActionResponse[],
    fieldId: string,
  ) {
    const selectedColumns = this.getSelectedColumns()
    const hideableColumns = this.getHideableColumns(asset, submissions, bulkActions)

    let newSelectedColumns: string[] = []

    // Case 1: nothing selected and we hide one column, i.e. we need to select all but one
    if (selectedColumns === null) {
      newSelectedColumns = [...hideableColumns]
      newSelectedColumns.splice(newSelectedColumns.indexOf(fieldId), 1)
    }

    // Case 2: some fields selected and we hide one column
    if (Array.isArray(selectedColumns)) {
      newSelectedColumns = [...selectedColumns]
      newSelectedColumns.splice(newSelectedColumns.indexOf(fieldId), 1)
    }

    this.setFieldsVisibility(asset, submissions, bulkActions, newSelectedColumns)
  }

  setFieldsVisibility(
    asset: AssetResponse,
    submissions: SubmissionResponse[],
    bulkActions: BulkActionResponse[],
    columnsToBeVisible: string[] | null,
  ) {
    const hideableColumns = this.getHideableColumns(asset, submissions, bulkActions)
    let newSelectedColumns = columnsToBeVisible

    // If we make all possible columns visible, we save `null` value
    if (Array.isArray(newSelectedColumns) && newSelectedColumns.length === hideableColumns.length) {
      newSelectedColumns = null
    }

    const settingsObj: AssetTableSettings = {}
    settingsObj[DATA_TABLE_SETTINGS.SELECTED_COLUMNS] = newSelectedColumns

    // Hidden columns can't stay frozen, so we unfreeze them.
    if (Array.isArray(newSelectedColumns)) {
      const frozenColumns = this.getFrozenColumns()
      const visibleFrozenColumns = frozenColumns.filter((id) => newSelectedColumns.includes(id))
      if (visibleFrozenColumns.length !== frozenColumns.length) {
        settingsObj[DATA_TABLE_SETTINGS.FROZEN_COLUMN] = visibleFrozenColumns.length ? visibleFrozenColumns : null
      }
    }

    // If we are hiding the column that data is sorted by, we need to unsort it.
    const sortBy = this.getSortBy()
    if (
      sortBy !== null &&
      typeof sortBy === 'object' &&
      Array.isArray(newSelectedColumns) &&
      !newSelectedColumns.includes(sortBy.fieldId)
    ) {
      // Currently we allow only one sort column, so we just set it to `null`.
      settingsObj[DATA_TABLE_SETTINGS.SORT_BY] = null
    }

    this.saveTableSettings(settingsObj)
  }

  getShowGroupName() {
    let showGroupName
    const tableSettings = this.getTableSettings()
    if (typeof tableSettings[DATA_TABLE_SETTINGS.SHOW_GROUP] !== 'undefined') {
      showGroupName = tableSettings[DATA_TABLE_SETTINGS.SHOW_GROUP]
    } else {
      showGroupName = true
    }
    return showGroupName
  }

  getTranslationIndex() {
    let translationIndex = 0
    const tableSettings = this.getTableSettings()
    if (typeof tableSettings[DATA_TABLE_SETTINGS.TRANSLATION] !== 'undefined') {
      translationIndex = tableSettings[DATA_TABLE_SETTINGS.TRANSLATION] || 0
    }
    return translationIndex
  }

  getShowHXLTags() {
    let showHXLTags
    const tableSettings = this.getTableSettings()
    if (typeof tableSettings[DATA_TABLE_SETTINGS.SHOW_HXL] !== 'undefined') {
      showHXLTags = tableSettings[DATA_TABLE_SETTINGS.SHOW_HXL]
    } else {
      showHXLTags = false
    }
    return showHXLTags
  }
}

/**
 * @deprecated migrate to react-query whenever you need to adjust things beyond simple rename
 */
const tableStore = new TableStore()

export default tableStore

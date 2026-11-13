import clonedeep from 'lodash.clonedeep'
import { useSyncExternalStore } from 'react'
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

/** One key per user holds the settings of every asset they've opened. */
type TableSettingsByAsset = Record<string, AssetTableSettings>

/** Same object every time, so `useSyncExternalStore` doesn't loop. */
const EMPTY_SETTINGS: Readonly<AssetTableSettings> = Object.freeze({})

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
 * NOTE: React components should read settings with `useTableSettings`.
 */
class TableStore {
  private storageKey: string | null = null
  private settingsByAsset: TableSettingsByAsset = {}
  /** Assets with changes that failed to persist, kept in memory only. */
  private unsavedAssetUids = new Set<string>()
  private listeners = new Set<() => void>()

  /** Returns a function that unsubscribes. */
  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  private emit() {
    this.listeners.forEach((listener) => listener())
  }

  /** Loads the settings stored under given key and persists future changes there. */
  setStorageKey(storageKey: string) {
    if (storageKey === this.storageKey) {
      return
    }
    this.storageKey = storageKey
    this.settingsByAsset = readStoredSettings(storageKey)
    this.unsavedAssetUids.clear()
    this.emit()
  }

  /** Like `getTableSettings`, but not a clone: same object until settings change. Don't mutate it. */
  getTableSettingsSnapshot = (): Readonly<AssetTableSettings> => {
    const assetUid = getRouteAssetUid()
    return (assetUid && this.settingsByAsset[assetUid]) || EMPTY_SETTINGS
  }

  /** Returns settings or empty object if no settings exist */
  getTableSettings(): AssetTableSettings {
    // Clone, as consumers mutate these arrays/objects in place (e.g. `table.tsx`
    // prepends the frozen columns to the selected columns).
    return clonedeep(this.getTableSettingsSnapshot())
  }

  /**
   * @param newTableSettings - will be merged into current settings. Passing
   * `null` or an empty list for a setting brings back its default.
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
    // `null` and `[]` mean "use default", so there's no point storing them.
    this.settingsByAsset[assetUid] = Object.fromEntries(
      recordEntries(mergedSettings).filter(([, value]) => value !== null && !(Array.isArray(value) && !value.length)),
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

    this.emit()
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

  /** We store hidden columns, not visible ones, so new form questions show up by default. */
  getHiddenColumns(): string[] {
    const hiddenColumns = this.getTableSettings()[DATA_TABLE_SETTINGS.HIDDEN_COLUMNS]
    return Array.isArray(hiddenColumns) ? hiddenColumns : []
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

    return !this.getHiddenColumns().includes(fieldId)
  }

  isFieldFrozen(fieldId: string) {
    return this.getFrozenColumns().includes(fieldId)
  }

  /** Freezes or unfreezes given column, leaving other frozen columns as they are. */
  setFrozenColumn(fieldId: string, isFrozen: boolean) {
    const otherColumns = this.getFrozenColumns().filter((id) => id !== fieldId)
    const newFrozenColumns = isFrozen ? [...otherColumns, fieldId] : otherColumns
    this.saveTableSettings({ [DATA_TABLE_SETTINGS.FROZEN_COLUMN]: newFrozenColumns })
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
    this.setHiddenColumns([])
  }

  hideField(fieldId: string) {
    this.setHiddenColumns([...this.getHiddenColumns(), fieldId])
  }

  setHiddenColumns(hiddenColumns: string[]) {
    const settingsObj: AssetTableSettings = {
      [DATA_TABLE_SETTINGS.HIDDEN_COLUMNS]: hiddenColumns,
      // Hidden columns can't stay frozen, so we unfreeze them.
      [DATA_TABLE_SETTINGS.FROZEN_COLUMN]: this.getFrozenColumns().filter((id) => !hiddenColumns.includes(id)),
    }

    // Data can't stay sorted by a hidden column.
    const sortBy = this.getSortBy()
    if (sortBy && hiddenColumns.includes(sortBy.fieldId)) {
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

const tableStore = new TableStore()

export default tableStore

/** Settings of the asset from the current route, re-rendering on every change. */
export function useTableSettings() {
  return useSyncExternalStore(tableStore.subscribe, tableStore.getTableSettingsSnapshot)
}

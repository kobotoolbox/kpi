import { useSyncExternalStore } from 'react'
import type { BulkActionResponse } from '#/api/models/bulkActionResponse'
import { DATA_TABLE_SETTINGS, VALIDATION_STATUS_ID_PROP } from '#/components/submissions/tableConstants'
import type { SortValues } from '#/components/submissions/tableConstants'
import { getFrozenColumns, getHiddenColumns, getSortBy } from '#/components/submissions/tableSettingsUtils'
import { getAllDataColumns } from '#/components/submissions/tableUtils'
import type { AssetResponse, AssetTableSettings, SubmissionResponse } from '#/dataInterface'
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

  /** Same object until settings change. Don't mutate it. */
  getTableSettingsSnapshot = (): Readonly<AssetTableSettings> => {
    const assetUid = getRouteAssetUid()
    return (assetUid && this.settingsByAsset[assetUid]) || EMPTY_SETTINGS
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

  /** A copy, so callers can edit it. */
  getHiddenColumns(): string[] {
    return [...getHiddenColumns(this.getTableSettingsSnapshot())]
  }

  /** Freezes or unfreezes given column, leaving other frozen columns as they are. */
  setFrozenColumn(fieldId: string, isFrozen: boolean) {
    const otherColumns = getFrozenColumns(this.getTableSettingsSnapshot()).filter((id) => id !== fieldId)
    const newFrozenColumns = isFrozen ? [...otherColumns, fieldId] : otherColumns
    this.saveTableSettings({ [DATA_TABLE_SETTINGS.FROZEN_COLUMN]: newFrozenColumns })
  }

  setSortBy(fieldId: string, sortValue: SortValues | null) {
    const newSortBy = sortValue === null ? null : { fieldId, value: sortValue }
    this.saveTableSettings({ [DATA_TABLE_SETTINGS.SORT_BY]: newSortBy })
  }

  showAllFields() {
    this.setHiddenColumns([])
  }

  hideField(fieldId: string) {
    this.setHiddenColumns([...this.getHiddenColumns(), fieldId])
  }

  setHiddenColumns(hiddenColumns: string[]) {
    const tableSettings = this.getTableSettingsSnapshot()
    const settingsObj: AssetTableSettings = {
      [DATA_TABLE_SETTINGS.HIDDEN_COLUMNS]: hiddenColumns,
      // Hidden columns can't stay frozen, so we unfreeze them.
      [DATA_TABLE_SETTINGS.FROZEN_COLUMN]: getFrozenColumns(tableSettings).filter((id) => !hiddenColumns.includes(id)),
    }

    // Data can't stay sorted by a hidden column.
    const sortBy = getSortBy(tableSettings)
    if (sortBy && hiddenColumns.includes(sortBy.fieldId)) {
      settingsObj[DATA_TABLE_SETTINGS.SORT_BY] = null
    }

    this.saveTableSettings(settingsObj)
  }
}

const tableStore = new TableStore()

export default tableStore

/** Settings of the asset from the current route, re-rendering on every change. */
export function useTableSettings() {
  return useSyncExternalStore(tableStore.subscribe, tableStore.getTableSettingsSnapshot)
}

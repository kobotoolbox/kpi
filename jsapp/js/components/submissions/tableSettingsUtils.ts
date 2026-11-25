import { DATA_TABLE_SETTINGS, SUBMISSION_ACTIONS_ID } from '#/components/submissions/tableConstants'
import type { SortValues } from '#/components/submissions/tableConstants'
import type { AssetTableSettings, TableSortBySetting } from '#/dataInterface'

/** We store hidden columns, not visible ones, so new form questions show up by default */
export function getHiddenColumns(tableSettings: Readonly<AssetTableSettings>): readonly string[] {
  const hiddenColumns = tableSettings[DATA_TABLE_SETTINGS.HIDDEN_COLUMNS]
  return Array.isArray(hiddenColumns) ? hiddenColumns : []
}

/** Order doesn't matter, frozen columns show in table order */
export function getFrozenColumns(tableSettings: Readonly<AssetTableSettings>): readonly string[] {
  const frozenColumns = tableSettings[DATA_TABLE_SETTINGS.FROZEN_COLUMN]
  // Old settings keep a single column id as a string.
  if (typeof frozenColumns === 'string') {
    return [frozenColumns]
  }
  return Array.isArray(frozenColumns) ? frozenColumns : []
}

export function isFieldFrozen(tableSettings: Readonly<AssetTableSettings>, fieldId: string) {
  return getFrozenColumns(tableSettings).includes(fieldId)
}

/** Frozen and submission actions columns are never hidden */
export function isFieldVisible(tableSettings: Readonly<AssetTableSettings>, fieldId: string) {
  if (isFieldFrozen(tableSettings, fieldId) || fieldId === SUBMISSION_ACTIONS_ID) {
    return true
  }
  return !getHiddenColumns(tableSettings).includes(fieldId)
}

export function getSortBy(tableSettings: Readonly<AssetTableSettings>): TableSortBySetting | null {
  return tableSettings[DATA_TABLE_SETTINGS.SORT_BY] || null
}

/** Returns `null` if given column isn't the sorted one */
export function getFieldSortValue(tableSettings: Readonly<AssetTableSettings>, fieldId: string): SortValues | null {
  const sortBy = getSortBy(tableSettings)
  return sortBy?.fieldId === fieldId ? sortBy.value : null
}

export function getShowGroupName(tableSettings: Readonly<AssetTableSettings>) {
  return tableSettings[DATA_TABLE_SETTINGS.SHOW_GROUP] ?? true
}

/** `-1` means question names instead of labels */
export function getTranslationIndex(tableSettings: Readonly<AssetTableSettings>) {
  return tableSettings[DATA_TABLE_SETTINGS.TRANSLATION] ?? 0
}

export function getShowHXLTags(tableSettings: Readonly<AssetTableSettings>) {
  return tableSettings[DATA_TABLE_SETTINGS.SHOW_HXL] ?? false
}

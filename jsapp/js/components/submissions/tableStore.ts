import clonedeep from 'lodash.clonedeep'
import Reflux from 'reflux'
import { actions } from '#/actions'
import assetStore from '#/assetStore'
import { PERMISSIONS_CODENAMES } from '#/components/permissions/permConstants'
import { userCan } from '#/components/permissions/utils'
import {
  DATA_TABLE_SETTING,
  DATA_TABLE_SETTINGS,
  SUBMISSION_ACTIONS_ID,
  VALIDATION_STATUS_ID_PROP,
} from '#/components/submissions/tableConstants'
import type { SortValues } from '#/components/submissions/tableConstants'
import { getAllDataColumns } from '#/components/submissions/tableUtils'
import type { AssetSettings, AssetTableSettings, SubmissionResponse, TableSortBySetting } from '#/dataInterface'
import { getRouteAssetUid } from '#/router/routerUtils'
import { recordEntries } from '#/utils'

export interface TableStoreData {
  overrides: AssetTableSettings
}

/**
 * NOTE: tableStore should be handling all data required by table.js, but as
 * this would mean a huge refactor (and most probably dropping react-table),
 * we will stick to providing a one way interface for changing things in asset
 * plus some utility functions.
 *
 * NOTE: To simplify code a bit, we assume this will be used only on the table
 * route - i.e. assetUid comes from url, and asset from other stores.
 *
 * Use these actions listeners to be up to date:
 * - `actions.table.updateSettings`
 *
 * @deprecated migrate to react-query whenever you need to adjust things beyond simple rename
 */
class TableStore extends Reflux.Store {
  /** We use overrides for users with no permissions */
  data: TableStoreData = {
    overrides: {},
  }

  /** Returns settings or empty object if no settings exist */
  getTableSettings() {
    const asset = this.getCurrentAsset()

    // We clone settings, as we will possibly overwrite some of them. If there
    // are no settings yet, we start with empty object.
    const tableSettings: AssetTableSettings = clonedeep(asset?.settings[DATA_TABLE_SETTING]) || {}

    // overrides take precedense over asset endpoint settings
    if (typeof this.data.overrides[DATA_TABLE_SETTINGS.SHOW_GROUP] !== 'undefined') {
      tableSettings[DATA_TABLE_SETTINGS.SHOW_GROUP] = this.data.overrides[DATA_TABLE_SETTINGS.SHOW_GROUP]
    }
    if (typeof this.data.overrides[DATA_TABLE_SETTINGS.TRANSLATION] !== 'undefined') {
      tableSettings[DATA_TABLE_SETTINGS.TRANSLATION] = this.data.overrides[DATA_TABLE_SETTINGS.TRANSLATION]
    }
    if (typeof this.data.overrides[DATA_TABLE_SETTINGS.SHOW_HXL] !== 'undefined') {
      tableSettings[DATA_TABLE_SETTINGS.SHOW_HXL] = this.data.overrides[DATA_TABLE_SETTINGS.SHOW_HXL]
    }
    if (typeof this.data.overrides[DATA_TABLE_SETTINGS.SORT_BY] !== 'undefined') {
      tableSettings[DATA_TABLE_SETTINGS.SORT_BY] = this.data.overrides[DATA_TABLE_SETTINGS.SORT_BY]
    }

    return tableSettings
  }

  /**
   * @param {object} newTableSettings - will be merged into current settings, overwriting any DATA_TABLE_SETTING properties
   */
  saveTableSettings(newTableSettings: AssetTableSettings) {
    const asset = this.getCurrentAsset()

    if (asset === undefined) {
      console.error('No asset?')
    }

    // get whole asset settings (as clone to avoid bugs) to not lose existing
    // settings that are not updated by newTableSettings
    const newSettings: AssetSettings = clonedeep(asset?.settings) || {}

    // settings object doesn't even have DATA_TABLE_SETTING, we can pass newTableSettings
    if (newSettings[DATA_TABLE_SETTING]) {
      newSettings[DATA_TABLE_SETTING] = Object.assign(newSettings[DATA_TABLE_SETTING], newTableSettings)
    } else {
      newSettings[DATA_TABLE_SETTING] = newTableSettings
      // settings exist, so we merge them
    }

    // Case 1: user can save, so we call the endpoint
    if (asset && userCan(PERMISSIONS_CODENAMES.change_asset, asset)) {
      // Cleanup all `null` settings, as we don't want to store `null`s and `null`
      // means "delete setting"
      const tableSettings = newSettings[DATA_TABLE_SETTING]
      recordEntries(tableSettings).forEach((key, value) => {
        if (value === null && typeof key === 'string') {
          delete tableSettings[key]
        }
      })
      actions.table.updateSettings(asset.uid, newSettings)
    } else {
      // Case 2: user can't save, so we store temporary overrides as nested setting
      this.setOverrides(newSettings[DATA_TABLE_SETTING])
    }
  }

  /**
   * @param {object} newOverrides
   */
  setOverrides(newOverrides: AssetTableSettings) {
    if (typeof newOverrides[DATA_TABLE_SETTINGS.SHOW_GROUP] !== 'undefined') {
      this.data.overrides[DATA_TABLE_SETTINGS.SHOW_GROUP] = newOverrides[DATA_TABLE_SETTINGS.SHOW_GROUP]
    }
    if (typeof newOverrides[DATA_TABLE_SETTINGS.TRANSLATION] !== 'undefined') {
      this.data.overrides[DATA_TABLE_SETTINGS.TRANSLATION] = newOverrides[DATA_TABLE_SETTINGS.TRANSLATION]
    }
    if (typeof newOverrides[DATA_TABLE_SETTINGS.SHOW_HXL] !== 'undefined') {
      this.data.overrides[DATA_TABLE_SETTINGS.SHOW_HXL] = newOverrides[DATA_TABLE_SETTINGS.SHOW_HXL]
    }
    if (typeof newOverrides[DATA_TABLE_SETTINGS.SORT_BY] !== 'undefined') {
      this.data.overrides[DATA_TABLE_SETTINGS.SORT_BY] = newOverrides[DATA_TABLE_SETTINGS.SORT_BY]
    }

    this.trigger(this.data)
  }

  /**
   * A shortcut method, to be deleted in future.
   */
  getCurrentAsset() {
    const routeAssetUid = getRouteAssetUid()
    if (routeAssetUid === null) {
      return undefined
    }
    return assetStore.getAsset(routeAssetUid)
  }

  /** Returns a unique list of columns (keys) that should be displayed to users */
  getAllColumns(submissions: SubmissionResponse[]) {
    const asset = this.getCurrentAsset()

    if (asset?.content?.survey === undefined) {
      throw new Error('Asset not found')
    }

    return getAllDataColumns(asset, submissions)
  }

  /** Returns a list of columns that user can hide */
  getHideableColumns(submissions: SubmissionResponse[]) {
    const columns = this.getAllColumns(submissions)
    columns.push(VALIDATION_STATUS_ID_PROP)
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

  getFrozenColumn(): string | null {
    let frozenColumn = null
    const tableSettings = this.getTableSettings()
    if (typeof tableSettings[DATA_TABLE_SETTINGS.FROZEN_COLUMN] !== 'undefined') {
      frozenColumn = tableSettings[DATA_TABLE_SETTINGS.FROZEN_COLUMN]
    }
    return frozenColumn || null
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
    return this.getFrozenColumn() === fieldId
  }

  setFrozenColumn(fieldId: string, isFrozen: boolean) {
    // NOTE: Currently we only support one frozen column at a time, so that is
    // why making column not-frozen means we just null-ify the value, without
    // checking what column is frozen now.
    let newVal = null
    if (isFrozen) {
      newVal = fieldId
    }
    const settingsObj: AssetTableSettings = {}
    settingsObj[DATA_TABLE_SETTINGS.FROZEN_COLUMN] = newVal
    this.saveTableSettings(settingsObj)
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
  showField(submissions: SubmissionResponse[], fieldId: string) {
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

    this.setFieldsVisibility(submissions, newSelectedColumns)
  }

  /** Hide single column - a shortcut method for setFieldsVisibility */
  hideField(submissions: SubmissionResponse[], fieldId: string) {
    const selectedColumns = this.getSelectedColumns()
    const hideableColumns = this.getHideableColumns(submissions)

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

    this.setFieldsVisibility(submissions, newSelectedColumns)
  }

  setFieldsVisibility(submissions: SubmissionResponse[], columnsToBeVisible: string[] | null) {
    const hideableColumns = this.getHideableColumns(submissions)
    let newSelectedColumns = columnsToBeVisible

    // If we make all possible columns visible, we save `null` value
    if (Array.isArray(newSelectedColumns) && newSelectedColumns.length === hideableColumns.length) {
      newSelectedColumns = null
    }

    const settingsObj: AssetTableSettings = {}
    settingsObj[DATA_TABLE_SETTINGS.SELECTED_COLUMNS] = newSelectedColumns

    // If current frozen column is not in the newSelectedColumns, we need to
    // unfreeze it.
    const frozenColumn = this.getFrozenColumn()
    if (frozenColumn !== null && Array.isArray(newSelectedColumns) && !newSelectedColumns.includes(frozenColumn)) {
      // Currently we allow only one frozen column, so we just set it to `null`.
      settingsObj[DATA_TABLE_SETTINGS.FROZEN_COLUMN] = null
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

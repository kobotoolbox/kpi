import Reflux from 'reflux';
import clonedeep from 'lodash.clonedeep';
import {stores} from 'js/stores';
import {actions} from 'js/actions';
import {getRouteAssetUid} from 'js/routerUtils';
import {
  SUBMISSION_ACTIONS_ID,
  DATA_TABLE_SETTING,
  DATA_TABLE_SETTINGS,
} from 'js/components/submissions/tableConstants';

/**
 * TODO: The tableStore should be handling all data required by table.es6, but
 * as this would mean a huge refactor, we will stick to providing a one way
 * interface for changing things in asset.
 *
 * NOTE: To simplify code a bit, we assume this will be used only on the table
 * route - i.e. asset and assetUid will be fetched separately.
 *
 * Use actions listeners to be up to date.
 */
const tableStore = Reflux.createStore({
  /**
   * A shortcut method, to be deleted in future.
   */
  getCurrentAsset() {
    return stores.allAssets.getAsset(getRouteAssetUid());
  },

  /**
   * @returns {string[]|null} a list of selected columns from table settings,
   * `null` means no selection, i.e. all columns
   */
  getSelectedColumns() {
    const tableSettings = this.getTableSettings();
    if (Array.isArray(tableSettings[DATA_TABLE_SETTINGS.SELECTED_COLUMNS])) {
      return tableSettings[DATA_TABLE_SETTINGS.SELECTED_COLUMNS];
    }
    return null;
  },

  /**
   * @returns {object} settings or empty object if no settings exist
   */
  getTableSettings() {
    const asset = this.getCurrentAsset();
    if (
      asset?.settings &&
      asset?.settings[DATA_TABLE_SETTING]
    ) {
      return asset.settings[DATA_TABLE_SETTING];
    }
    return {};
  },

  /**
   * @returns {string|null} the current frozen column
   */
  getFrozenColumn() {
    let frozenColumn = null;
    const tableSettings = this.getTableSettings();
    if (tableSettings && tableSettings[DATA_TABLE_SETTINGS.FROZEN_COLUMN]) {
      frozenColumn = tableSettings[DATA_TABLE_SETTINGS.FROZEN_COLUMN];
    }
    return frozenColumn;
  },

  /**
   * @returns {object|null} the current sort by value
   */
  getSortBy() {
    let sortBy = null;
    const tableSettings = this.getTableSettings();
    if (tableSettings && tableSettings[DATA_TABLE_SETTINGS.SORT_BY]) {
      sortBy = tableSettings[DATA_TABLE_SETTINGS.SORT_BY];
    }
    return sortBy;
  },

  /**
   * @param {string} fieldId
   * @returns {boolean}
   */
  isFieldVisible(fieldId) {
    // frozen column is never hidden
    if (this.isFieldFrozen(fieldId)) {
      return true;
    }

    // submission actions is never hidden
    if (fieldId === SUBMISSION_ACTIONS_ID) {
      return true;
    }

    const selectedColumns = this.getSelectedColumns();
    // nothing is selected, so all columns are visible
    if (selectedColumns === null) {
      return true;
    }

    if (Array.isArray(selectedColumns)) {
      return selectedColumns.includes(fieldId);
    }

    return true;
  },

  /**
   * @param {object} asset
   * @param {string} fieldId
   * @returns {boolean}
   */
  isFieldFrozen(fieldId) {
    return this.getFrozenColumn() === fieldId;
  },

  /**
   * @param {string} fieldId
   * @param {boolean} isFrozen
   */
  setFrozenColumn(fieldId, isFrozen) {
    // NOTE: Currently we only support one frozen column at a time, so that is
    // why making column not-frozen means we just null-ify the value, without
    // checking what column is frozen now.
    let newVal = null;
    if (isFrozen) {
      newVal = fieldId;
    }
    const settingsObj = {};
    settingsObj[DATA_TABLE_SETTINGS.FROZEN_COLUMN] = newVal;
    this.saveTableSettings(settingsObj);
  },

  /**
   * @param {string} fieldId
   * @returns {string|null} null for no option, or one of SORT_VALUES
   */
  getFieldSortValue(fieldId) {
    const sortBy = this.getSortBy();
    if (sortBy === null) {
      return null;
    }

    if (sortBy?.fieldId === fieldId) {
      return sortBy.value;
    }

    return null;
  },

  /**
   * @param {string} fieldId
   * @param {string|null} sortValue one of SORT_VALUES or null for clear value
   */
  setSortBy(assetUid, fieldId, sortValue) {
    let newSortBy = null;
    if (sortValue !== null) {
      newSortBy = {
        fieldId: fieldId,
        value: sortValue,
      };
    }

    const settingsObj = {};
    settingsObj[DATA_TABLE_SETTINGS.SORT_BY] = newSortBy;
    this.saveTableSettings(settingsObj);
  },

  /**
   * @param {object} newTableSettings - will be merged into current settings, overwriting any DATA_TABLE_SETTING properties
   */
  saveTableSettings(newTableSettings) {
    const asset = this.getCurrentAsset();

    // get whole asset settings as clone to avoid bugs
    const newSettings = clonedeep(asset.settings);

    if (!newSettings[DATA_TABLE_SETTING]) {
      newSettings[DATA_TABLE_SETTING] = newTableSettings;
    } else {
      newSettings[DATA_TABLE_SETTING] = Object.assign(
        newSettings[DATA_TABLE_SETTING],
        newTableSettings
      );
    }

    if (asset && this.userCan('change_asset', asset)) {
      actions.table.updateSettings(asset.uid, newSettings);
    }
  },

  /**
   * Show single column - shortcut method for setFieldsVisibility
   * @param {string[]} hideableColumns
   * @param {string} fieldId
   */
  showField(hideableColumns, fieldId) {
    const selectedColumns = this.getSelectedColumns();

    // We start with `null` just to be safe, but the case when selectedColumns
    // is `null` already (i.e. all columns visible) and we show column should
    // never happen.
    let newSelectedColumns = null;

    // Some fields are selected and we show one column
    if (Array.isArray(selectedColumns)) {
      newSelectedColumns = [...selectedColumns];
      newSelectedColumns.push(fieldId);
    }

    this.setFieldsVisibility(hideableColumns, newSelectedColumns);
  },

  /**
   * Hide single column - a shortcut method for setFieldsVisibility
   * @param {string[]} hideableColumns
   * @param {string} fieldId
   */
  hideField(hideableColumns, fieldId) {
    const selectedColumns = this.getSelectedColumns();

    let newSelectedColumns = [];

    // Case 1: nothing selected and we hide one column, i.e. we need to select all but one
    if (selectedColumns === null) {
      newSelectedColumns = [...hideableColumns];
      newSelectedColumns.splice(newSelectedColumns.indexOf(fieldId), 1);
    }

    // Case 2: some fields selected and we hide one column
    if (Array.isArray(selectedColumns)) {
      newSelectedColumns = [...selectedColumns];
      newSelectedColumns.splice(newSelectedColumns.indexOf(fieldId), 1);
    }

    this.setFieldsVisibility(hideableColumns, newSelectedColumns);
  },

  /**
   * @param {string[]} hideableColumns - needs it for now, as tableStore doesn't handle all data by itself and hideableColumns is built with data from two endpoints: asset and submissions
   * @param {string[]} columnsToBeVisible
   */
  setFieldsVisibility(hideableColumns, columnsToBeVisible) {
    let newSelectedColumns = columnsToBeVisible;

    // If we make all possible columns visible, we save `null` value
    if (newSelectedColumns.length === hideableColumns.length) {
      newSelectedColumns = null;
    }

    const settingsObj = {};
    settingsObj[DATA_TABLE_SETTINGS.SELECTED_COLUMNS] = newSelectedColumns;

    // If current frozen column is not in the newSelectedColumns, we need to
    // unfreeze it.
    const frozenColumn = this.getFrozenColumn();
    if (frozenColumn !== null && !newSelectedColumns.includes(frozenColumn)) {
      // Currently we allow only one frozen column, so we just set it to `null`.
      settingsObj[DATA_TABLE_SETTINGS.FROZEN_COLUMN] = null;
    }

    // If we are hiding the column that data is sorted by, we need to unsort it.
    const sortBy = this.getSortBy();
    if (
      sortBy !== null &&
      typeof sortBy === 'object' &&
      !newSelectedColumns.includes(sortBy.fieldId)
    ) {
      // Currently we allow only one sort column, so we just set it to `null`.
      settingsObj[DATA_TABLE_SETTINGS.SORT_BY] = null;
    }

    this.saveTableSettings(settingsObj);
  },
});

export default tableStore;

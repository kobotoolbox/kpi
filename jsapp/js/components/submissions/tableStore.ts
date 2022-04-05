import Reflux from 'reflux';
import clonedeep from 'lodash.clonedeep';
import assetStore from 'js/assetStore';
import mixins from 'js/mixins';
import {actions} from 'js/actions';
import {getRouteAssetUid} from 'js/router/routerUtils';
import {
  getRowName,
  getSurveyFlatPaths,
} from 'js/assetUtils';
import {
  PERMISSIONS_CODENAMES,
  QUESTION_TYPES,
  GROUP_TYPES_BEGIN,
  GROUP_TYPES_END,
} from 'js/constants';
import {
  EXCLUDED_COLUMNS,
  VALIDATION_STATUS_ID_PROP,
  SUBMISSION_ACTIONS_ID,
  DATA_TABLE_SETTING,
} from 'js/components/submissions/tableConstants';
import type {
  SubmissionResponse,
  AssetTableSettings,
  AssetSettings,
} from 'js/dataInterface';

interface TableStoreData {
  overrides: AssetTableSettings;
}

/**
 * TODO: tableStore should be handling all data required by table.es6, but as
 * this would mean a huge refactor, we will stick to providing a one way
 * interface for changing things in asset plus some utility functions.
 *
 * NOTE: To simplify code a bit, we assume this will be used only on the table
 * route - i.e. assetUid comes from url, and asset from other stores.
 *
 * Use these actions listeners to be up to date:
 * - `actions.table.updateSettings`
 */
class TableStore extends Reflux.Store {
  /** We use overrides for users with no permissions */
  data: TableStoreData = {
    overrides: {},
  };

  /** Returns settings or empty object if no settings exist */
  getTableSettings() {
    const asset = this.getCurrentAsset();

    // We clone settings, as we will possibly overwrite some of them. If there
    // are no settings yet, we start with empty object.
    const tableSettings: AssetTableSettings = clonedeep(asset?.settings[DATA_TABLE_SETTING]) || {};

    // overrides take precedense over asset endpoint settings
    if (typeof this.data.overrides['show-group-name'] !== 'undefined') {
      tableSettings['show-group-name'] = this.data.overrides['show-group-name'];
    }
    if (typeof this.data.overrides['translation-index'] !== 'undefined') {
      tableSettings['translation-index'] = this.data.overrides['translation-index'];
    }
    if (typeof this.data.overrides['show-hxl-tags'] !== 'undefined') {
      tableSettings['show-hxl-tags'] = this.data.overrides['show-hxl-tags'];
    }
    if (typeof this.data.overrides['sort-by'] !== 'undefined') {
      tableSettings['sort-by'] = this.data.overrides['sort-by'];
    }

    return tableSettings;
  }

  /**
   * @param {object} newTableSettings - will be merged into current settings, overwriting any DATA_TABLE_SETTING properties
   */
  saveTableSettings(newTableSettings: AssetTableSettings) {
    const asset = this.getCurrentAsset();

    if (asset === undefined) {
      console.error('No asset?');
    }

    // get whole asset settings (as clone to avoid bugs) to not lose existing
    // settings that are not updated by newTableSettings
    const newSettings: AssetSettings = clonedeep(asset?.settings) || {};

    // settings object doesn't even have DATA_TABLE_SETTING, we can pass newTableSettings
    if (!newSettings['data-table']) {
      newSettings['data-table'] = newTableSettings;
    // settings exist, so we merge them
    } else {
      newSettings['data-table'] = Object.assign(
        newSettings['data-table'],
        newTableSettings
      );
    }

    // Case 1: use can save, so we call the endpoint
    if (asset && mixins.permissions.userCan(PERMISSIONS_CODENAMES.change_asset, asset)) {
      // Cleanup all `null` settings, as we don't want to store `null`s and `null`
      // means "delete setting"
      const tableSettings = newSettings['data-table'];
      Object.entries(tableSettings).forEach((key, value) => {
        if (value === null && typeof key === 'string') {
          delete tableSettings[key];
        }
      });
      actions.table.updateSettings(asset.uid, newSettings);
    } else {
      // Case 2: user can't save, so we store temporary overrides
      this.setOverrides(newSettings['data-table']);
    }
  }

  /**
   * @param {object} newOverrides
   */
  setOverrides(newOverrides: AssetTableSettings) {
    if (typeof newOverrides['show-group-name'] !== 'undefined') {
      this.data.overrides['show-group-name'] = newOverrides['show-group-name'];
    }
    if (typeof newOverrides['translation-index'] !== 'undefined') {
      this.data.overrides['translation-index'] = newOverrides['translation-index'];
    }
    if (typeof newOverrides['show-hxl-tags'] !== 'undefined') {
      this.data.overrides['show-hxl-tags'] = newOverrides['show-hxl-tags'];
    }
    if (typeof newOverrides['sort-by'] !== 'undefined') {
      this.data.overrides['sort-by'] = newOverrides['sort-by'];
    }

    this.trigger(this.data);
  }

  /**
   * A shortcut method, to be deleted in future.
   */
  getCurrentAsset() {
    const routeAssetUid = getRouteAssetUid();
    if (routeAssetUid === null) {
      return undefined;
    }
    return assetStore.getAsset(routeAssetUid);
  }

  /** Returns a unique list of columns (keys) that should be displayed to users */
  getAllColumns(submissions: SubmissionResponse[]) {
    const asset = this.getCurrentAsset();

    if (asset?.content?.survey === undefined) {
      throw new Error('Asset not found');
    }

    const flatPaths = getSurveyFlatPaths(asset.content.survey);

    // add all questions from the survey definition
    let output = Object.values(flatPaths);

    // Gather unique columns from all visible submissions and add them to output
    const dataKeys = Object.keys(submissions.reduce(function (result, obj) {
      return Object.assign(result, obj);
    }, {}));
    output = [...new Set([...dataKeys, ...output])];

    // exclude some technical non-data columns
    output = output.filter((key) => EXCLUDED_COLUMNS.includes(key) === false);

    // exclude notes
    output = output.filter((key) => {
      const foundPathKey = Object.keys(flatPaths).find(
        (pathKey) => flatPaths[pathKey] === key
      );

      // no path means this definitely is not a note type
      if (!foundPathKey) {
        return true;
      }

      const foundNoteRow = asset?.content?.survey?.find(
        (row) =>
          typeof foundPathKey !== 'undefined' &&
          (foundPathKey === row.name || foundPathKey === row.$autoname) &&
          row.type === QUESTION_TYPES.note.id
      );

      if (typeof foundNoteRow !== 'undefined') {
        // filter out this row as this is a note type
        return false;
      }

      return true;
    });

    // exclude kobomatrix rows as data is not directly tied to them, but
    // to rows user answered to, thus making these columns always empty
    const excludedMatrixKeys: string[] = [];
    let isInsideKoboMatrix = false;
    asset.content.survey.forEach((row) => {
      if (row.type === GROUP_TYPES_BEGIN.begin_kobomatrix) {
        isInsideKoboMatrix = true;
      } else if (row.type === GROUP_TYPES_END.end_kobomatrix) {
        isInsideKoboMatrix = false;
      } else if (isInsideKoboMatrix) {
        const rowName = getRowName(row);
        const rowPath = flatPaths[rowName];
        excludedMatrixKeys.push(rowPath);
      }
    });
    output = output.filter((key) => excludedMatrixKeys.includes(key) === false);

    // Exclude repeat groups and regular groups as all of their data is handled
    // by children rows.
    // This also fixes the issue when a repeat group in older version becomes
    // a regular group in new form version (with the same name), and the Table
    // was displaying "[object Object]" as responses.
    const excludedGroups: string[] = [];
    const flatPathsWithGroups = getSurveyFlatPaths(asset.content.survey, true);
    asset.content.survey.forEach((row) => {
      if (
        row.type === GROUP_TYPES_BEGIN.begin_repeat ||
        row.type === GROUP_TYPES_BEGIN.begin_group
      ) {
        const rowName = getRowName(row);
        const rowPath = flatPathsWithGroups[rowName];
        excludedGroups.push(rowPath);
      }
    });
    output = output.filter((key) => excludedGroups.includes(key) === false);

    return output;
  }

  /** Returns a list of columns that user can hide */
  getHideableColumns(submissions: SubmissionResponse[]) {
    const columns = this.getAllColumns(submissions);
    columns.push(VALIDATION_STATUS_ID_PROP);
    return columns;
  }

  /**
   * `null` means no selection, i.e. all columns
   */
  getSelectedColumns(): string[] | null {
    const tableSettings = this.getTableSettings();
    if (Array.isArray(tableSettings['selected-columns'])) {
      return tableSettings['selected-columns'];
    }
    return null;
  }

  getFrozenColumn(): string | null {
    let frozenColumn = null;
    const tableSettings = this.getTableSettings();
    if (typeof tableSettings['frozen-column'] !== 'undefined') {
      frozenColumn = tableSettings['frozen-column'];
    }
    return frozenColumn;
  }

  isFieldVisible(fieldId: string) {
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
  }

  isFieldFrozen(fieldId: string) {
    return this.getFrozenColumn() === fieldId;
  }

  setFrozenColumn(fieldId: string, isFrozen: boolean) {
    // NOTE: Currently we only support one frozen column at a time, so that is
    // why making column not-frozen means we just null-ify the value, without
    // checking what column is frozen now.
    let newVal = null;
    if (isFrozen) {
      newVal = fieldId;
    }
    const settingsObj: AssetTableSettings = {};
    settingsObj['frozen-column'] = newVal;
    this.saveTableSettings(settingsObj);
  }

  /**
   * Returns `null` for no option, or one of SORT_VALUES
   */
  getFieldSortValue(fieldId: string) {
    const sortBy = this.getSortBy();
    if (sortBy === null) {
      return null;
    }

    if (sortBy?.fieldId === fieldId) {
      return sortBy.value;
    }

    return null;
  }

  setSortBy(
    fieldId: string,
    sortValue: 'ASCENDING' | 'DESCENDING' | null
  ) {
    let newSortBy = null;
    if (sortValue !== null) {
      newSortBy = {
        fieldId: fieldId,
        value: sortValue,
      };
    }

    const settingsObj: AssetTableSettings = {};
    settingsObj['sort-by'] = newSortBy;
    this.saveTableSettings(settingsObj);
  }

  getSortBy() {
    let sortBy = null;
    const tableSettings = this.getTableSettings();
    if (typeof tableSettings['sort-by'] !== 'undefined') {
      sortBy = tableSettings['sort-by'];
    }
    return sortBy;
  }

  showAllFields() {
    const settingsObj: AssetTableSettings = {};
    settingsObj['selected-columns'] = null;
    this.saveTableSettings(settingsObj);
  }

  /** Show single column - shortcut method for setFieldsVisibility */
  showField(submissions: SubmissionResponse[], fieldId: string) {
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

    this.setFieldsVisibility(submissions, newSelectedColumns);
  }

  /** Hide single column - a shortcut method for setFieldsVisibility */
  hideField(submissions: SubmissionResponse[], fieldId: string) {
    const selectedColumns = this.getSelectedColumns();
    const hideableColumns = this.getHideableColumns(submissions);

    let newSelectedColumns: string[] = [];

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

    this.setFieldsVisibility(submissions, newSelectedColumns);
  }

  setFieldsVisibility(submissions: SubmissionResponse[], columnsToBeVisible: string[] | null) {
    const hideableColumns = this.getHideableColumns(submissions);
    let newSelectedColumns = columnsToBeVisible;

    // If we make all possible columns visible, we save `null` value
    if (
      Array.isArray(newSelectedColumns) &&
      newSelectedColumns.length === hideableColumns.length
    ) {
      newSelectedColumns = null;
    }

    const settingsObj: AssetTableSettings = {};
    settingsObj['selected-columns'] = newSelectedColumns;

    // If current frozen column is not in the newSelectedColumns, we need to
    // unfreeze it.
    const frozenColumn = this.getFrozenColumn();
    if (
      frozenColumn !== null &&
      Array.isArray(newSelectedColumns) &&
      !newSelectedColumns.includes(frozenColumn)
    ) {
      // Currently we allow only one frozen column, so we just set it to `null`.
      settingsObj['frozen-column'] = null;
    }

    // If we are hiding the column that data is sorted by, we need to unsort it.
    const sortBy = this.getSortBy();
    if (
      sortBy !== null &&
      typeof sortBy === 'object' &&
      Array.isArray(newSelectedColumns) &&
      !newSelectedColumns.includes(sortBy.fieldId)
    ) {
      // Currently we allow only one sort column, so we just set it to `null`.
      settingsObj['sort-by'] = null;
    }

    this.saveTableSettings(settingsObj);
  }

  getShowGroupName() {
    let showGroupName;
    const tableSettings = this.getTableSettings();
    if (typeof tableSettings['show-group-name'] !== 'undefined') {
      showGroupName = tableSettings['show-group-name'];
    } else {
      showGroupName = true;
    }
    return showGroupName;
  }

  getTranslationIndex() {
    let translationIndex = 0;
    const tableSettings = this.getTableSettings();
    if (typeof tableSettings['translation-index'] !== 'undefined') {
      translationIndex = tableSettings['translation-index'] || 0;
    }
    return translationIndex;
  }

  getShowHXLTags() {
    let showHXLTags;
    const tableSettings = this.getTableSettings();
    if (typeof tableSettings['show-hxl-tags'] !== 'undefined') {
      showHXLTags = tableSettings['show-hxl-tags'];
    } else {
      showHXLTags = false;
    }
    return showHXLTags;
  }
}

const tableStore = new TableStore();

export default tableStore;

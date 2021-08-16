import Reflux from 'reflux';
import clonedeep from 'lodash.clonedeep';
import {stores} from 'js/stores';
import mixins from 'js/mixins';
import {actions} from 'js/actions';
import {getRouteAssetUid} from 'js/router/routerUtils';
import {getSurveyFlatPaths} from 'js/assetUtils';
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
  DATA_TABLE_SETTINGS,
} from 'js/components/submissions/tableConstants';

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
const tableStore = Reflux.createStore({
  /**
   * We use overrides for users with no permissions
   */
  data: {
    overrides: {
      // starts empty, but all possible properties are:
      // - DATA_TABLE_SETTINGS.SHOW_GROUP
      // - DATA_TABLE_SETTINGS.TRANSLATION
      // - DATA_TABLE_SETTINGS.SHOW_HXL
      // - DATA_TABLE_SETTINGS.SORT_BY
    },
  },

  /**
   * @returns {object} settings or empty object if no settings exist
   */
  getTableSettings() {
    let tableSettings = {};

    const asset = this.getCurrentAsset();
    if (
      asset?.settings &&
      asset?.settings[DATA_TABLE_SETTING]
    ) {
      // clone settings, as we will possibly overwrite some of them
      tableSettings = clonedeep(asset.settings[DATA_TABLE_SETTING]);

      // overrides take precedense over asset endpoint settings
      if (typeof this.data.overrides[DATA_TABLE_SETTINGS.SHOW_GROUP] !== 'undefined') {
        tableSettings[DATA_TABLE_SETTINGS.SHOW_GROUP] = this.data.overrides[DATA_TABLE_SETTINGS.SHOW_GROUP];
      }
      if (typeof this.data.overrides[DATA_TABLE_SETTINGS.TRANSLATION] !== 'undefined') {
        tableSettings[DATA_TABLE_SETTINGS.TRANSLATION] = this.data.overrides[DATA_TABLE_SETTINGS.TRANSLATION];
      }
      if (typeof this.data.overrides[DATA_TABLE_SETTINGS.SHOW_HXL] !== 'undefined') {
        tableSettings[DATA_TABLE_SETTINGS.SHOW_HXL] = this.data.overrides[DATA_TABLE_SETTINGS.SHOW_HXL];
      }
      if (typeof this.data.overrides[DATA_TABLE_SETTINGS.SORT_BY] !== 'undefined') {
        tableSettings[DATA_TABLE_SETTINGS.SORT_BY] = this.data.overrides[DATA_TABLE_SETTINGS.SORT_BY];
      }
    }

    return tableSettings;
  },

  /**
   * @param {object} newTableSettings - will be merged into current settings, overwriting any DATA_TABLE_SETTING properties
   */
  saveTableSettings(newTableSettings) {
    const asset = this.getCurrentAsset();

    // get whole asset settings (as clone to avoid bugs) to not lose existing
    // settings that are not updated by newTableSettings
    const newSettings = clonedeep(asset.settings);

    // settings object doesn't even have DATA_TABLE_SETTING, we can pass newTableSettings
    if (!newSettings[DATA_TABLE_SETTING]) {
      newSettings[DATA_TABLE_SETTING] = newTableSettings;
    // settings exist, so we merge them
    } else {
      newSettings[DATA_TABLE_SETTING] = Object.assign(
        newSettings[DATA_TABLE_SETTING],
        newTableSettings
      );
    }

    // Case 1: use can save, so we call the endpoint
    if (asset && mixins.permissions.userCan(PERMISSIONS_CODENAMES.change_asset, asset)) {
      // Cleanup all `null` settings, as we don't want to store `null`s and `null`
      // means "delete setting"
      Object.keys(newSettings[DATA_TABLE_SETTING]).forEach((key) => {
        if (newSettings[DATA_TABLE_SETTING][key] === null) {
          delete newSettings[DATA_TABLE_SETTING][key];
        }
      });
      actions.table.updateSettings(asset.uid, newSettings);
    } else {
      // Case 2: user can't save, so we store temporary overrides
      this.setOverrides(newSettings[DATA_TABLE_SETTING]);
    }
  },

  /**
   * @param {object} newOverrides
   */
  setOverrides(newOverrides) {
    const prevData = clonedeep(this.data);

    if (typeof newOverrides[DATA_TABLE_SETTINGS.SHOW_GROUP] !== 'undefined') {
      this.data.overrides[DATA_TABLE_SETTINGS.SHOW_GROUP] = newOverrides[DATA_TABLE_SETTINGS.SHOW_GROUP];
    }
    if (typeof newOverrides[DATA_TABLE_SETTINGS.TRANSLATION] !== 'undefined') {
      this.data.overrides[DATA_TABLE_SETTINGS.TRANSLATION] = newOverrides[DATA_TABLE_SETTINGS.TRANSLATION];
    }
    if (typeof newOverrides[DATA_TABLE_SETTINGS.SHOW_HXL] !== 'undefined') {
      this.data.overrides[DATA_TABLE_SETTINGS.SHOW_HXL] = newOverrides[DATA_TABLE_SETTINGS.SHOW_HXL];
    }
    if (typeof newOverrides[DATA_TABLE_SETTINGS.SORT_BY] !== 'undefined') {
      this.data.overrides[DATA_TABLE_SETTINGS.SORT_BY] = newOverrides[DATA_TABLE_SETTINGS.SORT_BY];
    }

    this.trigger(prevData, this.data);
  },

  /**
   * A shortcut method, to be deleted in future.
   */
  getCurrentAsset() {
    return stores.asset.getAsset(getRouteAssetUid());
  },

  /**
   * @param {object[]} submissions - list of submissions
   * @returns {string[]} a unique list of columns (keys) that should be displayed to users
   */
  getAllColumns(submissions) {
    const asset = this.getCurrentAsset();
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

      const foundNoteRow = asset.content.survey.find(
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
    const excludedMatrixKeys = [];
    let isInsideKoboMatrix = false;
    asset.content.survey.forEach((row) => {
      if (row.type === GROUP_TYPES_BEGIN.begin_kobomatrix) {
        isInsideKoboMatrix = true;
      } else if (row.type === GROUP_TYPES_END.end_kobomatrix) {
        isInsideKoboMatrix = false;
      } else if (isInsideKoboMatrix) {
        const rowPath = flatPaths[row.name] || flatPaths[row.$autoname];
        excludedMatrixKeys.push(rowPath);
      }
    });
    output = output.filter((key) => excludedMatrixKeys.includes(key) === false);

    // exclude repeat groups as we don't handle them in table yet
    const excludedRepeatGroups = [];
    const flatPathsWithGroups = getSurveyFlatPaths(asset.content.survey, true);
    asset.content.survey.forEach((row) => {
      if (row.type === GROUP_TYPES_BEGIN.begin_repeat) {
        const rowPath = flatPathsWithGroups[row.name] || flatPathsWithGroups[row.$autoname];
        excludedRepeatGroups.push(rowPath);
      }
    });
    output = output.filter((key) => excludedRepeatGroups.includes(key) === false);

    return output;
  },

  /**
   * @param {object[]} submissions - list of submissions
   * @returns {string[]} a list of columns that user can hide
   */
  getHideableColumns(submissions) {
    const columns = this.getAllColumns(submissions);
    columns.push(VALIDATION_STATUS_ID_PROP);
    return columns;
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
   * @returns {string|null} the current frozen column
   */
  getFrozenColumn() {
    let frozenColumn = null;
    const tableSettings = this.getTableSettings();
    if (typeof tableSettings[DATA_TABLE_SETTINGS.FROZEN_COLUMN] !== 'undefined') {
      frozenColumn = tableSettings[DATA_TABLE_SETTINGS.FROZEN_COLUMN];
    }
    return frozenColumn;
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
  setSortBy(fieldId, sortValue) {
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
   * @returns {object|null} the current sort by value
   */
  getSortBy() {
    let sortBy = null;
    const tableSettings = this.getTableSettings();
    if (typeof tableSettings[DATA_TABLE_SETTINGS.SORT_BY] !== 'undefined') {
      sortBy = tableSettings[DATA_TABLE_SETTINGS.SORT_BY];
    }
    return sortBy;
  },

  showAllFields() {
    const settingsObj = {};
    settingsObj[DATA_TABLE_SETTINGS.SELECTED_COLUMNS] = null;
    this.saveTableSettings(settingsObj);
  },

  /**
   * Show single column - shortcut method for setFieldsVisibility
   * @param {object[]} submissions
   * @param {string} fieldId
   */
  showField(submissions, fieldId) {
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
  },

  /**
   * Hide single column - a shortcut method for setFieldsVisibility
   * @param {object[]} submissions
   * @param {string} fieldId
   */
  hideField(submissions, fieldId) {
    const selectedColumns = this.getSelectedColumns();
    const hideableColumns = this.getHideableColumns(submissions);

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

    this.setFieldsVisibility(submissions, newSelectedColumns);
  },

  /**
   * @param {object[]} submissions
   * @param {string[]} columnsToBeVisible
   */
  setFieldsVisibility(submissions, columnsToBeVisible) {
    const hideableColumns = this.getHideableColumns(submissions);
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

  /**
   * @returns {boolean} whether to show group names, `true` by default
   */
  getShowGroupName() {
    let showGroupName = true;
    const tableSettings = this.getTableSettings();
    if (typeof tableSettings[DATA_TABLE_SETTINGS.SHOW_GROUP] !== 'undefined') {
      showGroupName = tableSettings[DATA_TABLE_SETTINGS.SHOW_GROUP];
    }
    return showGroupName;
  },

  /**
   * @returns {number} chosen translation index, `0` by default
   */
  getTranslationIndex() {
    let translationIndex = 0;
    const tableSettings = this.getTableSettings();
    if (typeof tableSettings[DATA_TABLE_SETTINGS.TRANSLATION] !== 'undefined') {
      translationIndex = tableSettings[DATA_TABLE_SETTINGS.TRANSLATION];
    }
    return translationIndex;
  },

  /**
   * @returns {boolean} whether to show HXL tags, `false` by default
   */
  getShowHXLTags() {
    let showHXLTags = false;
    const tableSettings = this.getTableSettings();
    if (typeof tableSettings[DATA_TABLE_SETTINGS.SHOW_HXL] !== 'undefined') {
      showHXLTags = tableSettings[DATA_TABLE_SETTINGS.SHOW_HXL];
    }
    return showHXLTags;
  },
});

export default tableStore;

import React from 'react';
import autoBind from 'react-autobind';
import Reflux from 'reflux';
import reactMixin from 'react-mixin';
import _ from 'underscore';
import clonedeep from 'lodash.clonedeep';
import enketoHandler from 'js/enketoHandler';
import Checkbox from 'js/components/common/checkbox';
import {actions} from 'js/actions';
import {bem} from 'js/bem';
import ui from 'js/ui';
import {stores} from 'js/stores';
import mixins from 'js/mixins';
import ReactTable from 'react-table';
import ValidationStatusDropdown, { SHOW_ALL_OPTION } from 'js/components/submissions/validationStatusDropdown';
import {DebounceInput} from 'react-debounce-input';
import {
  VALIDATION_STATUSES,
  VALIDATION_STATUSES_LIST,
  MODAL_TYPES,
  QUESTION_TYPES,
  GROUP_TYPES_BEGIN,
  GROUP_TYPES_END,
  META_QUESTION_TYPES,
  ADDITIONAL_SUBMISSION_PROPS,
  NUMERICAL_SUBMISSION_PROPS,
  ENKETO_ACTIONS,
} from 'js/constants';
import {formatTimeDate} from 'utils';
import {
  renderQuestionTypeIcon,
  getSurveyFlatPaths,
  getQuestionOrChoiceDisplayName,
} from 'js/assetUtils';
import {getRepeatGroupAnswers} from 'js/components/submissions/submissionUtils';
import TableBulkOptions from 'js/components/submissions/tableBulkOptions';
import TableBulkCheckbox from 'js/components/submissions/tableBulkCheckbox';
import TableColumnSortDropdown from 'js/components/submissions/tableColumnSortDropdown';
import {
  SORT_VALUES,
  EXCLUDED_COLUMNS,
  SUBMISSION_ACTIONS_ID,
  VALIDATION_STATUS_ID_PROP,
  DATA_TABLE_SETTING,
  DATA_TABLE_SETTINGS,
} from 'js/components/submissions/tableConstants';
import {getColumnLabel} from 'js/components/submissions/tableUtils';
import './table.scss';

const DEFAULT_PAGE_SIZE = 30;

/**
 * @prop {object} asset
 */
export class DataTable extends React.Component {
  constructor(props){
    super(props);
    this.state = {
      loading: true,
      tableData: [],
      columns: [],
      selectedColumns: false,
      sids: [],
      isFullscreen: false,
      pageSize: 30,
      currentPage: 0,
      sortOption: null,
      error: false,
      showLabels: true,
      translationIndex: 0,
      showGroupName: true,
      showHXLTags: false,
      resultsTotal: 0,
      selectedRows: {},
      selectAll: false,
      fetchState: false,
      submissionPager: false,
      overrideLabelsAndGroups: null,
    };

    // Store this value only to be able to check whether user is scrolling
    // horizontally or vertically.
    this.tableScrollTop = 0;
    autoBind(this);
  }

  componentDidMount() {
    stores.pageState.listen(this.onPageStateUpdated);
    actions.resources.updateSubmissionValidationStatus.completed.listen(this.onSubmissionValidationStatusChange);
    actions.resources.removeSubmissionValidationStatus.completed.listen(this.onSubmissionValidationStatusChange);
    actions.table.updateSettings.completed.listen(this.onTableUpdateSettingsCompleted);
    actions.resources.deleteSubmission.completed.listen(this.refreshSubmissions);
    actions.resources.duplicateSubmission.completed.listen(this.onDuplicateSubmissionCompleted);
    actions.resources.refreshTableSubmissions.completed.listen(this.refreshSubmissions);
    actions.submissions.getSubmissions.completed.listen(this.onGetSubmissionsCompleted);
    actions.submissions.getSubmissions.failed.listen(this.onGetSubmissionsFailed);
    actions.submissions.bulkDeleteStatus.completed.listen(this.onBulkChangeCompleted);
    actions.submissions.bulkPatchStatus.completed.listen(this.onBulkChangeCompleted);
    actions.submissions.bulkPatchValues.completed.listen(this.onBulkChangeCompleted);
    actions.submissions.bulkDelete.completed.listen(this.onBulkChangeCompleted);
  }

  componentDidUpdate(prevProps) {
    // If table settings changed, we need to fix columns, as after
    // `actions.table.updateSettings` resolves, the props asset is not yet updated
    if (
      JSON.stringify(this.props.asset.settings[DATA_TABLE_SETTING]) !==
      JSON.stringify(prevProps.asset.settings[DATA_TABLE_SETTING])
    ) {
      this._prepColumns(this.state.tableData);
    }
  }

  /**
   * Makes call to endpoint to get new submissions data
   *
   * @param {object} instance
   */
  fetchSubmissions(instance) {
    let pageSize = instance.state.pageSize;
    let page = instance.state.page * instance.state.pageSize;
    let filter = instance.state.filtered;
    let filterQuery = '';
    // sort comes from outside react-table
    let sort = [];

    if (filter.length) {
      filterQuery = '&query={';
      filter.forEach(function (f, i) {
        if (f.id === '_id') {
          filterQuery += `"${f.id}":{"$in":[${f.value}]}`;
        } else if (f.id === VALIDATION_STATUS_ID_PROP) {
          if (f.value === VALIDATION_STATUSES.no_status.value) {
            filterQuery += `"${f.id}":null`;
          } else {
            filterQuery += `"${f.id}":"${f.value}"`;
          }
        } else {
          filterQuery += `"${f.id}":{"$regex":"${f.value}","$options":"i"}`;
        }
        if (i < filter.length - 1) {
          filterQuery += ',';
        }
      });
      filterQuery += '}';
    }

    if (this.state.sortOption !== null) {
      sort.push({
        id: this.state.sortOption.fieldId,
        desc: this.state.sortOption.value === SORT_VALUES.Z_TO_A,
      });
    }

    actions.submissions.getSubmissions({
      uid: this.props.asset.uid,
      pageSize: pageSize,
      page: page,
      sort: sort,
      fields: [],
      filter: filterQuery,
    });
  }

  /**
   * @param {object} response
   * @param {object} options - the parameters that the call was made with
   */
  onGetSubmissionsCompleted(response, options) {
    let results = response.results;

    if (results && results.length > 0) {
      if (this.state.submissionPager === 'next') {
        this.submissionModalProcessing(results[0]._id, results);
      }
      if (this.state.submissionPager === 'prev') {
        this.submissionModalProcessing(results[results.length - 1]._id, results);
      }
      this.setState({
        loading: false,
        selectedRows: {},
        selectAll: false,
        tableData: results,
        submissionPager: false,
        resultsTotal: response.count,
      });
      this._prepColumns(results);
    } else if (options.filter.length) {
      // if there are no results, but there is some filtering applied, we don't
      // want to display the "no data" message
      this.setState({
        loading: false,
        selectedRows: {},
        tableData: results,
        resultsTotal: 0,
      });
    } else {
      this.setState({
        error: t('This project has no submitted data. Please collect some and try again.'),
        loading: false,
      });
    }
  }

  onGetSubmissionsFailed(error) {
    if (error?.responseText) {
      this.setState({error: error.responseText, loading: false});
    } else if (error?.statusText) {
      this.setState({error: error.statusText, loading: false});
    } else {
      this.setState({error: t('Error: could not load data.'), loading: false});
    }
  }

  /**
   * @param {object} originRow
   * @returns {object} one of VALIDATION_STATUSES
   */
  getValidationStatusOption(originalRow) {
    if (originalRow._validation_status && originalRow._validation_status.uid) {
      return VALIDATION_STATUSES[originalRow._validation_status.uid];
    } else {
      return VALIDATION_STATUSES.no_status;
    }
  }

  /**
   * Callback for dropdown.
   * @param {string} sid - submission id
   * @param {number} index
   * @param {object} newValidationStatus - one of VALIDATION_STATUSES
   */
  onValidationStatusChange(sid, index, newValidationStatus) {
    const _this = this;

    if (newValidationStatus.value === null) {
      actions.resources.removeSubmissionValidationStatus(
        _this.props.asset.uid,
        sid
      );
    } else {
      actions.resources.updateSubmissionValidationStatus(
        _this.props.asset.uid,
        sid,
        {'validation_status.uid': newValidationStatus.value}
      );
    }
  }

  /**
   * @returns {string|null} the current frozen column
   */
  getFrozenColumn() {
    let frozenColumn = null;
    const settings = this.props.asset.settings;
    if (settings[DATA_TABLE_SETTING] && settings[DATA_TABLE_SETTING][DATA_TABLE_SETTINGS.FROZEN_COLUMN]) {
      frozenColumn = settings[DATA_TABLE_SETTING][DATA_TABLE_SETTINGS.FROZEN_COLUMN];
    }
    return frozenColumn;
  }

  /**
   * @param {string} fieldId
   * @returns {string|null} null for no option, or one of SORT_VALUES
   */
  getFieldSortValue(fieldId) {
    if (this.state.sortOption === null) {
      return null;
    }

    if (this.state.sortOption?.fieldId === fieldId) {
      return this.state.sortOption.value;
    }
  }

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
  }

  /**
   * @param {string} fieldId
   * @returns {boolean}
   */
  isFieldFrozen(fieldId) {
    return this.getFrozenColumn() === fieldId;
  }

  /**
   * @param {string} fieldId
   * @param {string|null} sortValue one of SORT_VALUES or null for clear value
   */
  onFieldSortChange(fieldId, sortValue) {
    let newSortOption = null;
    if (sortValue !== null) {
      newSortOption = {
        fieldId: fieldId,
        value: sortValue,
      };
    }

    // after the state is set, get fresh submissions
    this.setState({sortOption: newSortOption}, this.refreshSubmissions);
  }

  onHideField(fieldId) {
    this.onFieldVisibleChange(fieldId, false);
  }

  /**
   * @param {string} fieldId
   * @param {boolean} isVisible
   */
  onFieldVisibleChange(fieldId, isVisible) {
    const hideableColumns = this.getHideableColumns();
    const selectedColumns = this.getSelectedColumns();

    let newSelectedColumns = [];

    // Case 1: nothing selected and we hide one column, i.e. we need to select all but one
    if (selectedColumns === null && isVisible === false) {
      newSelectedColumns = [...hideableColumns];
      newSelectedColumns.splice(newSelectedColumns.indexOf(fieldId), 1);
    }

    // Case 2: some fields selected and we hide one column
    if (Array.isArray(selectedColumns) && isVisible === false) {
      newSelectedColumns = [...selectedColumns];
      newSelectedColumns.splice(newSelectedColumns.indexOf(fieldId), 1);
    }

    // Case 3: some fields selected and we show one column
    if (Array.isArray(selectedColumns) && isVisible === true) {
      newSelectedColumns = [...selectedColumns];
      newSelectedColumns.push(fieldId);

      // Case 4: we are showing the last hidden column, we save `null` value
      if (newSelectedColumns.length === hideableColumns.length) {
        newSelectedColumns = null;
      }
    }

    const settingsObj = {};
    settingsObj[DATA_TABLE_SETTINGS.SELECTED_COLUMNS] = newSelectedColumns;

    // If we are hiding the column that is frozen, we need to unfreeze it
    if (this.isFieldFrozen(fieldId) && isVisible === false) {
      settingsObj[DATA_TABLE_SETTINGS.FROZEN_COLUMN] = null;
    }

    this.saveTableSettings(settingsObj);
  }

  /**
   * Compares if two arrays contain exactly the same unique values, disregarding the order
   */
  isSameValuesArray(array1, array2) {
    // make sets out of arrays to ensure only unique values are present
    const set1 = new Set(array1);
    const set2 = new Set(array2);
    return (
      set1.size === set2.size &&
      // check if combinging both sets into new set gives identical set size
      new Set([...set1, ...set2]).size === set1.size
    );
  }

  /**
   * @param {string} fieldId
   * @param {boolean} isFrozen
   */
  onFieldFrozenChange(fieldId, isFrozen) {
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
  }

  /**
   * @returns {object} settings or empty object if no settings exist
   */
  getTableSettings() {
    if (
      this.props.asset?.settings &&
      this.props.asset?.settings[DATA_TABLE_SETTING]
    ) {
      return this.props.asset.settings[DATA_TABLE_SETTING];
    }
    return {};
  }

  /**
   * @param {object} newTableSettings - will be merged into current settings, overwriting any DATA_TABLE_SETTING properties
   */
  saveTableSettings(newTableSettings) {
    // get whole asset settings as clone to avoid bugs
    const newSettings = clonedeep(this.props.asset.settings);

    if (!newSettings[DATA_TABLE_SETTING]) {
      newSettings[DATA_TABLE_SETTING] = newTableSettings;
    } else {
      newSettings[DATA_TABLE_SETTING] = Object.assign(
        newSettings[DATA_TABLE_SETTING],
        newTableSettings
      );
    }

    if (this.userCan('change_asset', this.props.asset)) {
      actions.table.updateSettings(this.props.asset.uid, newSettings);
    }
  }

  /**
   * @returns {string[]} a list of columns that user can hide
   */
  getHideableColumns() {
    const columns = this.getDisplayedColumns(this.state.tableData);
    columns.push(VALIDATION_STATUS_ID_PROP);
    return columns;
  }

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
  }

  /**
   * @param {object[]} data - list of submissions
   * @returns {string[]} a unique list of columns (keys) that should be displayed to users
   */
  getDisplayedColumns(data) {
    const flatPaths = getSurveyFlatPaths(this.props.asset.content.survey);

    // add all questions from the survey definition
    let output = Object.values(flatPaths);

    // Gather unique columns from all visible submissions and add them to output
    const dataKeys = Object.keys(data.reduce(function (result, obj) {
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

      const foundNoteRow = this.props.asset.content.survey.find(
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
    this.props.asset.content.survey.forEach((row) => {
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

    return output;
  }

  /**
   * @param {number} maxPageRes
   * @returns {object} submission actions column for react-table
   */
  _getColumnSubmissionActions(maxPageRes) {
    let userCanSeeEditIcon = (
      this.props.asset.deployment__active &&
      this.userCan('change_submissions', this.props.asset)
    );

    let userCanSeeCheckbox = (
      this.userCan('validate_submissions', this.props.asset) ||
      this.userCan('delete_submissions', this.props.asset) ||
      this.userCan('change_submissions', this.props.asset)
    );

    if (
      this.userCan('validate_submissions', this.props.asset) ||
      this.userCan('delete_submissions', this.props.asset) ||
      this.userCan('change_submissions', this.props.asset) ||
      this.userCan('view_submissions', this.props.asset)
    ) {
      const res1 = (this.state.resultsTotal === 0) ? 0 : (this.state.currentPage * this.state.pageSize) + 1;
      const res2 = Math.min((this.state.currentPage + 1) * this.state.pageSize, this.state.resultsTotal);

      // To accommodate the checkbox, icon buttons and header text.
      let columnWidth = 100;
      if (this.state.resultsTotal >= 100000) {
        // Whenever there are more results we need a bit more space for
        // the "X results" text.
        columnWidth += 20;
      }

      let columnClassNames = ['rt-sub-actions', 'is-frozen'];
      let frozenColumn = this.getFrozenColumn();
      if (!frozenColumn) {
        columnClassNames.push('is-last-frozen');
      }

      return {
        Header: () => (
          <div>
            <div className='table-header-results'>
              {res1} - {res2}
              <br/>
              <strong>{this.state.resultsTotal} {t('results')}</strong>
            </div>
          </div>
        ),
        accessor: 'sub-actions',
        index: '__0',
        id: SUBMISSION_ACTIONS_ID,
        width: columnWidth,
        filterable: true, // Not filterable, but we need react-table to render TableBulkCheckbox (the filter cell override)
        sortable: false,
        resizable: false,
        headerClassName: columnClassNames.join(' '),
        className: columnClassNames.join(' '),
        Filter: () => {
          if (userCanSeeCheckbox) {
            return (
              <TableBulkCheckbox
                visibleRowsCount={maxPageRes}
                selectedRowsCount={Object.keys(this.state.selectedRows).length}
                totalRowsCount={this.state.resultsTotal}
                onSelectAllPages={this.bulkSelectAll}
                onSelectCurrentPage={this.bulkSelectAllRows.bind(this, true)}
                onClearSelection={this.bulkClearSelection}
              />
            );
          }
        },
        Cell: (row) => (
          <div className='table-submission-actions'>
            {userCanSeeCheckbox &&
              <Checkbox
                checked={this.state.selectedRows[row.original._id] ? true : false}
                onChange={this.bulkUpdateChange.bind(this, row.original._id)}
              />
            }

            <button
              onClick={this.launchSubmissionModal.bind(this, row)}
              data-sid={row.original._id}
              className='table-link'
              data-tip={t('Open')}
            >
              <i className='k-icon k-icon-view'/>
            </button>

            {userCanSeeEditIcon &&
              <button
                onClick={this.launchEditSubmission.bind(this)}
                data-sid={row.original._id}
                className='table-link'
                data-tip={t('Edit')}
              >
                <i className='k-icon k-icon-edit'/>
              </button>
            }
          </div>
        ),
      };
    }
  }

  /**
   * @returns {object} validation status column for react-table
   */
  _getColumnValidation() {
    return {
      Header: () => (
        <div className='column-header-wrapper'>
          <TableColumnSortDropdown
            fieldId={VALIDATION_STATUS_ID_PROP}
            sortValue={this.getFieldSortValue(VALIDATION_STATUS_ID_PROP)}
            onSortChange={this.onFieldSortChange}
            onHide={this.onHideField}
            isFieldFrozen={this.isFieldFrozen(VALIDATION_STATUS_ID_PROP)}
            onFrozenChange={this.onFieldFrozenChange}
            additionalTriggerContent={
              <span className='column-header-title'>
                {t('Validation status')}
              </span>
            }
          />
        </div>
      ),
      sortable: false,
      accessor: VALIDATION_STATUS_ID_PROP,
      index: '__2',
      id: VALIDATION_STATUS_ID_PROP,
      width: 130,
      className: 'rt-status',
      headerClassName: 'rt-status',
      Filter: ({ filter, onChange }) => {
        let currentOption = VALIDATION_STATUSES_LIST.find((item) => item.value === filter?.value);
        if (!currentOption) {
          currentOption = SHOW_ALL_OPTION;
        }
        return (
          <ValidationStatusDropdown
            onChange={(selectedOption) => {onChange(selectedOption.value);}}
            currentValue={currentOption}
            isForHeaderFilter
          />
        );
      },
      Cell: (row) => (
        <ValidationStatusDropdown
          onChange={this.onValidationStatusChange.bind(this, row.original._id, row.index)}
          currentValue={this.getValidationStatusOption(row.original)}
          isDisabled={!this.userCan('validate_submissions', this.props.asset)}
        />
      ),
    };
  }

  /**
   * Builds and gathers all necessary react-table data and stores in state.
   *
   * @param {object[]} data - list of submissions
   */
  _prepColumns(data) {
    const displayedColumns = this.getDisplayedColumns(data);

    let showLabels = this.state.showLabels;
    let showGroupName = this.state.showGroupName;
    let showHXLTags = this.state.showHXLTags;
    let settings = this.props.asset.settings;
    let translationIndex = this.state.translationIndex;
    let maxPageRes = Math.min(this.state.pageSize, this.state.tableData.length);
    let _this = this;

    if (settings[DATA_TABLE_SETTING] && settings[DATA_TABLE_SETTING][DATA_TABLE_SETTINGS.TRANSLATION] !== null) {
      translationIndex = settings[DATA_TABLE_SETTING][DATA_TABLE_SETTINGS.TRANSLATION];
      showLabels = translationIndex > -1;
    }

    if (settings[DATA_TABLE_SETTING] && settings[DATA_TABLE_SETTING][DATA_TABLE_SETTINGS.SHOW_GROUP] !== null) {
      showGroupName = settings[DATA_TABLE_SETTING][DATA_TABLE_SETTINGS.SHOW_GROUP];
    }

    if (settings[DATA_TABLE_SETTING] && settings[DATA_TABLE_SETTING][DATA_TABLE_SETTINGS.SHOW_HXL] !== null) {
      showHXLTags = settings[DATA_TABLE_SETTING][DATA_TABLE_SETTINGS.SHOW_HXL];
    }

    // check for overrides by users with view permissions only
    // see tableSettings.es6's saveTableColumns()
    if (this.state.overrideLabelsAndGroups !== null) {
      showGroupName = this.state.overrideLabelsAndGroups.showGroupName;
      translationIndex = this.state.overrideLabelsAndGroups.translationIndex;
      showLabels = translationIndex > -1;
    }

    // define the columns array
    const columns = [];

    const columnSubmissionActions = this._getColumnSubmissionActions(maxPageRes);
    if (columnSubmissionActions) {
      columns.push(columnSubmissionActions);
    }

    const columnValidation = this._getColumnValidation();
    if (columnValidation) {
      columns.push(columnValidation);
    }

    let survey = this.props.asset.content.survey;
    let choices = this.props.asset.content.choices;
    displayedColumns.forEach((key) => {
      var q;
      var qParentG = [];
      if (key.includes('/')) {
        qParentG = key.split('/');
        q = survey.find((o) => o.name === qParentG[qParentG.length - 1] || o.$autoname === qParentG[qParentG.length - 1]);
      } else {
        q = survey.find((o) => o.name === key || o.$autoname === key);
      }

      if (q && q.type === GROUP_TYPES_BEGIN.begin_repeat) {
        return false;
      }

      // Set ordering of question columns. Meta questions can be prepended or
      // appended relative to survey questions with an index prefix

      // sets location of columns for questions not in current survey version
      // `y` puts this case in front of known meta types
      var index = 'y_' + key;

      // Get background-audio question name in case user changes it
      const backgroundAudioName = this.getBackgroundAudioQuestionName();

      // place meta question columns at the very end with `z` prefix
      switch(key) {
        case META_QUESTION_TYPES.username:
            index = 'z1';
            break;
        case META_QUESTION_TYPES.simserial:
            index = 'z2';
            break;
        case META_QUESTION_TYPES.subscriberid:
            index = 'z3';
            break;
        case META_QUESTION_TYPES.deviceid:
            index = 'z4';
            break;
        case META_QUESTION_TYPES.phonenumber:
            index = 'z5';
            break;
        case META_QUESTION_TYPES.today:
            index = 'z6';
            break;
        case '__version__':
        case '_version_':
            index = 'z7';
            break;
        case ADDITIONAL_SUBMISSION_PROPS._id:
            index = 'z8';
            break;
        case ADDITIONAL_SUBMISSION_PROPS._uuid:
            index = 'z9';
            break;
        case ADDITIONAL_SUBMISSION_PROPS._submission_time:
            index = 'z91';
            break;
        case ADDITIONAL_SUBMISSION_PROPS._submitted_by:
            index = 'z92';
            break;
        // set index for `background-audio` to the very first column with `_`
        case backgroundAudioName:
            index = '_1';
            break;
        default:
          // set index for questions in current version of survey (including questions in groups)
          survey.map(function (x, i) {
            var k = key;
            if (key.includes('/')) {
              var kArray = k.split('/');
              k = kArray[kArray.length - 1];
            }
            if (x.name === k || x.$autoname === k) {
              index = i.toString();
            }
          });
      }

      let columnClassNames = '';
      if (
        (q && NUMERICAL_SUBMISSION_PROPS[q.type]) ||
        NUMERICAL_SUBMISSION_PROPS[key]
      ) {
        columnClassNames += 'rt-numerical-value';
      }

      let columnIcon = null;
      if (q && q.type) {
        columnIcon = renderQuestionTypeIcon(q.type);
      }

      columns.push({
        Header: () => {
          const columnName = getColumnLabel(
            this.props.asset.content.survey,
            key,
            q,
            qParentG,
            this.state.showGroupName,
            this.state.translationIndex
          );
          const columnHXLTags = _this.getColumnHXLTags(key);
          return (
            <div className='column-header-wrapper'>
              <TableColumnSortDropdown
                fieldId={key}
                sortValue={this.getFieldSortValue(key)}
                onSortChange={this.onFieldSortChange}
                onHide={this.onHideField}
                isFieldFrozen={this.isFieldFrozen(key)}
                onFrozenChange={this.onFieldFrozenChange}
                additionalTriggerContent={
                  <span className='column-header-title' title={columnName}>
                    {columnIcon}
                    {columnName}
                  </span>
                }
              />
              {this.state.showHXLTags && columnHXLTags &&
                <span className='column-header-hxl-tags' title={columnHXLTags}>{columnHXLTags}</span>
              }
            </div>
          );
        },
        id: key,
        accessor: (row) => row[key],
        index: index,
        question: q,
        filterable: false,
        sortable: false,
        className: columnClassNames,
        Cell: (row) => {
          if (showLabels && q && q.type && row.value) {
            if (
              q.type === QUESTION_TYPES.image.id ||
              q.type === QUESTION_TYPES.audio.id ||
              q.type === QUESTION_TYPES.video.id ||
              q.type === META_QUESTION_TYPES['background-audio']
            ) {
              var mediaURL = this.getMediaDownloadLink(row, row.value);
              return (
                <a href={mediaURL} target='_blank'>
                  <span className='trimmed-text'>{row.value}</span>
                </a>
              );
            }

            // show proper labels for choice questions
            if (q.type === QUESTION_TYPES.select_one.id) {
              let choice = choices.find((o) =>
                o.list_name === q.select_from_list_name &&
                (o.name === row.value || o.$autoname === row.value)
              );
              if (choice?.label && choice.label[translationIndex]) {
                return (
                  <span className='trimmed-text'>
                    {choice.label[translationIndex]}
                  </span>
                );
              } else {
                return (
                  <span className='trimmed-text'>{row.value}</span>
                );
              }
            }
            if (q.type === QUESTION_TYPES.select_multiple.id && row.value) {
              let values = row.value.split(' ');
              var labels = [];
              values.forEach(function (v) {
                let choice = choices.find((o) =>
                  o.list_name === q.select_from_list_name &&
                  (o.name === v || o.$autoname === v)
                );
                if (choice && choice.label && choice.label[translationIndex]) {
                  labels.push(choice.label[translationIndex]);
                }
              });

              return (
                <span className='trimmed-text'>{labels.join(', ')}</span>
              );
            }
            if (
              q.type === META_QUESTION_TYPES.start ||
              q.type === META_QUESTION_TYPES.end ||
              q.type === ADDITIONAL_SUBMISSION_PROPS._submission_time
            ) {
              return (
                <span className='trimmed-text'>
                  {formatTimeDate(row.value)}
                </span>
              );
            }
          }
          if (typeof(row.value) === 'object' || row.value === undefined) {
            const repeatGroupAnswers = getRepeatGroupAnswers(row.original, key);

            if (repeatGroupAnswers) {
              // display a list of answers from a repeat group question
              return (
                <span className='trimmed-text'>
                  {repeatGroupAnswers.join(', ')}
                </span>
              );
            } else {
              return '';
            }
          } else {
            return (<span className='trimmed-text'>{row.value}</span>);
          }
        },
      });

    });

    columns.sort(function (a, b) {
      return a.index.localeCompare(b.index, 'en', {numeric: true});
    });

    let selectedColumns = false;
    let frozenColumn = this.getFrozenColumn();
    const textFilterQuestionTypes = [
      QUESTION_TYPES.text.id,
      QUESTION_TYPES.integer.id,
      QUESTION_TYPES.decimal.id,
      QUESTION_TYPES.select_multiple.id,
      QUESTION_TYPES.date.id,
      QUESTION_TYPES.time.id,
      QUESTION_TYPES.datetime.id,
      META_QUESTION_TYPES.start,
      META_QUESTION_TYPES.end,
      META_QUESTION_TYPES.username,
      META_QUESTION_TYPES.simserial,
      META_QUESTION_TYPES.subscriberid,
      META_QUESTION_TYPES.deviceid,
      META_QUESTION_TYPES.phonenumber,
      META_QUESTION_TYPES.today,
      META_QUESTION_TYPES['background-audio'],
    ];
    const textFilterQuestionIds = [
      '__version__',
      ADDITIONAL_SUBMISSION_PROPS._id,
      ADDITIONAL_SUBMISSION_PROPS._uuid,
      ADDITIONAL_SUBMISSION_PROPS._submission_time,
      ADDITIONAL_SUBMISSION_PROPS._submitted_by,
    ];

    columns.forEach(function (col) {
      // TODO: see if this can work for select_multiple too
      if (col.question && col.question.type === QUESTION_TYPES.select_one.id) {
        col.filterable = true;
        col.Filter = ({ filter, onChange }) =>
          <select
            onChange={(event) => onChange(event.target.value)}
            style={{ width: '100%' }}
            value={filter ? filter.value : ''}
          >
            <option value=''>{t('Show All')}</option>
            {choices.filter((c) => c.list_name === col.question.select_from_list_name).map((item, n) => {
              const displayName = getQuestionOrChoiceDisplayName(item, translationIndex);
              return (<option value={item.name} key={n}>{displayName}</option>);
            })}
          </select>;
      }
      if (
        (col.question && textFilterQuestionTypes.includes(col.question.type))
        || textFilterQuestionIds.includes(col.id)
      ) {
        col.filterable = true;
        col.Filter = ({ filter, onChange }) =>
          <DebounceInput
            value={filter ? filter.value : undefined}
            debounceTimeout={750}
            onChange={(event) => onChange(event.target.value)}
            className='table-filter-input'
            placeholder={t('Search')}
          />;
      }

      if (frozenColumn === col.id) {
        col.className = col.className ? `is-frozen is-last-frozen ${col.className}` : 'is-frozen is-last-frozen';
        col.headerClassName = 'is-frozen is-last-frozen';
      }
    });

    // prepare list of selected columns, if configured
    if (settings[DATA_TABLE_SETTING] && settings[DATA_TABLE_SETTING][DATA_TABLE_SETTINGS.SELECTED_COLUMNS]) {
      const selCos = settings[DATA_TABLE_SETTING][DATA_TABLE_SETTINGS.SELECTED_COLUMNS];

      // always include frozenColumn, if set
      if (frozenColumn && !selCos.includes(frozenColumn)) {
        selCos.unshift(frozenColumn);
      }

      selectedColumns = columns.filter((el) => {
        // always include checkbox column
        if (el.id === SUBMISSION_ACTIONS_ID) {
          return true;
        }

        return selCos.includes(el.id) !== false;
      });
    }

    this.setState({
      columns: columns,
      selectedColumns: selectedColumns,
      translationIndex: translationIndex,
      showLabels: showLabels,
      showGroupName: showGroupName,
      showHXLTags: showHXLTags,
    });
  }

  /**
   * @param {string} key - column id/question name
   * @returns {string|null} given column's HXL tags
   */
  getColumnHXLTags(key) {
    if (this.state.showHXLTags) {
      const colQuestion = _.find(this.props.asset.content.survey, (question) =>
        question.$autoname === key
      );
      if (!colQuestion || !colQuestion.tags) {
        return null;
      }
      const HXLTags = [];
      colQuestion.tags.map((tag) => {
        if (tag.startsWith('hxl:')) {
          HXLTags.push(tag.replace('hxl:', ''));
        }
      });
      if (HXLTags.length === 0) {
        return null;
      } else {
        return HXLTags.join('');
      }
    } else {
      return null;
    }
  }

  /**
   * Used to change some settings in TableSettings when user doesn't have
   * permissions to save them.
   * @param {object} overrides
   */
  overrideLabelsAndGroups(overrides) {
    stores.pageState.hideModal();
    this.setState({
      overrideLabelsAndGroups: overrides,
    }, () => {
      this._prepColumns(this.state.tableData);
    });
  }

  toggleFullscreen() {
    this.setState({isFullscreen: !this.state.isFullscreen});
  }

  /**
   * @param {object} result
   * @param {string} sid
   */
  onSubmissionValidationStatusChange(result, sid) {
    if (sid) {
      var subIndex = this.state.tableData.findIndex((x) => x._id === parseInt(sid));
      if (typeof subIndex !== 'undefined' && this.state.tableData[subIndex]) {
        var newData = this.state.tableData;
        newData[subIndex]._validation_status = result || {};
        this.setState({tableData: newData});
        this._prepColumns(newData);
      }
    }
  }

  refreshSubmissions() {
    this.fetchSubmissions(this.state.fetchInstance);
  }

  /**
   * @param {string} uid
   * @param {string} sid
   * @param {object} duplicatedSubmission
   */
  onDuplicateSubmissionCompleted(uid, sid, duplicatedSubmission) {
    this.fetchSubmissions(this.state.fetchInstance);
    this.submissionModalProcessing(sid, this.state.tableData, true, duplicatedSubmission);
  }

  onTableUpdateSettingsCompleted() {
    // Close table settings modal after settings are saved.
    stores.pageState.hideModal();
    // Any updates after table settings are saved are handled by `componentDidUpdate`.
  }

  /**
   * @param {object} state
   * @param {object} instance
   */
  fetchData(state, instance) {
    this.setState({
      loading: true,
      pageSize: instance.state.pageSize,
      currentPage: instance.state.page,
      fetchState: state,
      fetchInstance: instance,
    });
    this.fetchSubmissions(instance);
  }

  /**
   * TODO: if multiple background-audio's are allowed, we should return all
   * background-audio related names
   * @returns {string|null}
   */
  getBackgroundAudioQuestionName() {
    return this.props?.asset?.content?.survey.find(
      (item) => item.type === META_QUESTION_TYPES['background-audio']
    )?.name || null;
  }

  /**
   * Opens submission modal
   * @param {object} row
   */
  launchSubmissionModal(row) {
    if (row && row.original) {
      const sid = row.original._id;
      const backgroundAudioName = this.getBackgroundAudioQuestionName();
      if (
        backgroundAudioName &&
        Object.keys(row.original).includes(backgroundAudioName)
      ) {
        let backgroundAudioUrl = this.getMediaDownloadLink(
          row,
          row.original[backgroundAudioName]
        );

        this.submissionModalProcessing(
          sid,
          this.state.tableData,
          false,
          null,
          backgroundAudioUrl,
        );
      } else {
        this.submissionModalProcessing(sid, this.state.tableData);
      }
    }
  }

  /**
   * Opens (or updates data in opened) submission modal
   *
   * @param {string} sid
   * @param {object[]} tableData
   * @param {boolean} isDuplicated
   * @param {object} duplicatedSubmission
   * @param {string} backgroundAudioUrl
   */
  submissionModalProcessing(
    sid,
    tableData,
    isDuplicated = false,
    duplicatedSubmission = null,
    backgroundAudioUrl = null,
  ) {
    let ids = [];

    tableData.forEach(function (r) {
      ids.push(r._id);
    });

    stores.pageState.showModal({
      type: MODAL_TYPES.SUBMISSION,
      sid: sid,
      asset: this.props.asset,
      ids: ids,
      isDuplicated: isDuplicated,
      duplicatedSubmission: duplicatedSubmission,
      backgroundAudioUrl: backgroundAudioUrl,
      tableInfo: {
        currentPage: this.state.currentPage,
        pageSize: this.state.pageSize,
        resultsTotal: this.state.resultsTotal,
      },
    });
  }

  showTableColumnsOptionsModal() {
    stores.pageState.showModal({
      type: MODAL_TYPES.TABLE_SETTINGS,
      asset: this.props.asset,
      columns: this.state.columns,
      overrideLabelsAndGroups: this.overrideLabelsAndGroups,
    });
  }

  launchEditSubmission(evt) {
    enketoHandler.openSubmission(
      this.props.asset.uid,
      evt.currentTarget.dataset.sid,
      ENKETO_ACTIONS.edit);
  }

  onPageStateUpdated(pageState) {
    if (!pageState.modal) {
      return false;
    }

    if (pageState.modal.type === MODAL_TYPES.BULK_EDIT_SUBMISSIONS) {
      return false;
    }

    let params = pageState.modal;
    let page = 0;

    if (params.type !== MODAL_TYPES.TABLE_SETTINGS && !params.sid) {
      let fetchInstance = this.state.fetchInstance;
      if (params.page === 'next') {
        page = this.state.currentPage + 1;
      }
      if (params.page === 'prev') {
        page = this.state.currentPage - 1;
      }

      fetchInstance.setState({ page: page });
      this.setState({
        fetchInstance: fetchInstance,
        submissionPager: params.page,
      }, function () {
        this.fetchData(this.state.fetchState, this.state.fetchInstance);
      });
    }
  }

  /**
   * Handles a given row bulk checkbox change
   * @param {string} sid
   * @param {boolean} isChecked
   */
  bulkUpdateChange(sid, isChecked) {
    let selectedRows = this.state.selectedRows;

    if (isChecked) {
      selectedRows[sid] = true;
    } else {
      delete selectedRows[sid];
    }

    this.setState({
      selectedRows: selectedRows,
      selectAll: false,
    });
  }

  /**
   * Handles whole page bulk checkbox change
   * @param {boolean} isChecked
   */
  bulkSelectAllRows(isChecked) {
    let s = this.state.selectedRows;
    this.state.tableData.forEach(function (r) {
      if (isChecked) {
        s[r._id] = true;
      } else {
        delete s[r._id];
      }
    }
    );

    // If the entirety of the results has been selected, selectAll should be true
    // Useful when the # of results is smaller than the page size.
    let scount = Object.keys(s).length;

    if (scount === this.state.resultsTotal) {
      this.setState({
        selectedRows: s,
        selectAll: true,
      });
    } else {
      this.setState({
        selectedRows: s,
        selectAll: false,
      });
    }
  }

  onBulkChangeCompleted() {
    this.fetchData(this.state.fetchState, this.state.fetchInstance);
  }

  /**
   * Handles all pages bulk change
   */
  bulkSelectAll() {
    // make sure all rows on current page are selected
    let s = this.state.selectedRows;
    this.state.tableData.forEach(function (r) {
      s[r._id] = true;
    });

    this.setState({
      selectedRows: s,
      selectAll: true,
    });
  }

  bulkClearSelection() {
    this.setState({selectAll: false, selectedRows: {}});
  }

  renderBulkSelectUI() {
    if (!this.state.tableData.length) {
      return false;
    }

    return (
      <bem.TableMeta>
        <TableBulkOptions
          asset={this.props.asset}
          data={this.state.tableData}
          pageSize={this.state.pageSize}
          totalRowsCount={this.state.resultsTotal}
          selectedRows={this.state.selectedRows}
          selectedAllPages={this.state.selectAll}
          fetchState={this.state.fetchState}
          onClearSelection={this.bulkClearSelection.bind(this)}
        />
      </bem.TableMeta>
    );
  }

  /**
   * @param {object} row
   * @param {string} fileName
   */
  getMediaDownloadLink(row, fileName) {
    const fileNameNoSpaces = fileName.replace(/ /g, '_');
    let mediaURL = t('Could not find ##fileName##').replace(
      '##fileName##',
      fileName
    );

    row.original._attachments.forEach((attachment) => {
      if (attachment.filename.includes(fileNameNoSpaces)) {
        mediaURL = attachment.download_url;
      }
    });

    return mediaURL;
  }

  // NOTE: Please avoid calling `setState` inside scroll callback, as it causes
  // a noticeable lag.
  onTableScroll(evt) {
    // We need this check, because when scrolling vertically, the scrollLeft
    // property is always `0` (which seems like a browser bug).
    if (this.tableScrollTop === evt.target.scrollTop) {
      const left = evt.target.scrollLeft > 0 ? evt.target.scrollLeft : 0;
      const $frozenColumnCells = $('.ReactTable .rt-tr .is-frozen');

      if (left >= 1) {
        $frozenColumnCells.addClass('is-scrolled-horizontally');
      } else {
        $frozenColumnCells.removeClass('is-scrolled-horizontally');
      }

      $frozenColumnCells.css({left: left});
    } else {
      this.tableScrollTop = evt.target.scrollTop;
    }
  }

  render() {
    if (this.state.error) {
      return (
        <ui.Panel>
          <bem.Loading>
            <bem.Loading__inner>
              {this.state.error}
            </bem.Loading__inner>
          </bem.Loading>
        </ui.Panel>
      );
    }

    const { tableData, columns, selectedColumns, loading, pageSize, resultsTotal } = this.state;
    const pages = Math.floor(((resultsTotal - 1) / pageSize) + 1);

    let tableClasses = ['-highlight'];
    if (this.state.showHXLTags) {
      tableClasses.push('has-hxl-tags-visible');
    }

    const formViewModifiers = ['table'];
    if (this.state.isFullscreen) {
      formViewModifiers.push('fullscreen');
    }
    return (
      <bem.FormView m={formViewModifiers}>
        <bem.FormView__group m={['table-header', this.state.loading ? 'table-loading' : 'table-loaded']}>
          {this.renderBulkSelectUI()}
          <bem.FormView__item m='table-buttons'>
            <bem.Button
              m='icon' className='report-button__expand right-tooltip'
              onClick={this.toggleFullscreen}
              data-tip={t('Toggle fullscreen')}
            >
              <i className='k-icon k-icon-expand' />
            </bem.Button>

            <bem.Button
              m='icon' className='report-button__expand right-tooltip'
              onClick={this.showTableColumnsOptionsModal}
              data-tip={t('Display options')}
            >
              <i className='k-icon k-icon-settings' />
            </bem.Button>
          </bem.FormView__item>
        </bem.FormView__group>

        <ReactTable
          data={tableData}
          columns={selectedColumns || columns}
          defaultPageSize={DEFAULT_PAGE_SIZE}
          pageSizeOptions={[10, 30, 50, 100, 200, 500]}
          minRows={0}
          className={tableClasses.join(' ')}
          pages={pages}
          manual
          onFetchData={this.fetchData}
          loading={loading}
          previousText={(
            <React.Fragment>
              <i className='k-icon k-icon-caret-left'/>
              {t('Prev')}
            </React.Fragment>
          )}
          nextText={(
            <React.Fragment>
              {t('Next')}
              <i className='k-icon k-icon-caret-right'/>
            </React.Fragment>
          )}
          loadingText={<ui.LoadingSpinner/>}
          noDataText={t('Your filters returned no submissions.')}
          pageText={t('Page')}
          ofText={t('of')}
          rowsText={t('rows')}
          getTableProps={() => {
            return {
              onScroll: this.onTableScroll,
            };
          }}
          filterable
        />
      </bem.FormView>
    );
  }
}

reactMixin(DataTable.prototype, Reflux.ListenerMixin);
reactMixin(DataTable.prototype, mixins.permissions);

export default DataTable;

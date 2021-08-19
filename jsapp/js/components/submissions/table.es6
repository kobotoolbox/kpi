import React from 'react';
import autoBind from 'react-autobind';
import Reflux from 'reflux';
import reactMixin from 'react-mixin';
import enketoHandler from 'js/enketoHandler';
import Checkbox from 'js/components/common/checkbox';
import {actions} from 'js/actions';
import bem from 'js/bem';
import LoadingSpinner from 'js/components/common/loadingSpinner';
import {stores} from 'js/stores';
import mixins from 'js/mixins';
import ReactTable from 'react-table';
import ValidationStatusDropdown, { SHOW_ALL_OPTION } from 'js/components/submissions/validationStatusDropdown';
import {DebounceInput} from 'react-debounce-input';
import {
  PERMISSIONS_CODENAMES,
  VALIDATION_STATUSES,
  VALIDATION_STATUSES_LIST,
  MODAL_TYPES,
  QUESTION_TYPES,
  GROUP_TYPES_BEGIN,
  META_QUESTION_TYPES,
  ADDITIONAL_SUBMISSION_PROPS,
  NUMERICAL_SUBMISSION_PROPS,
  ENKETO_ACTIONS,
} from 'js/constants';
import {formatTimeDate} from 'utils';
import {
  renderQuestionTypeIcon,
  getQuestionOrChoiceDisplayName,
} from 'js/assetUtils';
import {getRepeatGroupAnswers} from 'js/components/submissions/submissionUtils';
import TableBulkOptions from 'js/components/submissions/tableBulkOptions';
import TableBulkCheckbox from 'js/components/submissions/tableBulkCheckbox';
import TableColumnSortDropdown from 'js/components/submissions/tableColumnSortDropdown';
import ColumnsHideDropdown from 'js/components/submissions/columnsHideDropdown';
import {
  SORT_VALUES,
  SUBMISSION_ACTIONS_ID,
  VALIDATION_STATUS_ID_PROP,
  DATA_TABLE_SETTING,
  DATA_TABLE_SETTINGS,
  TABLE_MEDIA_TYPES,
} from 'js/components/submissions/tableConstants';
import {
  getColumnLabel,
  getColumnHXLTags,
  getBackgroundAudioQuestionName,
} from 'js/components/submissions/tableUtils';
import tableStore from 'js/components/submissions/tableStore';
import './table.scss';
import MediaCell from './mediaCell';

const DEFAULT_PAGE_SIZE = 30;

/**
 * @prop {object} asset
 */
export class DataTable extends React.Component {
  constructor(props){
    super(props);
    this.state = {
      isInitialized: false, // for having asset with content
      loading: true, // for fetching submissions data
      submissions: [],
      columns: [],
      sids: [],
      isFullscreen: false,
      pageSize: 30,
      currentPage: 0,
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
    };

    this.unlisteners = [];

    // Store this value only to be able to check whether user is scrolling
    // horizontally or vertically.
    this.tableScrollTop = 0;
    autoBind(this);
  }

  componentDidMount() {
    this.unlisteners.push(
      tableStore.listen(this.onTableStoreChange),
      stores.pageState.listen(this.onPageStateUpdated),
      actions.resources.updateSubmissionValidationStatus.completed.listen(this.onSubmissionValidationStatusChange),
      actions.resources.removeSubmissionValidationStatus.completed.listen(this.onSubmissionValidationStatusChange),
      actions.table.updateSettings.completed.listen(this.onTableUpdateSettingsCompleted),
      actions.resources.deleteSubmission.completed.listen(this.refreshSubmissions),
      actions.resources.duplicateSubmission.completed.listen(this.onDuplicateSubmissionCompleted),
      actions.resources.refreshTableSubmissions.completed.listen(this.refreshSubmissions),
      actions.submissions.getSubmissions.completed.listen(this.onGetSubmissionsCompleted),
      actions.submissions.getSubmissions.failed.listen(this.onGetSubmissionsFailed),
      actions.submissions.bulkDeleteStatus.completed.listen(this.onBulkChangeCompleted),
      actions.submissions.bulkPatchStatus.completed.listen(this.onBulkChangeCompleted),
      actions.submissions.bulkPatchValues.completed.listen(this.onBulkChangeCompleted),
      actions.submissions.bulkDelete.completed.listen(this.onBulkChangeCompleted)
    );

    stores.allAssets.whenLoaded(this.props.asset.uid, this.whenLoaded);
  }

  componentWillUnmount() {
    this.unlisteners.forEach((clb) => {clb();});
  }

  /**
   * This triggers only when asset with `content` was loaded.
   */
  whenLoaded() {
    this.setState({isInitialized: true});
  }

  componentDidUpdate(prevProps) {
    let prevSettings = prevProps.asset.settings[DATA_TABLE_SETTING];
    if (!prevSettings) {
      prevSettings = {};
    }

    let newSettings = this.props.asset.settings[DATA_TABLE_SETTING];
    if (!newSettings) {
      newSettings = {};
    }

    // If sort setting changed, we definitely need to get new submissions (which
    // will rebuild columns)
    if (
      JSON.stringify(newSettings[DATA_TABLE_SETTINGS.SORT_BY]) !==
      JSON.stringify(prevSettings[DATA_TABLE_SETTINGS.SORT_BY])
    ) {
      this.refreshSubmissions();
    // If some other table settings changed, we need to fix columns using
    // existing data, as after `actions.table.updateSettings` resolves,
    // the props asset is not yet updated
    } else if (JSON.stringify(newSettings) !== JSON.stringify(prevSettings)) {
      this._prepColumns(this.state.submissions);
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

    const sortBy = tableStore.getSortBy();
    if (sortBy !== null) {
      sort.push({
        id: sortBy.fieldId,
        desc: sortBy.value === SORT_VALUES.DESCENDING,
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
        submissions: results,
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
        submissions: results,
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
   * @param {string} fieldId
   * @param {string|null} sortValue one of SORT_VALUES or null for clear value
   */
  onFieldSortChange(fieldId, sortValue) {
    tableStore.setSortBy(fieldId, sortValue);
  }

  /**
   * @param {string} fieldId
   */
  onHideField(fieldId) {
    tableStore.hideField(this.state.submissions, fieldId);
  }

  /**
   * @param {string} fieldId
   * @param {boolean} isFrozen
   */
  onFieldFrozenChange(fieldId, isFrozen) {
    tableStore.setFrozenColumn(fieldId, isFrozen);
  }

  /**
   * @param {number} maxPageRes
   * @returns {object} submission actions column for react-table
   */
  _getColumnSubmissionActions(maxPageRes) {
    let userCanSeeEditIcon = (
      this.props.asset.deployment__active &&
      (
        this.userCan(PERMISSIONS_CODENAMES.change_submissions, this.props.asset) ||
        this.userCanPartially(PERMISSIONS_CODENAMES.change_submissions, this.props.asset)
      )
    );

    let userCanSeeCheckbox = (
      this.userCan(PERMISSIONS_CODENAMES.validate_submissions, this.props.asset) ||
      this.userCan(PERMISSIONS_CODENAMES.delete_submissions, this.props.asset) ||
      this.userCan(PERMISSIONS_CODENAMES.change_submissions, this.props.asset) ||
      this.userCanPartially(PERMISSIONS_CODENAMES.validate_submissions, this.props.asset) ||
      this.userCanPartially(PERMISSIONS_CODENAMES.delete_submissions, this.props.asset) ||
      this.userCanPartially(PERMISSIONS_CODENAMES.change_submissions, this.props.asset)
    );

    if (
      this.userCan(PERMISSIONS_CODENAMES.validate_submissions, this.props.asset) ||
      this.userCan(PERMISSIONS_CODENAMES.delete_submissions, this.props.asset) ||
      this.userCan(PERMISSIONS_CODENAMES.change_submissions, this.props.asset) ||
      this.userCan(PERMISSIONS_CODENAMES.view_submissions, this.props.asset) ||
      this.userCanPartially(PERMISSIONS_CODENAMES.validate_submissions, this.props.asset) ||
      this.userCanPartially(PERMISSIONS_CODENAMES.delete_submissions, this.props.asset) ||
      this.userCanPartially(PERMISSIONS_CODENAMES.change_submissions, this.props.asset) ||
      this.userCanPartially(PERMISSIONS_CODENAMES.view_submissions, this.props.asset)
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

      let elClassNames = ['rt-sub-actions', 'is-frozen'];
      let frozenColumn = tableStore.getFrozenColumn();
      if (!frozenColumn) {
        elClassNames.push('is-last-frozen');
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
        headerClassName: elClassNames.join(' '),
        className: elClassNames.join(' '),
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
          } else {
            return null;
          }
        },
        Cell: (row) => (
          <div className='table-submission-actions'>
            {userCanSeeCheckbox &&
              <Checkbox
                checked={this.state.selectedRows[row.original._id] ? true : false}
                onChange={this.bulkUpdateChange.bind(this, row.original._id)}
                disabled={!(
                  (this.isSubmissionWritable('change_submissions', this.props.asset, row.original)) ||
                  (this.isSubmissionWritable('delete_submissions', this.props.asset, row.original)) ||
                  (this.isSubmissionWritable('validate_submissions', this.props.asset, row.original))
                )}
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

            {userCanSeeEditIcon && (this.isSubmissionWritable('change_submissions', this.props.asset, row.original)) &&
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
    const elClassNames = ['rt-status'];
    if (tableStore.getFieldSortValue(VALIDATION_STATUS_ID_PROP) !== null) {
      elClassNames.push('is-sorted');
    }

    return {
      Header: () => (
        <div className='column-header-wrapper'>
          <TableColumnSortDropdown
            asset={this.props.asset}
            fieldId={VALIDATION_STATUS_ID_PROP}
            sortValue={tableStore.getFieldSortValue(VALIDATION_STATUS_ID_PROP)}
            onSortChange={this.onFieldSortChange}
            onHide={this.onHideField}
            isFieldFrozen={tableStore.isFieldFrozen(VALIDATION_STATUS_ID_PROP)}
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
      className: elClassNames.join(' '),
      headerClassName: elClassNames.join(' '),
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
          isDisabled={!(this.isSubmissionWritable(PERMISSIONS_CODENAMES.validate_submissions, this.props.asset, row.original))}
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
    const allColumns = tableStore.getAllColumns(data);

    let showLabels = this.state.showLabels;
    let showGroupName = this.state.showGroupName;
    let showHXLTags = this.state.showHXLTags;
    let translationIndex = this.state.translationIndex;
    let maxPageRes = Math.min(this.state.pageSize, this.state.submissions.length);

    const tableSettings = tableStore.getTableSettings();

    if (tableSettings[DATA_TABLE_SETTINGS.TRANSLATION] !== undefined) {
      translationIndex = tableSettings[DATA_TABLE_SETTINGS.TRANSLATION];
      showLabels = translationIndex > -1;
    }

    if (tableSettings[DATA_TABLE_SETTINGS.SHOW_GROUP] !== undefined) {
      showGroupName = tableSettings[DATA_TABLE_SETTINGS.SHOW_GROUP];
    }

    if (tableSettings[DATA_TABLE_SETTINGS.SHOW_HXL] !== undefined) {
      showHXLTags = tableSettings[DATA_TABLE_SETTINGS.SHOW_HXL];
    }

    // define the columns array
    let columnsToRender = [];

    const columnSubmissionActions = this._getColumnSubmissionActions(maxPageRes);
    if (columnSubmissionActions) {
      columnsToRender.push(columnSubmissionActions);
    }

    const columnValidation = this._getColumnValidation();
    if (columnValidation) {
      columnsToRender.push(columnValidation);
    }

    let survey = this.props.asset.content.survey;
    let choices = this.props.asset.content.choices;
    allColumns.forEach((key) => {
      var q;
      if (key.includes('/')) {
        const qParentG = key.split('/');
        q = survey.find((o) => (
          o.name === qParentG[qParentG.length - 1] ||
          o.$autoname === qParentG[qParentG.length - 1]
        ));
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
      const backgroundAudioName = getBackgroundAudioQuestionName(this.props.asset);

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

      const elClassNames = [];
      if (this.cellDisplaysNumbers(q || key)) {
        elClassNames.push('rt-numerical-value');
      }

      if (tableStore.getFieldSortValue(key) !== null) {
        elClassNames.push('is-sorted');
      }

      let columnIcon = null;
      if (q && q.type) {
        columnIcon = renderQuestionTypeIcon(q.type);
      }

      columnsToRender.push({
        Header: () => {
          const columnName = getColumnLabel(
            this.props.asset.content.survey,
            key,
            this.state.showGroupName,
            this.state.translationIndex
          );
          const columnHXLTags = getColumnHXLTags(this.props.asset.content.survey, key);
          return (
            <div className='column-header-wrapper'>
              <TableColumnSortDropdown
                asset={this.props.asset}
                fieldId={key}
                sortValue={tableStore.getFieldSortValue(key)}
                onSortChange={this.onFieldSortChange}
                onHide={this.onHideField}
                isFieldFrozen={tableStore.isFieldFrozen(key)}
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
        className: elClassNames.join(' '),
        headerClassName: elClassNames.join(' '),
        Cell: (row) => {
          if (showLabels && q && q.type && row.value) {
            if (Object.keys(TABLE_MEDIA_TYPES).includes(q.type)) {
              let mediaAttachment = null;

              if (q.type !== QUESTION_TYPES.text.id) {
                mediaAttachment = this.getMediaAttachment(row, row.value);
              }

              return (
                <MediaCell
                  questionType={q.type}
                  mediaAttachment={mediaAttachment}
                  mediaName={row.value}
                  submissionIndex={row.index + 1}
                  submissionTotal={this.state.submissions.length}
                />
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

    columnsToRender.sort((columnA, columnB) => {
      return columnA.index.localeCompare(columnB.index, 'en', {numeric: true});
    });

    let frozenColumn = tableStore.getFrozenColumn();
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

    columnsToRender.forEach(function (col) {
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
    const selectedColumnsIds = tableStore.getSelectedColumns();
    if (selectedColumnsIds) {
      // always include frozenColumn, if set
      if (frozenColumn && !selectedColumnsIds.includes(frozenColumn)) {
        selectedColumnsIds.unshift(frozenColumn);
      }

      columnsToRender = columnsToRender.filter((el) => {
        // always include checkbox column
        if (el.id === SUBMISSION_ACTIONS_ID) {
          return true;
        }
        return selectedColumnsIds.includes(el.id) !== false;
      });
    }

    this.setState({
      columns: columnsToRender,
      translationIndex: translationIndex,
      showLabels: showLabels,
      showGroupName: showGroupName,
      showHXLTags: showHXLTags,
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
      var subIndex = this.state.submissions.findIndex((x) => x._id === parseInt(sid));
      if (typeof subIndex !== 'undefined' && this.state.submissions[subIndex]) {
        var newData = this.state.submissions;
        newData[subIndex]._validation_status = result || {};
        this.setState({submissions: newData});
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
    this.submissionModalProcessing(sid, this.state.submissions, true, duplicatedSubmission);
  }

  onTableStoreChange(prevData, newData) {
    // Close table settings modal after settings are saved.
    stores.pageState.hideModal();

    // If sort setting changed, we definitely need to get new submissions (which
    // will rebuild columns)
    if (
      JSON.stringify(prevData.overrides[DATA_TABLE_SETTINGS.SORT_BY]) !==
      JSON.stringify(newData.overrides[DATA_TABLE_SETTINGS.SORT_BY])
    ) {
      this.refreshSubmissions();
    // If some other table settings changed, we need to fix columns using
    // existing data, as after `actions.table.updateSettings` resolves,
    // the props asset is not yet updated
    } else if (
      JSON.stringify(prevData.overrides[DATA_TABLE_SETTING]) !==
      JSON.stringify(newData.overrides[DATA_TABLE_SETTING])
    ) {
      this._prepColumns(this.state.submissions);
    }
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
   * Opens submission modal
   * @param {object} row
   */
  launchSubmissionModal(row) {
    if (row && row.original) {
      const sid = row.original._id;
      const backgroundAudioName = getBackgroundAudioQuestionName(this.props.asset);
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
          this.state.submissions,
          false,
          null,
          backgroundAudioUrl,
        );
      } else {
        this.submissionModalProcessing(sid, this.state.submissions);
      }
    }
  }

  /**
   * Opens (or updates data in an opened) submission modal
   *
   * @param {string} sid
   * @param {object[]} submissions
   * @param {boolean} isDuplicated
   * @param {object} duplicatedSubmission
   * @param {string} backgroundAudioUrl
   */
  submissionModalProcessing(
    sid,
    submissions,
    isDuplicated = false,
    duplicatedSubmission = null,
    backgroundAudioUrl = null,
  ) {
    let ids = [];

    submissions.forEach(function (r) {
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
    this.state.submissions.forEach(function (r) {
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
    this.state.submissions.forEach(function (r) {
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
    if (!this.state.submissions.length) {
      return false;
    }

    return (
      <bem.TableMeta>
        <TableBulkOptions
          asset={this.props.asset}
          data={this.state.submissions}
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
  getMediaAttachment(row, fileName) {
    const fileNameNoSpaces = fileName.replace(/ /g, '_');
    let mediaAttachment = t('Could not find ##fileName##').replace(
      '##fileName##',
      fileName,
    );

    row.original._attachments.forEach((attachment) => {
      if (attachment.filename.includes(fileNameNoSpaces)) {
        mediaAttachment = attachment;
      }
    });

    return mediaAttachment;
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

  cellDisplaysNumbers(questionOrKey) {
    let questionType = questionOrKey;
    if (questionOrKey.type) {
      questionType = questionOrKey.type;
    }

    return (
      NUMERICAL_SUBMISSION_PROPS[questionType] ||
      Object.keys(TABLE_MEDIA_TYPES).includes(questionType)
    );
  }

  render() {
    if (this.state.error) {
      return (
        <bem.uiPanel>
          <bem.uiPanel__body>
            <bem.Loading>
              <bem.Loading__inner>
                {this.state.error}
              </bem.Loading__inner>
            </bem.Loading>
          </bem.uiPanel__body>
        </bem.uiPanel>
      );
    }

    if (!this.state.isInitialized) {
      return (<LoadingSpinner/>);
    }

    const pages = Math.floor(((this.state.resultsTotal - 1) / this.state.pageSize) + 1);

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
          {this.userCan(PERMISSIONS_CODENAMES.change_asset, this.props.asset) &&
            <ColumnsHideDropdown
              asset={this.props.asset}
              submissions={this.state.submissions}
              showGroupName={this.state.showGroupName}
              translationIndex={this.state.translationIndex}
            />
          }

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
          data={this.state.submissions}
          columns={this.state.columns}
          defaultPageSize={DEFAULT_PAGE_SIZE}
          pageSizeOptions={[10, 30, 50, 100, 200, 500]}
          minRows={0}
          className={tableClasses.join(' ')}
          pages={pages}
          manual
          onFetchData={this.fetchData}
          loading={this.state.loading}
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
          loadingText={<LoadingSpinner/>}
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

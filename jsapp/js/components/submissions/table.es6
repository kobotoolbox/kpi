import React from 'react';
import autoBind from 'react-autobind';
import Reflux from 'reflux';
import reactMixin from 'react-mixin';
import _ from 'underscore';
import enketoHandler from 'js/enketoHandler';
import {dataInterface} from 'js/dataInterface';
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
} from 'js/constants';
import {formatTimeDate} from 'utils';
import {
  renderQuestionTypeIcon,
  getSurveyFlatPaths,
  getQuestionOrChoiceDisplayName,
} from 'js/assetUtils';
import {getRepeatGroupAnswers} from 'js/components/submissions/submissionUtils';
import TableBulkOptions from './tableBulkOptions';
import TableBulkCheckbox from './tableBulkCheckbox';

// Columns that will be ALWAYS excluded from the view
const EXCLUDED_COLUMNS = [
  '_xform_id_string',
  '_attachments',
  '_notes',
  '_bamboo_dataset_id',
  // '_status' is always 'submitted_via_web' unless submitted in bulk;
  // in that case, it's 'zip'
  '_status',
  'formhub/uuid',
  '_tags',
  '_geolocation',
  'meta/instanceID',
  'meta/deprecatedID',
  '_validation_status',
];

export const SUBMISSION_ACTIONS_ID = '__SubmissionActions';

export const TABLE_MEDIA_TYPES = [
  QUESTION_TYPES.image.id,
  QUESTION_TYPES.audio.id,
  QUESTION_TYPES.video.id,
  META_QUESTION_TYPES['background-audio'],
];

export class DataTable extends React.Component {
  constructor(props){
    super(props);
    this.state = {
      loading: true,
      tableData: [],
      columns: [],
      selectedColumns: false,
      frozenColumn: false,
      sids: [],
      isFullscreen: false,
      defaultPageSize: 30,
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
      overrideLabelsAndGroups: null,
    };

    this.tableScrollTop = 0;
    autoBind(this);
  }
  requestData(instance) {
    let pageSize = instance.state.pageSize;
    let page = instance.state.page * instance.state.pageSize;
    let sort = instance.state.sorted;
    let filter = instance.state.filtered;
    let filterQuery = '';

    if (filter.length) {
      filterQuery = '&query={';
      filter.forEach(function (f, i) {
        if (f.id === '_id') {
          filterQuery += `"${f.id}":{"$in":[${f.value}]}`;
        } else if (f.id === '_validation_status.uid') {
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

    dataInterface.getSubmissions(this.props.asset.uid, pageSize, page, sort, [], filterQuery).done((data) => {
      let results = data.results;

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
          resultsTotal: data.count,
        });
        this._prepColumns(results);
      } else if (filterQuery.length) {
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
    }).fail((error) => {
      if (error.responseText) {
        this.setState({error: error.responseText, loading: false});
      } else if (error.statusText) {
        this.setState({error: error.statusText, loading: false});
      } else {
        this.setState({error: t('Error: could not load data.'), loading: false});
      }
    });
  }
  getValidationStatusOption(originalRow) {
    if (originalRow._validation_status && originalRow._validation_status.uid) {
      return VALIDATION_STATUSES[originalRow._validation_status.uid];
    } else {
      return VALIDATION_STATUSES.no_status;
    }
  }
  onValidationStatusChange(sid, index, evt) {
    const _this = this;

    if (evt.value === null) {
      dataInterface.removeSubmissionValidationStatus(_this.props.asset.uid, sid).done(() => {
        _this.state.tableData[index]._validation_status = {};
        _this.setState({tableData: _this.state.tableData});
      }).fail(console.error);
    } else {
      dataInterface.updateSubmissionValidationStatus(_this.props.asset.uid, sid, {'validation_status.uid': evt.value}).done((result) => {
        if (result.uid) {
          _this.state.tableData[index]._validation_status = result;
          _this.setState({tableData: _this.state.tableData});
        } else {
          console.error('error updating validation status');
        }
      }).fail(console.error);
    }
  }

  // returns a unique list of columns (keys) that should be displayed to users
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
   */
  _getColumnSubmissionActions(maxPageRes) {
    let userCanSeeEditIcon = (
      this.props.asset.deployment__active &&
      this.userCan('change_submissions', this.props.asset)
    );

    if (
      this.userCan('validate_submissions', this.props.asset) ||
      this.userCan('delete_submissions', this.props.asset) ||
      this.userCan('change_submissions', this.props.asset)
    ) {
      const res1 = (this.state.resultsTotal === 0) ? 0 : (this.state.currentPage * this.state.pageSize) + 1;
      const res2 = Math.min((this.state.currentPage + 1) * this.state.pageSize, this.state.resultsTotal);

      // To accommodate the checkbox and icon buttons.
      let columnWidth = 100;
      if (this.state.resultsTotal >= 100000) {
        // Whenever there are more results we need a bit more space for
        // the "X results" text.
        columnWidth += 20;
      }

      return {
        Header: () => (
          <div>
            <div className='table-header-results'>
              {res1} - {res2}
              <br/>
              <strong>{this.state.resultsTotal} {t('results')}</strong>
            </div>

            <TableBulkCheckbox
              visibleRowsCount={maxPageRes}
              selectedRowsCount={Object.keys(this.state.selectedRows).length}
              totalRowsCount={this.state.resultsTotal}
              onSelectAllPages={this.bulkSelectAll}
              onSelectCurrentPage={this.bulkSelectAllRows.bind(this, true)}
              onClearSelection={this.bulkClearSelection}
            />
          </div>
        ),
        accessor: 'sub-actions',
        index: '__0',
        id: SUBMISSION_ACTIONS_ID,
        width: columnWidth,
        filterable: false,
        sortable: false,
        resizable: false,
        headerClassName: 'table-submission-actions-header',
        className: 'rt-sub-actions',
        Cell: (row) => (
          <div className='table-submission-actions'>
            <Checkbox
              checked={this.state.selectedRows[row.original._id] ? true : false}
              onChange={this.bulkUpdateChange.bind(this, row.original._id)}
            />

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

  _getColumnValidation() {
    return {
      Header: () => (
        <span className='column-header-title'>
          {t('Validation status')}
        </span>
      ),
      accessor: '_validation_status.uid',
      index: '__2',
      id: '_validation_status.uid',
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
   * Prepares data for react table
   * @param {object} data
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

    if (settings['data-table'] && settings['data-table']['translation-index'] !== null) {
      translationIndex = settings['data-table']['translation-index'];
      showLabels = translationIndex > -1 ? true : false;
    }

    if (settings['data-table'] && settings['data-table']['show-group-name'] !== null) {
      showGroupName = settings['data-table']['show-group-name'];
    }

    if (settings['data-table'] && settings['data-table']['show-hxl-tags'] !== null) {
      showHXLTags = settings['data-table']['show-hxl-tags'];
    }

    // check for overrides by users with view permissions only
    // see tableColumnFilter.es6's saveTableColumns()
    if (this.state.overrideLabelsAndGroups !== null) {
      showGroupName = this.state.overrideLabelsAndGroups.showGroupName;
      translationIndex = this.state.overrideLabelsAndGroups.translationIndex;
      showLabels = translationIndex > -1 ? true : false;
    }

    // define the columns array
    const columns = [
      this._getColumnSubmissionActions(maxPageRes),
      this._getColumnValidation(),
    ];

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

      let columnClassName = '';
      if (this.cellDisplaysNumbers(q || key)) {
        columnClassName += 'rt-numerical-value';
      }

      let columnIcon = null;
      if (q && q.type) {
        columnIcon = renderQuestionTypeIcon(q.type);
      }

      columns.push({
        Header: () => {
          const columnName = _this.getColumnLabel(key, q, qParentG);
          const columnHXLTags = _this.getColumnHXLTags(key);
          return (
            <React.Fragment>
              <span className='column-header-title' title={columnName}>
                {columnIcon}
                {columnName}
              </span>
              {this.state.showHXLTags && columnHXLTags &&
                <span className='column-header-hxl-tags' title={columnHXLTags}>{columnHXLTags}</span>
              }
            </React.Fragment>
          );
        },
        id: key,
        accessor: (row) => row[key],
        index: index,
        question: q,
        filterable: false,
        className: columnClassName,
        Cell: (row) => {
          if (showLabels && q && q.type && row.value) {
            if (TABLE_MEDIA_TYPES.includes(q.type)) {
              var mediaURL = this.getMediaDownloadLink(row, row.value);
              return this.renderMediaCell(q.type, mediaURL, row.value);
            }
            // show proper labels for choice questions
            if (q.type === QUESTION_TYPES.select_one.id) {
              let choice = choices.find((o) =>
                o.list_name === q.select_from_list_name &&
                (o.name === row.value || o.$autoname === row.value)
              );
              if (choice?.label && choice.label[translationIndex]) {
                return choice.label[translationIndex];
              } else {
                return row.value;
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

              return labels.join(', ');
            }
            if (
              q.type === META_QUESTION_TYPES.start ||
              q.type === META_QUESTION_TYPES.end ||
              q.type === ADDITIONAL_SUBMISSION_PROPS._submission_time
            ) {
              return formatTimeDate(row.value);
            }
          }
          if (typeof(row.value) === 'object' || row.value === undefined) {
            const repeatGroupAnswers = getRepeatGroupAnswers(row.original, key);

            if (repeatGroupAnswers) {
              // display a list of answers from a repeat group question
              return repeatGroupAnswers.join(', ');
            } else {
              return '';
            }
          } else {
            return row.value;
          }
        },
      });

    });

    columns.sort(function (a, b) {
      return a.index.localeCompare(b.index, 'en', {numeric: true});
    });

    let selectedColumns = false;
    let frozenColumn = false;
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

    if (settings['data-table'] && settings['data-table']['frozen-column']) {
      frozenColumn = settings['data-table']['frozen-column'];
    }

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
        col.className = col.className ? `frozen ${col.className}` : 'frozen';
        col.headerClassName = 'frozen';
      }
    });

    // prepare list of selected columns, if configured
    if (settings['data-table'] && settings['data-table']['selected-columns']) {
      const selCos = settings['data-table']['selected-columns'];

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
      frozenColumn: frozenColumn,
      translationIndex: translationIndex,
      showLabels: showLabels,
      showGroupName: showGroupName,
      showHXLTags: showHXLTags,
    });
  }
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
  getColumnLabel(key, q, qParentG, stateOverrides = false) {
    switch(key) {
      case SUBMISSION_ACTIONS_ID:
        return (
          <span className='column-header-title'>
            {t('Multi-select checkboxes column')}
          </span>
        );
      case '_validation_status.uid':
        return (
          <span className='column-header-title'>
            {t('Validation status')}
          </span>
        );
    }

    var label = key;
    let showLabels = this.state.showLabels;
    let showGroupName = this.state.showGroupName;
    let translationIndex = this.state.translationIndex;
    let survey = this.props.asset.content.survey;

    if (stateOverrides) {
      showGroupName = stateOverrides.showGroupName;
      translationIndex = stateOverrides.translationIndex;
    }

    if (key.includes('/')) {
      var splitK = key.split('/');
      label = splitK[splitK.length - 1];
    }
    if (q && q.label && showLabels && q.label[translationIndex]) {
      label = q.label[translationIndex];
    }
    // show Groups in labels, when selected
    if (showGroupName && qParentG && key.includes('/')) {
      var gLabels = qParentG.join(' / ');

      if (showLabels) {
        var gT = qParentG.map(function (g) {
          var x = survey.find((o) => o.name === g || o.$autoname === g);
          if (x && x.label && x.label[translationIndex]) {
            return x.label[translationIndex];
          }

          return g;
        });
        gLabels = gT.join(' / ');
      }
      return gLabels;
    }

    return label;
  }
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

  componentDidMount() {
    this.listenTo(actions.resources.updateSubmissionValidationStatus.completed, this.refreshSubmissionValidationStatus);
    this.listenTo(actions.resources.removeSubmissionValidationStatus.completed, this.refreshSubmissionValidationStatus);
    this.listenTo(actions.table.updateSettings.completed, this.onTableUpdateSettingsCompleted);
    this.listenTo(stores.pageState, this.onPageStateUpdated);
    this.listenTo(actions.resources.deleteSubmission.completed, this.refreshSubmissions);
    this.listenTo(actions.resources.duplicateSubmission.completed, this.refreshSubmissionModal);
    this.listenTo(actions.resources.refreshTableSubmissions, this.refreshSubmissions);
    actions.submissions.bulkDeleteStatus.completed.listen(this.onBulkChangeCompleted);
    actions.submissions.bulkPatchStatus.completed.listen(this.onBulkChangeCompleted);
    actions.submissions.bulkPatchValues.completed.listen(this.onBulkChangeCompleted);
    actions.submissions.bulkDelete.completed.listen(this.onBulkChangeCompleted);
  }

  refreshSubmissionValidationStatus(result, sid) {
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
    this.requestData(this.state.fetchInstance);
  }
  refreshSubmissionModal(uid, sid, duplicatedSubmission) {
    this.requestData(this.state.fetchInstance);
    this.submissionModalProcessing(sid, this.state.tableData, true, duplicatedSubmission);
  }
  onTableUpdateSettingsCompleted() {
    stores.pageState.hideModal();
    this._prepColumns(this.state.tableData);
  }
  fetchData(state, instance) {
    this.setState({
      loading: true,
      pageSize: instance.state.pageSize,
      currentPage: instance.state.page,
      fetchState: state,
      fetchInstance: instance,
    });
    this.requestData(instance);
  }
  // TODO: if multiple background-audio's are allowed, we should return all
  //       background-audio related names
  getBackgroundAudioQuestionName() {
    return this.props?.asset?.content?.survey.find(
      (item) => item.type === META_QUESTION_TYPES['background-audio']
    )?.name || null;
  }
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
      type: MODAL_TYPES.TABLE_COLUMNS,
      asset: this.props.asset,
      columns: this.state.columns,
      getColumnLabel: this.getColumnLabel,
      overrideLabelsAndGroups: this.overrideLabelsAndGroups,
    });
  }
  launchEditSubmission(evt) {
    enketoHandler.editSubmission(this.props.asset.uid, evt.currentTarget.dataset.sid);
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

    if (params.type !== MODAL_TYPES.TABLE_COLUMNS && !params.sid) {
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

  bulkSelectUI() {
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
  cellDisplaysNumbers(questionOrKey) {
    let questionType = questionOrKey;
    if (questionOrKey.type) {
      questionType = questionOrKey.type;
    }

    return (
      NUMERICAL_SUBMISSION_PROPS[questionType] ||
      TABLE_MEDIA_TYPES.includes(questionType)
    );
  }
  launchMediaModal(questionType, questionIcon, mediaURL, mediaName) {
    stores.pageState.showModal({
      type: MODAL_TYPES.TABLE_MEDIA_PREVIEW,
      questionType: questionType,
      mediaURL: mediaURL,
      mediaName: mediaName,
      customModalHeader: this.renderMediaModalCustomHeader(
        questionIcon,
        mediaURL,
        mediaName
      ),
    });
  }
  renderMediaModalCustomHeader(questionIcon, mediaURL, mediaName) {
    return (
      <bem.TableMediaPreviewHeader>
        <bem.TableMediaPreviewHeader__title>
          <i className={questionIcon.join(' ')}/>
          <bem.TableMediaPreviewHeader__label>
            {mediaName}
          </bem.TableMediaPreviewHeader__label>
        </bem.TableMediaPreviewHeader__title>

        {/*TODO this doesn't start a `save as` but instead opens media in tab*/}
        <a
          className='kobo-light-button kobo-light-button--blue'
          href={mediaURL}
          download=''
        >
          {t('download')}
          <i className='k-icon k-icon-download'/>
        </a>
      </bem.TableMediaPreviewHeader>
    );
  }
  renderMediaCell(questionType, mediaURL, mediaName) {
    const iconClassNames = ['k-icon'];
    // TODO: figure out duration stuff, right now just show a time
    // let playableMedia = new Audio(mediaURL);
    const tempTime = '01:23:45';

    // Different from renderQuestionTypeIcon as we need custom `title` and
    // event handling
    switch (questionType) {
      case QUESTION_TYPES.image.id:
        iconClassNames.push('k-icon-qt-photo');
        break;
      case QUESTION_TYPES.audio.id:
      case META_QUESTION_TYPES['background-audio']:
        iconClassNames.push('k-icon-qt-audio');
        break;
      case QUESTION_TYPES.video.id:
        iconClassNames.push('k-icon-qt-video');
        break;
      default:
        iconClassNames.push('k-icon-media-files');
        break;
    }

    return (
      <bem.MediaCell>
        <bem.MediaCell__icon
          className={iconClassNames}
          title={mediaName}
          onClick={() =>
            this.launchMediaModal(questionType, iconClassNames, mediaURL, mediaName)
          }
        />

        {!(questionType === QUESTION_TYPES.image.id) &&
          <bem.MediaCell__duration>
            {tempTime}
          </bem.MediaCell__duration>
        }
      </bem.MediaCell>
    );
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

    const { tableData, columns, selectedColumns, defaultPageSize, loading, pageSize, resultsTotal } = this.state;
    const pages = Math.floor(((resultsTotal - 1) / pageSize) + 1);

    let tableClasses = ['-highlight'];
    if (this.state.frozenColumn) {
      tableClasses.push('has-frozen-column');
    }
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
          {this.bulkSelectUI()}
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
          defaultPageSize={defaultPageSize}
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
              onScroll: (e) => {
                if (this.state.frozenColumn) {
                  if (this.tableScrollTop === e.target.scrollTop) {
                    let left = e.target.scrollLeft > 0 ? e.target.scrollLeft : 0;
                    $('.ReactTable .rt-tr .frozen').css({left: left});
                  } else {
                    this.tableScrollTop = e.target.scrollTop;
                  }
                }
              },
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

import './table.scss'

import React from 'react'

import clonedeep from 'lodash.clonedeep'
import isEqual from 'lodash.isequal'
import { DebounceInput } from 'react-debounce-input'
import Markdown from 'react-markdown'
import ReactTable from 'react-table'
import type { CellInfo } from 'react-table'
import { actions } from '#/actions'
import { handleApiFail } from '#/api'
import type { SurveyFlatPaths } from '#/assetUtils'
import { getQuestionOrChoiceDisplayName, getRowName, getSurveyFlatPaths, renderQuestionTypeIcon } from '#/assetUtils'
import bem from '#/bem'
import Button from '#/components/common/button'
import CenteredMessage from '#/components/common/centeredMessage.component'
import Checkbox from '#/components/common/checkbox'
import LoadingSpinner from '#/components/common/loadingSpinner'
import { PERMISSIONS_CODENAMES } from '#/components/permissions/permConstants'
import { userCan, userCanPartially, userHasPermForSubmission } from '#/components/permissions/utils'
import ColumnsHideDropdown from '#/components/submissions/columnsHideDropdown'
import { getMediaAttachment, getSupplementalDetailsContent } from '#/components/submissions/submissionUtils'
import type {
  DataTableSelectedRows,
  ReactTableInstance,
  ReactTableState,
  SubmissionPageName,
  TableColumn,
} from '#/components/submissions/table.types'
import TableBulkCheckbox from '#/components/submissions/tableBulkCheckbox'
import TableBulkOptions from '#/components/submissions/tableBulkOptions'
import TableColumnSortDropdown from '#/components/submissions/tableColumnSortDropdown'
import {
  CELLS_WIDTH_OVERRIDES,
  DATA_TABLE_SETTING,
  DATA_TABLE_SETTINGS,
  DEFAULT_DATA_CELL_WIDTH,
  SUBMISSION_ACTIONS_ID,
  SortValues,
  TABLE_MEDIA_TYPES,
  VALIDATION_STATUS_ID_PROP,
} from '#/components/submissions/tableConstants'
import tableStore from '#/components/submissions/tableStore'
import type { TableStoreData } from '#/components/submissions/tableStore'
import {
  buildFilterQuery,
  getBackgroundAudioQuestionName,
  getColumnHXLTags,
  getColumnLabel,
  isTableColumnFilterableByDropdown,
  isTableColumnFilterableByTextInput,
} from '#/components/submissions/tableUtils'
import TextModalCell from '#/components/submissions/textModalCell.component'
import type {
  ValidationStatusOption,
  ValidationStatusOptionName,
} from '#/components/submissions/validationStatus.constants'
import {
  VALIDATION_STATUS_NO_OPTION,
  VALIDATION_STATUS_OPTIONS,
  VALIDATION_STATUS_SHOW_ALL_OPTION,
  ValidationStatusAdditionalName,
} from '#/components/submissions/validationStatus.constants'
import ValidationStatusDropdown from '#/components/submissions/validationStatusDropdown'
import {
  ADDITIONAL_SUBMISSION_PROPS,
  EnketoActions,
  GROUP_TYPES_BEGIN,
  META_QUESTION_TYPES,
  MODAL_TYPES,
  QUESTION_TYPES,
  SUPPLEMENTAL_DETAILS_PROP,
} from '#/constants'
import type { AnyRowTypeName } from '#/constants'
import type {
  AssetResponse,
  AssetTableSettings,
  FailResponse,
  GetSubmissionsOptions,
  PaginatedResponse,
  SubmissionAttachment,
  SubmissionResponse,
  SurveyChoice,
  SurveyRow,
  ValidationStatusResponse,
} from '#/dataInterface'
import enketoHandler from '#/enketoHandler'
import envStore from '#/envStore'
import pageState from '#/pageState.store'
import type { PageStateStoreState } from '#/pageState.store'
import { stores } from '#/stores'
import { formatTimeDateShort } from '#/utils'
import LimitNotifications from '../usageLimits/limitNotifications.component'
import RepeatGroupCell from './RepeatGroupCell'
import AudioCell from './audioCell'
import MediaCell from './mediaCell'

const DEFAULT_PAGE_SIZE = 30

interface DataTableProps {
  asset: AssetResponse
}

interface DataTableState {
  isInitialized: boolean
  loading: boolean
  submissions: SubmissionResponse[]
  columns: any[]
  isFullscreen: boolean
  pageSize: number
  currentPage: number
  error: string | boolean
  errorNumber: number | null
  errorStatus: string | null
  showLabels: boolean
  translationIndex: number
  showGroupName: boolean
  showHXLTags: boolean
  resultsTotal: number
  /** A list of rows that are selected. */
  selectedRows: DataTableSelectedRows
  selectAll: boolean
  submissionPager?: SubmissionPageName
  /** state of react-table table */
  fetchState?: ReactTableState
  /** instance data of react-table table */
  fetchInstance?: ReactTableInstance
  lastChecked: string | null
  shiftSelection: DataTableSelectedRows
}

/**
 * @prop {object} asset
 */
export class DataTable extends React.Component<DataTableProps, DataTableState> {
  /**
   * Store this value only to be able to check whether user is scrolling
   * horizontally or vertically.
   */
  tableScrollTop = 0
  /**
   * Store this value of the 'left' value of frozen columns, maintaining
   * their alignment during horizontal scrolling or pagination.
   */
  frozenLeftRef = 0

  /** We store it for future checks. */
  previousOverrides: AssetTableSettings = {}

  private unlisteners: Function[] = []

  constructor(props: DataTableProps) {
    super(props)
    this.state = {
      isInitialized: false, // for having asset with content
      loading: true, // for fetching submissions data
      submissions: [],
      columns: [],
      isFullscreen: false,
      pageSize: 30,
      currentPage: 0,
      error: false,
      errorNumber: null,
      errorStatus: null,
      showLabels: true,
      translationIndex: 0,
      showGroupName: true,
      showHXLTags: false,
      resultsTotal: 0,
      selectedRows: {},
      selectAll: false,
      submissionPager: undefined,
      lastChecked: null,
      shiftSelection: {},
    }
  }

  componentDidMount() {
    this.unlisteners.push(
      tableStore.listen(this.onTableStoreChange.bind(this), this),
      pageState.listen(this.onPageStateUpdated.bind(this), this),
      actions.resources.updateSubmissionValidationStatus.completed.listen(
        this.onSubmissionValidationStatusChange.bind(this),
      ),
      actions.resources.removeSubmissionValidationStatus.completed.listen(
        this.onSubmissionValidationStatusChange.bind(this),
      ),
      actions.table.updateSettings.completed.listen(this.onTableUpdateSettingsCompleted.bind(this)),
      actions.resources.deleteSubmission.completed.listen(this.refreshSubmissions.bind(this)),
      actions.resources.duplicateSubmission.completed.listen(this.onDuplicateSubmissionCompleted.bind(this)),
      // Note: this action is not async, so we don't need to listen for `completed`
      actions.resources.refreshTableSubmissions.listen(this.refreshSubmissions.bind(this)),
      actions.submissions.getSubmissions.completed.listen(this.onGetSubmissionsCompleted.bind(this)),
      actions.submissions.getSubmissions.failed.listen(this.onGetSubmissionsFailed.bind(this)),
      actions.submissions.bulkDeleteStatus.completed.listen(this.onBulkChangeCompleted.bind(this)),
      actions.submissions.bulkPatchStatus.completed.listen(this.onBulkChangeCompleted.bind(this)),
      actions.submissions.bulkPatchValues.completed.listen(this.onBulkChangeCompleted.bind(this)),
      actions.submissions.bulkDelete.completed.listen(this.onBulkChangeCompleted.bind(this)),
    )

    // TODO: why this line is needed? Why not use `assetStore`?
    stores.allAssets.whenLoaded(this.props.asset.uid, this.whenLoaded.bind(this))
  }

  componentWillUnmount() {
    this.unlisteners.forEach((clb) => {
      clb()
    })
  }

  /**
   * This triggers only when asset with `content` was loaded.
   */
  whenLoaded() {
    this.setState({ isInitialized: true })
  }

  componentDidUpdate(prevProps: DataTableProps) {
    let prevSettings = prevProps.asset.settings[DATA_TABLE_SETTING]
    if (!prevSettings) {
      prevSettings = {}
    }

    let newSettings = this.props.asset.settings[DATA_TABLE_SETTING]
    if (!newSettings) {
      newSettings = {}
    }

    const prevAdditionalFields = prevProps.asset?.analysis_form_json?.additional_fields
    const newAdditionalFields = this.props.asset?.analysis_form_json?.additional_fields

    // If sort setting changed, we definitely need to get new submissions (which
    // will rebuild columns)
    if (
      JSON.stringify(newSettings[DATA_TABLE_SETTINGS.SORT_BY]) !==
      JSON.stringify(prevSettings[DATA_TABLE_SETTINGS.SORT_BY])
    ) {
      this.refreshSubmissions()
    } else if (JSON.stringify(newSettings) !== JSON.stringify(prevSettings)) {
      // If some other table settings changed, we need to fix columns using
      // existing data, as after `actions.table.updateSettings` resolves,
      // the props asset is not yet updated
      this._prepColumns(this.state.submissions)
    } else if (!isEqual(prevAdditionalFields, newAdditionalFields)) {
      // If additional fields have changed, it means that user has added
      // transcript or translations, thus we need to display more columns.
      this._prepColumns(this.state.submissions)
    }
  }

  /**
   * Makes call to endpoint to get new submissions data
   */
  fetchSubmissions(instance: ReactTableInstance) {
    const pageSize = instance.state.pageSize
    const page = instance.state.page * instance.state.pageSize
    const filter = instance.state.filtered
    let filterQueryString = ''
    // sort comes from outside react-table
    const sort = []

    if (filter.length && this.props.asset.content?.survey) {
      const filterQuery = buildFilterQuery(this.props.asset.content?.survey, instance.state.filtered)
      if (filterQuery.queryString) {
        filterQueryString = `&query=${filterQuery.queryString}`
      }
    }

    const sortBy = tableStore.getSortBy()
    if (sortBy !== null) {
      sort.push({
        id: sortBy.fieldId,
        desc: sortBy.value === SortValues.DESCENDING,
      })
    }

    actions.submissions.getSubmissions({
      uid: this.props.asset.uid,
      pageSize: pageSize,
      page: page,
      sort: sort,
      fields: [],
      filter: filterQueryString,
    })
  }

  onGetSubmissionsCompleted(
    response: PaginatedResponse<SubmissionResponse>,
    /** The parameters that the call was made with. */
    options: GetSubmissionsOptions,
  ) {
    const results = response.results
    if (results && results.length > 0) {
      if (this.state.submissionPager === 'next') {
        this.submissionModalProcessing(String(results[0]._id), results)
      }
      if (this.state.submissionPager === 'prev') {
        this.submissionModalProcessing(String(results[results.length - 1]._id), results)
      }
      this.setState(
        {
          loading: false,
          selectedRows: {},
          selectAll: false,
          submissions: results,
          submissionPager: undefined,
          resultsTotal: response.count,
        },
        () => {
          this._prepColumns(results)
        },
      )
    } else if (options.filter?.length) {
      // if there are no results, but there is some filtering applied, we don't
      // want to display the "no data" message
      this.setState({
        loading: false,
        selectedRows: {},
        submissions: results,
        resultsTotal: 0,
      })
    } else {
      this.setState({
        error: t('This project has no submitted data. Please collect some and try again.'),
        loading: false,
      })
    }
  }

  // The table view needs to handle the following errors differently:
  // - 500 response from the backend will give a raw html response, so we display something else instead
  // - non-500 response which contains some "detail" attribute after parsing the JSON response text, so we pluck it out
  onGetSubmissionsFailed(error: FailResponse) {
    if (error?.status) {
      this.setState({ errorNumber: error.status })

      if (error.status === 500 && error?.responseText) {
        handleApiFail(error)
      }

      // If the error is not a 500 we parse the response and pluck out the "detail" to display
      if (error.status !== 500 && error?.responseText) {
        let displayedError

        try {
          displayedError = JSON.parse(error.responseText)
        } catch {
          displayedError = error.responseText
        }

        if (displayedError.detail) {
          this.setState({ error: displayedError.detail, loading: false })
        } else {
          this.setState({ error: displayedError, loading: false })
        }
      } else if (error.status !== 500 && !error?.responseText) {
        this.setState({ error: t('Error: could not load data.'), loading: false })
      }
    }

    if (error?.statusText) {
      this.setState({ errorStatus: error.statusText })
    }
  }

  /**
   * @param {object} originalRow
   * @returns {object} one of ValidationStatusOption
   */
  getCurrentValidationStatusOption(originalRow: SubmissionResponse): ValidationStatusOption {
    const foundOption = VALIDATION_STATUS_OPTIONS.find(
      (option) => 'uid' in originalRow._validation_status && option.value === originalRow._validation_status.uid,
    )

    // If submission doesn't have a validation status, we return the no option option :)
    return foundOption || VALIDATION_STATUS_NO_OPTION
  }

  /**
   * Callback for dropdown.
   */
  onValidationStatusChange(sid: string, newValidationStatus: ValidationStatusOptionName) {
    if (newValidationStatus === ValidationStatusAdditionalName.no_status) {
      actions.resources.removeSubmissionValidationStatus(this.props.asset.uid, sid)
    } else {
      actions.resources.updateSubmissionValidationStatus(this.props.asset.uid, sid, {
        'validation_status.uid': newValidationStatus,
      })
    }
  }

  onFieldSortChange(
    fieldId: string,
    /** One of SortValues or `null` for clear value. */
    sortValue: SortValues | null,
  ) {
    tableStore.setSortBy(fieldId, sortValue)
  }

  onHideField(fieldId: string) {
    tableStore.hideField(this.state.submissions, fieldId)
  }

  onFieldFrozenChange(fieldId: string, isFrozen: boolean) {
    tableStore.setFrozenColumn(fieldId, isFrozen)
  }

  // We need to distinguish between repeated groups with nested values
  // and other question types that use a flat nested key (i.e. with '/').
  // If submission response contains the parent key, we should use that.
  _selectNestedRow(row: SubmissionResponse, key: string, rootParentGroup: string | undefined) {
    if (rootParentGroup && rootParentGroup in row && !key.startsWith(SUPPLEMENTAL_DETAILS_PROP)) {
      return row[rootParentGroup]
    }
    return row[key]
  }

  _getColumnWidth(columnId: AnyRowTypeName | string | undefined) {
    if (!columnId) {
      return DEFAULT_DATA_CELL_WIDTH
    }
    return CELLS_WIDTH_OVERRIDES[columnId] || DEFAULT_DATA_CELL_WIDTH
  }

  /**
   * @param {number} maxPageRes
   * @returns {object} submission actions column for react-table
   */
  _getColumnSubmissionActions(maxPageRes: number): TableColumn | null {
    const userCanSeeEditIcon =
      this.props.asset.deployment__active &&
      (userCan(PERMISSIONS_CODENAMES.change_submissions, this.props.asset) ||
        userCanPartially(PERMISSIONS_CODENAMES.change_submissions, this.props.asset))

    const userCanSeeCheckbox =
      userCan(PERMISSIONS_CODENAMES.validate_submissions, this.props.asset) ||
      userCan(PERMISSIONS_CODENAMES.delete_submissions, this.props.asset) ||
      userCan(PERMISSIONS_CODENAMES.change_submissions, this.props.asset) ||
      userCanPartially(PERMISSIONS_CODENAMES.validate_submissions, this.props.asset) ||
      userCanPartially(PERMISSIONS_CODENAMES.delete_submissions, this.props.asset) ||
      userCanPartially(PERMISSIONS_CODENAMES.change_submissions, this.props.asset)

    if (
      userCan(PERMISSIONS_CODENAMES.validate_submissions, this.props.asset) ||
      userCan(PERMISSIONS_CODENAMES.delete_submissions, this.props.asset) ||
      userCan(PERMISSIONS_CODENAMES.change_submissions, this.props.asset) ||
      userCan(PERMISSIONS_CODENAMES.view_submissions, this.props.asset) ||
      userCanPartially(PERMISSIONS_CODENAMES.validate_submissions, this.props.asset) ||
      userCanPartially(PERMISSIONS_CODENAMES.delete_submissions, this.props.asset) ||
      userCanPartially(PERMISSIONS_CODENAMES.change_submissions, this.props.asset) ||
      userCanPartially(PERMISSIONS_CODENAMES.view_submissions, this.props.asset)
    ) {
      const res1 = this.state.resultsTotal === 0 ? 0 : this.state.currentPage * this.state.pageSize + 1
      const res2 = Math.min((this.state.currentPage + 1) * this.state.pageSize, this.state.resultsTotal)

      // To accommodate the checkbox, icon buttons and header text.
      let columnWidth = 100
      if (this.state.resultsTotal >= 100000) {
        // Whenever there are more results we need a bit more space for
        // the "X results" text.
        columnWidth += 20
      }

      const elClassNames = ['rt-sub-actions', 'is-frozen']
      const frozenColumn = tableStore.getFrozenColumn()
      if (!frozenColumn) {
        elClassNames.push('is-last-frozen')
      }

      return {
        Header: () => (
          <div>
            <div className='table-header-results'>
              {res1} - {res2}
              <br />
              <strong>
                {this.state.resultsTotal} {t('results')}
              </strong>
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
                onSelectAllPages={this.bulkSelectAll.bind(this)}
                onSelectCurrentPage={this.bulkSelectAllRows.bind(this, true)}
                onClearSelection={this.bulkClearSelection.bind(this)}
              />
            )
          } else {
            // Can't return `null` here, because of `data-table` typings
            return <></>
          }
        },
        Cell: (row: CellInfo) => (
          <div className='table-submission-actions'>
            {userCanSeeCheckbox && (
              <Checkbox
                checked={Boolean(this.state.selectedRows[row.original._id])}
                onClick={(evt: React.MouseEvent<HTMLInputElement> | React.TouchEvent<HTMLInputElement>) => {
                  this.onRowCheckboxClick(evt, row.original._id)
                }}
                onChange={() => {}}
                disabled={
                  !(
                    userHasPermForSubmission('change_submissions', this.props.asset, row.original) ||
                    userHasPermForSubmission('delete_submissions', this.props.asset, row.original) ||
                    userHasPermForSubmission('validate_submissions', this.props.asset, row.original)
                  )
                }
              />
            )}

            {/*
            TODO: the tooltips of these two buttons appear underneath them
            causing an unnecessary space under the last table row to happen.
            Let's try to fix this one day by introducing better tooltips.
            */}
            <Button
              type='text'
              size='s'
              startIcon='view'
              tooltip={t('Open')}
              tooltipPosition='left'
              onClick={() => {
                this.launchSubmissionModal(row.original._id)
              }}
            />

            {userCanSeeEditIcon && userHasPermForSubmission('change_submissions', this.props.asset, row.original) && (
              <Button
                type='text'
                size='s'
                startIcon='edit'
                tooltip={t('Edit')}
                tooltipPosition='left'
                onClick={() => {
                  this.launchEditSubmission(row.original._id)
                }}
              />
            )}
          </div>
        ),
      }
    }

    return null
  }

  /**
   * @returns {object} validation status column for react-table
   */
  _getColumnValidation(): TableColumn {
    const elClassNames = ['rt-status']
    if (tableStore.getFieldSortValue(VALIDATION_STATUS_ID_PROP) !== null) {
      elClassNames.push('is-sorted')
    }

    return {
      Header: () => (
        <div className='column-header-wrapper'>
          <TableColumnSortDropdown
            asset={this.props.asset}
            fieldId={VALIDATION_STATUS_ID_PROP}
            sortValue={tableStore.getFieldSortValue(VALIDATION_STATUS_ID_PROP)}
            onSortChange={this.onFieldSortChange.bind(this)}
            onHide={this.onHideField.bind(this)}
            isFieldFrozen={tableStore.isFieldFrozen(VALIDATION_STATUS_ID_PROP)}
            onFrozenChange={this.onFieldFrozenChange.bind(this)}
            additionalTriggerContent={<span className='column-header-title'>{t('Validation')}</span>}
          />
        </div>
      ),
      sortable: false,
      accessor: VALIDATION_STATUS_ID_PROP,
      index: '__2',
      id: VALIDATION_STATUS_ID_PROP,
      width: this._getColumnWidth(VALIDATION_STATUS_ID_PROP),
      className: elClassNames.join(' '),
      headerClassName: elClassNames.join(' '),
      Filter: ({ filter, onChange }) => {
        const currentOption: ValidationStatusOption =
          VALIDATION_STATUS_OPTIONS.find((item) => item.value === filter?.value) || VALIDATION_STATUS_SHOW_ALL_OPTION

        return (
          <ValidationStatusDropdown
            onChange={(newValue) => {
              // For `show_all` option we need to pass empty string
              if (newValue === ValidationStatusAdditionalName.show_all) {
                onChange('')
              } else {
                onChange(newValue)
              }
            }}
            currentValue={currentOption}
            isForHeaderFilter
          />
        )
      },
      Cell: (row: CellInfo) => (
        <ValidationStatusDropdown
          onChange={(newValue) => {
            this.onValidationStatusChange(row.original._id, newValue)
          }}
          currentValue={this.getCurrentValidationStatusOption(row.original)}
          isDisabled={
            !userHasPermForSubmission(PERMISSIONS_CODENAMES.validate_submissions, this.props.asset, row.original)
          }
        />
      ),
    }
  }

  /**
   * Builds and gathers all necessary react-table data and stores in state.
   */
  _prepColumns(data: SubmissionResponse[]) {
    const allColumns = tableStore.getAllColumns(data)

    let showLabels = this.state.showLabels
    let showGroupName = this.state.showGroupName
    let showHXLTags = this.state.showHXLTags
    let translationIndex = this.state.translationIndex
    const maxPageRes = Math.min(this.state.pageSize, this.state.submissions.length)

    const tableSettings = tableStore.getTableSettings()

    if (tableSettings[DATA_TABLE_SETTINGS.TRANSLATION] !== undefined) {
      translationIndex = tableSettings[DATA_TABLE_SETTINGS.TRANSLATION] || 0
      showLabels = translationIndex > -1
    }

    if (tableSettings[DATA_TABLE_SETTINGS.SHOW_GROUP] !== undefined) {
      showGroupName = Boolean(tableSettings[DATA_TABLE_SETTINGS.SHOW_GROUP])
    }

    if (tableSettings[DATA_TABLE_SETTINGS.SHOW_HXL] !== undefined) {
      showHXLTags = Boolean(tableSettings[DATA_TABLE_SETTINGS.SHOW_HXL])
    }

    // define the columns array
    let columnsToRender: Array<TableColumn> = []

    const columnSubmissionActions = this._getColumnSubmissionActions(maxPageRes)
    if (columnSubmissionActions) {
      columnsToRender.push(columnSubmissionActions)
    }

    const columnValidation = this._getColumnValidation()
    if (columnValidation) {
      columnsToRender.push(columnValidation)
    }

    const survey = this.props.asset.content?.survey
    // TODO: write some code that will get the choices for `select_x_from_file`
    // from the file. It needs to first load the file and then parse the content
    // so it's quite the task :)
    const choices: SurveyChoice[] = this.props.asset.content?.choices || []
    let flatPaths: SurveyFlatPaths = {}
    if (survey) {
      flatPaths = getSurveyFlatPaths(survey)
    }

    allColumns.forEach((key: string, columnIndex: number) => {
      let q: SurveyRow | undefined
      let rootParentGroup: string | undefined
      if (key.includes('/')) {
        const qParentG = key.split('/')
        rootParentGroup = qParentG[0]
        q = survey?.find(
          (o) => o.name === qParentG[qParentG.length - 1] || o.$autoname === qParentG[qParentG.length - 1],
        )
      } else {
        q = survey?.find((o) => o.name === key || o.$autoname === key)
      }

      if (q && q.type === GROUP_TYPES_BEGIN.begin_repeat) {
        return false
      }

      // Set ordering of question columns. Meta questions can be prepended or
      // appended relative to survey questions with an index prefix

      // sets location of columns for questions not in current survey version
      // `y` puts this case in front of known meta types
      let index = 'y_' + key

      // Get background-audio question name in case user changes it
      const backgroundAudioName = getBackgroundAudioQuestionName(this.props.asset)

      // place meta question columns at the very end with `z` prefix
      switch (key) {
        case META_QUESTION_TYPES.username:
          index = 'z1'
          break
        case META_QUESTION_TYPES.deviceid:
          index = 'z4'
          break
        case META_QUESTION_TYPES.phonenumber:
          index = 'z5'
          break
        case META_QUESTION_TYPES.today:
          index = 'z6'
          break
        case '__version__':
        case '_version_':
          index = 'z7'
          break
        case ADDITIONAL_SUBMISSION_PROPS._id:
          index = 'z8'
          break
        case ADDITIONAL_SUBMISSION_PROPS._uuid:
          index = 'z9'
          break
        case ADDITIONAL_SUBMISSION_PROPS._submission_time:
          index = 'z91'
          break
        case ADDITIONAL_SUBMISSION_PROPS._submitted_by:
          index = 'z92'
          break
        // set index for `background-audio` to the very first column with `_`
        case backgroundAudioName:
          index = '_1'
          break
        default:
          // Look for a survey row that matches current column 'key' and set
          // index for it based on the order in which it is stored in survey
          // (including questions in groups).
          survey?.forEach((surveyRow, surveyRowIndex) => {
            // Get the row name (`loopKey`) from possible path (`key`).
            let loopKey = key
            if (key.includes('/')) {
              const loopKeyArray = loopKey.split('/')
              loopKey = loopKeyArray[loopKeyArray.length - 1]
            }

            if (getRowName(surveyRow) === loopKey) {
              index = surveyRowIndex.toString()
            }
          })

          // Detect supplemental details column and put it after its source column.
          if (q === undefined && key.startsWith(SUPPLEMENTAL_DETAILS_PROP)) {
            const supplementalColumnSource = key.split('/')[1]
            // Add extra step for grouped items
            const sourceCleaned = supplementalColumnSource.replace(/-/g, '/').split('/').at(-1) || ''
            const sourceColumn = columnsToRender.find((column) => column.id === flatPaths[sourceCleaned])
            if (sourceColumn) {
              // This way if we have a source column with index `2`, and
              // the supplemental column with index `5`, we will set
              // the supplemental details column to `2_5_supplementalDetails/…`
              // to make sure it keeps the correct order.
              index = `${sourceColumn.index}_${columnIndex}_${key}`
            }
          }
      }

      const elClassNames = []

      if (tableStore.getFieldSortValue(key) !== null) {
        elClassNames.push('is-sorted')
      }

      let columnIcon: React.DetailedReactHTMLElement<{}, HTMLElement> | null = null
      if (q && q.type) {
        columnIcon = renderQuestionTypeIcon(q.type)
      }
      columnsToRender.push({
        Header: () => {
          const columnName = getColumnLabel(
            this.props.asset,
            key,
            this.state.showGroupName,
            this.state.translationIndex,
          )

          let columnHXLTags = null
          if (this.props.asset.content?.survey) {
            columnHXLTags = getColumnHXLTags(this.props.asset.content?.survey, key)
          }

          return (
            <div className='column-header-wrapper'>
              <TableColumnSortDropdown
                asset={this.props.asset}
                fieldId={key}
                sortValue={tableStore.getFieldSortValue(key)}
                onSortChange={this.onFieldSortChange.bind(this)}
                onHide={this.onHideField.bind(this)}
                isFieldFrozen={tableStore.isFieldFrozen(key)}
                onFrozenChange={this.onFieldFrozenChange.bind(this)}
                additionalTriggerContent={
                  <span className='column-header-title' title={columnName}>
                    {columnIcon}
                    {columnName}
                  </span>
                }
              />
              {this.state.showHXLTags && columnHXLTags && (
                <span className='column-header-hxl-tags' title={columnHXLTags}>
                  {columnHXLTags}
                </span>
              )}
            </div>
          )
        },
        id: key,
        accessor: (row) => this._selectNestedRow(row, key, rootParentGroup),
        index: index,
        question: q,
        // This (and the Filter itself) will be set below (we do it separately,
        // because we need to do it for all the columns, not only the ones in
        // this loop)
        filterable: false,
        // Filter
        sortable: false,
        className: elClassNames.join(' '),
        headerClassName: elClassNames.join(' '),
        width: this._getColumnWidth(q?.type),
        Cell: (row: CellInfo) => {
          const columnName = getColumnLabel(
            this.props.asset,
            key,
            this.state.showGroupName,
            this.state.translationIndex,
          )

          if (typeof row.value === 'object' && !key.startsWith(SUPPLEMENTAL_DETAILS_PROP)) {
            return <RepeatGroupCell submissionData={row.original} rowName={key} />
          }

          if (q && q.type && row.value) {
            if (Object.keys(TABLE_MEDIA_TYPES).includes(q.type)) {
              let mediaAttachment = null

              const attachmentIndex: number = row.original._attachments.findIndex(
                (attachment: SubmissionAttachment) => {
                  const attachmentFileNameEnd = attachment.filename.split('/').pop()
                  const normalizedRowValue = row.value.replace(/ /g, '_')
                  return attachmentFileNameEnd === normalizedRowValue
                },
              )

              if (q.type !== QUESTION_TYPES.text.id && row.original._attachments[attachmentIndex]) {
                mediaAttachment = getMediaAttachment(
                  row.original,
                  row.value,
                  row.original._attachments[attachmentIndex].question_xpath,
                )
              }

              if (q.type === QUESTION_TYPES.audio.id || q.type === QUESTION_TYPES['background-audio'].id) {
                if (mediaAttachment !== null && q.$xpath !== undefined) {
                  return (
                    <AudioCell
                      assetUid={this.props.asset.uid}
                      xpath={q.$xpath}
                      submissionData={row.original}
                      mediaAttachment={mediaAttachment}
                    />
                  )
                }
              }

              if (mediaAttachment !== null && q.$xpath !== undefined) {
                return (
                  <MediaCell
                    questionType={q.type}
                    mediaAttachment={mediaAttachment}
                    mediaName={row.value}
                    submissionIndex={row.index + 1}
                    submissionTotal={this.state.submissions.length}
                    submissionData={row.original}
                    asset={this.props.asset}
                  />
                )
              }
            }

            // show proper labels for choice questions
            if (q.type === QUESTION_TYPES.select_one.id) {
              const choice = choices.find(
                (choiceItem) => choiceItem.list_name === q?.select_from_list_name && choiceItem.name === row.value,
              )
              if (choice?.label && choice.label[translationIndex]) {
                return <span className='trimmed-text'>{choice.label[translationIndex]}</span>
              } else {
                return <span className='trimmed-text'>{row.value}</span>
              }
            }
            if (q && q.type === QUESTION_TYPES.select_multiple.id && row.value && !tableStore.getTranslationIndex()) {
              const values = row.value.split(' ')
              const labels: string[] = []
              values.forEach((valueItem: string) => {
                const choice = choices.find(
                  (choiceItem) => choiceItem.list_name === q?.select_from_list_name && choiceItem.name === valueItem,
                )
                if (choice && choice.label && choice.label[translationIndex]) {
                  labels.push(choice.label[translationIndex])
                }
              })

              return <span className='trimmed-text'>{labels.join(', ')}</span>
            }
            if (q.type === META_QUESTION_TYPES.start || q.type === META_QUESTION_TYPES.end) {
              return <span className='trimmed-text'>{formatTimeDateShort(row.value)}</span>
            }
          }

          if (key === ADDITIONAL_SUBMISSION_PROPS._submission_time) {
            return <span className='trimmed-text'>{formatTimeDateShort(row.value)}</span>
          }

          if (q?.type === QUESTION_TYPES.text.id) {
            return (
              <TextModalCell
                text={row.value}
                columnName={columnName}
                submissionIndex={row.index + 1}
                submissionTotal={this.state.submissions.length}
              />
            )
          }

          // This identifies supplemental details column
          if (row.value === undefined && q === undefined && key.startsWith(SUPPLEMENTAL_DETAILS_PROP)) {
            return (
              <TextModalCell
                text={getSupplementalDetailsContent(row.original, key) || ''}
                columnName={columnName}
                submissionIndex={row.index + 1}
                submissionTotal={this.state.submissions.length}
              />
            )
          }

          return (
            <span className='trimmed-text' dir='auto'>
              {row.value}
            </span>
          )
        },
      })

      return false
    })

    // Apply stored indexes to all columns to sort them.
    // NOTE: frozen column index stay as is, it is being moved to the beginning
    // of table using CSS styling.
    columnsToRender.sort((columnA, columnB) => columnA.index.localeCompare(columnB.index, 'en', { numeric: true }))

    const frozenColumn = tableStore.getFrozenColumn()

    columnsToRender.forEach((col: TableColumn) => {
      const columnQuestion = col.question

      // We set filters here, so they apply for all columns
      if (isTableColumnFilterableByDropdown(columnQuestion?.type)) {
        col.filterable = true
        col.Filter = ({ filter, onChange }) => (
          <select
            onChange={(event) => onChange(event.target.value)}
            style={{ width: '100%' }}
            value={filter ? filter.value : ''}
          >
            <option value=''>{t('Show All')}</option>
            {choices
              .filter((choiceItem) => choiceItem.list_name === columnQuestion?.select_from_list_name)
              .map((item, n) => {
                const displayName = getQuestionOrChoiceDisplayName(item, translationIndex)
                return (
                  <option value={item.name} key={n}>
                    {displayName}
                  </option>
                )
              })}
          </select>
        )
      } else if (isTableColumnFilterableByTextInput(columnQuestion?.type, col.id)) {
        col.filterable = true
        col.Filter = ({ filter, onChange }) => (
          <DebounceInput
            value={filter ? filter.value : undefined}
            debounceTimeout={750}
            onChange={(event) => onChange(event.target.value)}
            className='table-filter-input'
            placeholder={t('Search')}
          />
        )
      }

      // Ensure frozen columns stay correctly aligned to the left, even after
      // scrolling or reloads.
      if (col.className?.includes('frozen')) {
        col.style = { ...col.style, left: this.frozenLeftRef }
      }

      if (frozenColumn === col.id) {
        col.className = col.className ? `is-frozen is-last-frozen ${col.className}` : 'is-frozen is-last-frozen'
        col.headerClassName = col.headerClassName
          ? `is-frozen is-last-frozen ${col.headerClassName}`
          : 'is-frozen is-last-frozen'
        col.style = { ...col.style, left: this.frozenLeftRef }
      }
    })

    // prepare list of selected columns, if configured
    const selectedColumnsIds = tableStore.getSelectedColumns()
    if (selectedColumnsIds) {
      // always include frozenColumn, if set
      if (frozenColumn && !selectedColumnsIds.includes(frozenColumn)) {
        selectedColumnsIds.unshift(frozenColumn)
      }

      columnsToRender = columnsToRender.filter((el) => {
        // always include checkbox column
        if (el.id === SUBMISSION_ACTIONS_ID) {
          return true
        }
        return Boolean(el.id && selectedColumnsIds.includes(el.id) !== false)
      })
    }

    this.setState({
      columns: columnsToRender,
      translationIndex: translationIndex,
      showLabels: showLabels,
      showGroupName: showGroupName,
      showHXLTags: showHXLTags,
    })
  }

  toggleFullscreen() {
    this.setState({ isFullscreen: !this.state.isFullscreen })
  }

  onSubmissionValidationStatusChange(result: ValidationStatusResponse, sid: string) {
    if (sid) {
      const subIndex = this.state.submissions.findIndex((x) => x._id === Number.parseInt(sid))
      if (typeof subIndex !== 'undefined' && this.state.submissions[subIndex]) {
        const newData = this.state.submissions
        newData[subIndex]._validation_status = result || {}
        this.setState({ submissions: newData }, () => {
          this._prepColumns(newData)
        })
      }
    }
  }

  refreshSubmissions() {
    if (this.state.fetchInstance) {
      this.fetchSubmissions(this.state.fetchInstance)
    }
  }

  onDuplicateSubmissionCompleted({}, sid: string, duplicatedSubmission: SubmissionResponse) {
    // Load fresh table of submissions
    if (this.state.fetchInstance) {
      this.fetchSubmissions(this.state.fetchInstance)
    }
    // Open submission modal
    this.submissionModalProcessing(sid, this.state.submissions, true, duplicatedSubmission)
  }

  onTableStoreChange(newData: TableStoreData) {
    // Close table settings modal after settings are saved.
    pageState.hideModal()

    // If sort setting changed, we definitely need to get new submissions (which
    // will rebuild columns)
    if (
      JSON.stringify(this.previousOverrides[DATA_TABLE_SETTINGS.SORT_BY]) !==
      JSON.stringify(newData.overrides[DATA_TABLE_SETTINGS.SORT_BY])
    ) {
      this.refreshSubmissions()
      // If some other table settings changed, we need to fix columns using
      // existing data, as after `actions.table.updateSettings` resolves,
      // the props asset is not yet updated
    } else if (
      JSON.stringify(this.previousOverrides[DATA_TABLE_SETTING]) !==
      JSON.stringify(newData.overrides[DATA_TABLE_SETTING])
    ) {
      this._prepColumns(this.state.submissions)
    }

    this.previousOverrides = clonedeep(newData.overrides)
  }

  onTableUpdateSettingsCompleted() {
    // Close table settings modal after settings are saved.
    pageState.hideModal()
    // Any updates after table settings are saved are handled by `componentDidUpdate`.
  }

  /** Uses `fetchData` but with past instance. */
  fetchDataForCurrentInstance() {
    if (this.state.fetchState && this.state.fetchInstance) {
      this.fetchData(this.state.fetchState, this.state.fetchInstance)
    }
  }

  /** Function for `react-table` for fetching data. */
  fetchData(tableState: ReactTableState, tableInstance: ReactTableInstance) {
    this.setState({
      loading: true,
      pageSize: tableInstance.state.pageSize,
      currentPage: tableInstance.state.page,
      fetchState: tableState,
      fetchInstance: tableInstance,
    })
    this.fetchSubmissions(tableInstance)
  }

  /**
   * Opens submission modal
   * @param {object} row
   */
  launchSubmissionModal(sid: string) {
    this.submissionModalProcessing(sid, this.state.submissions)
  }

  /**
   * Opens (or updates data in an opened) submission modal
   */
  submissionModalProcessing(
    sid: string,
    submissions: SubmissionResponse[],
    isDuplicated = false,
    duplicatedSubmission: SubmissionResponse | null = null,
  ) {
    const ids = submissions.map((item) => item._id)

    pageState.showModal({
      type: MODAL_TYPES.SUBMISSION,
      sid: sid,
      asset: this.props.asset,
      ids: ids,
      isDuplicated: isDuplicated,
      duplicatedSubmission: duplicatedSubmission,
      tableInfo: {
        currentPage: this.state.currentPage,
        pageSize: this.state.pageSize,
        resultsTotal: this.state.resultsTotal,
      },
    })
  }

  showTableColumnsOptionsModal() {
    pageState.showModal({
      type: MODAL_TYPES.TABLE_SETTINGS,
      asset: this.props.asset,
    })
  }

  launchEditSubmission(sid: string) {
    enketoHandler.openSubmission(this.props.asset.uid, sid, EnketoActions.edit)
  }

  onPageStateUpdated(pageState: PageStateStoreState) {
    // This function serves purpose only for Submission Modal and only when
    // user reaches the end of currently loaded submissions in the table with
    // the "next" button (and similarly with "prev" button).
    if (pageState.modal && pageState.modal.type === MODAL_TYPES.SUBMISSION && !pageState.modal.sid) {
      // HACK: this is our way of forcing `react-table` to switch page. There is
      // a way to manually control pagination, but it would require some
      // refactoring to happen. This hack (i.e. using internal `setState` of
      // `react-table` component) will most definitely not work when we upgrade
      // `react-table` to v7, but since that major version is a huge overhaul,
      // we would be refactoring everything regardless.
      let page = 0
      if (pageState.modal.page === 'next') {
        page = this.state.currentPage + 1
      } else if (pageState.modal.page === 'prev') {
        page = this.state.currentPage - 1
      }
      const fetchInstance = this.state.fetchInstance
      fetchInstance?.setState({ page: page })

      this.setState({ submissionPager: pageState.modal.page }, this.fetchDataForCurrentInstance.bind(this))
    }
  }

  /**
   * Handles row checkbox selection for bulk actions.
   */
  onRowCheckboxClick(evt: React.MouseEvent<HTMLInputElement> | React.TouchEvent<HTMLInputElement>, sid: string) {
    const isChecked = evt.currentTarget.checked
    const isShiftKeyPressed = Boolean(evt.shiftKey)

    const { selectedRows, lastChecked, shiftSelection } = this.state

    if (isChecked) {
      const updatedSelectedRows = { ...selectedRows, [sid]: true }
      const updatedShiftSelection = {
        ...shiftSelection,
        [sid]: isShiftKeyPressed,
      }

      // Handles range selection of checkboxes if the shift key is held down
      // for both start and end values
      if (isShiftKeyPressed && lastChecked && selectedRows[lastChecked] && shiftSelection[lastChecked]) {
        const [start, end] = [lastChecked, sid].map(Number)
        for (let i = Math.min(start, end); i <= Math.max(start, end); i++) {
          updatedSelectedRows[i] = true
          delete updatedShiftSelection[i]
        }
      }
      this.setState({
        selectedRows: updatedSelectedRows,
        lastChecked: isChecked ? sid : null,
        selectAll: false,
        shiftSelection: updatedShiftSelection,
      })
    } else {
      const { [sid]: _, ...updatedSelectedRows } = selectedRows
      this.setState({
        selectedRows: updatedSelectedRows,
        lastChecked: null,
        selectAll: false,
      })
    }
  }

  /**
   * Handles whole page bulk checkbox change
   */
  bulkSelectAllRows(isChecked: boolean) {
    const s = this.state.selectedRows
    this.state.submissions.forEach((r) => {
      if (isChecked) {
        s[r._id] = true
      } else {
        delete s[r._id]
      }
    })

    // If the entirety of the results has been selected, selectAll should be true
    // Useful when the # of results is smaller than the page size.
    const scount = Object.keys(s).length

    if (scount === this.state.resultsTotal) {
      this.setState({
        selectedRows: s,
        selectAll: true,
      })
    } else {
      this.setState({
        selectedRows: s,
        selectAll: false,
      })
    }
  }

  onBulkChangeCompleted() {
    this.fetchDataForCurrentInstance()
  }

  /**
   * Handles all pages bulk change
   */
  bulkSelectAll() {
    // make sure all rows on current page are selected
    const s = this.state.selectedRows
    this.state.submissions.forEach((r) => {
      s[r._id] = true
    })

    this.setState({
      selectedRows: s,
      selectAll: true,
    })
  }

  bulkClearSelection() {
    this.setState({ selectAll: false, selectedRows: {} })
  }

  renderBulkSelectUI() {
    if (!this.state.submissions.length) {
      return false
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
    )
  }

  // NOTE: Please avoid calling `setState` inside scroll callback, as it causes
  // a noticeable lag.
  onTableScroll(evt: React.UIEvent<HTMLElement>) {
    const eventTarget = evt.target as HTMLElement

    // We need this check, because when scrolling vertically, the scrollLeft
    // property is always `0` (which seems like a browser bug).
    if (this.tableScrollTop === eventTarget.scrollTop) {
      const left = eventTarget.scrollLeft > 0 ? eventTarget.scrollLeft : 0
      const $frozenColumnCells = $('.ReactTable .rt-tr .is-frozen')

      if (left >= 1) {
        $frozenColumnCells.addClass('is-scrolled-horizontally')
      } else {
        $frozenColumnCells.removeClass('is-scrolled-horizontally')
      }

      $frozenColumnCells.css({ left: left })

      // Save the reference position for the frozen column's left offset.
      this.frozenLeftRef = left
    } else {
      this.tableScrollTop = eventTarget.scrollTop
    }
  }

  render() {
    if (this.state.errorNumber === 500) {
      const supportMessage = t(
        'Please try again later, or [contact the support team](##SUPPORT_URL##) if this happens repeatedly.',
      ).replace('##SUPPORT_URL##', envStore.data.support_url)
      return (
        <bem.FormView m='ui-panel'>
          <CenteredMessage
            message={
              <div>
                <h2>{t('Oops! Something went wrong on our end.')}</h2>
                <div>
                  <Markdown>{supportMessage}</Markdown>
                </div>
                <br />
                <div>
                  {t('Response details:')} {`${this.state.errorNumber} ${this.state.errorStatus}`}
                </div>
              </div>
            }
          />
        </bem.FormView>
      )
    }

    if (typeof this.state.error === 'string') {
      return (
        <bem.FormView m='ui-panel'>
          <CenteredMessage message={this.state.error} />
        </bem.FormView>
      )
    }

    if (!this.state.isInitialized) {
      return <LoadingSpinner />
    }

    const pages = Math.floor((this.state.resultsTotal - 1) / this.state.pageSize + 1)

    const tableClasses = ['-highlight']
    if (this.state.showHXLTags) {
      tableClasses.push('has-hxl-tags-visible')
    }

    const formViewModifiers = ['table']
    if (this.state.isFullscreen) {
      formViewModifiers.push('fullscreen')
    }
    return (
      <bem.FormView m={formViewModifiers}>
        <bem.FormView__item m='banner-container'>
          <LimitNotifications />
        </bem.FormView__item>
        <bem.FormView__group m={['table-header', this.state.loading ? 'table-loading' : 'table-loaded']}>
          {userCan(PERMISSIONS_CODENAMES.change_asset, this.props.asset) && (
            <ColumnsHideDropdown
              asset={this.props.asset}
              submissions={this.state.submissions}
              showGroupName={this.state.showGroupName}
              translationIndex={this.state.translationIndex}
            />
          )}

          {this.renderBulkSelectUI()}

          <bem.FormView__item m='table-buttons'>
            <Button
              type='text'
              size='m'
              startIcon='expand'
              onClick={this.toggleFullscreen.bind(this)}
              tooltip={t('Toggle fullscreen')}
              tooltipPosition='right'
            />

            <Button
              type='text'
              size='m'
              startIcon='settings'
              onClick={this.showTableColumnsOptionsModal.bind(this)}
              tooltip={t('Display options')}
              tooltipPosition='right'
            />
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
          onFetchData={this.fetchData.bind(this)}
          loading={this.state.loading}
          previousText={
            <React.Fragment>
              <i className='k-icon k-icon-caret-left' />
              {t('Prev')}
            </React.Fragment>
          }
          nextText={
            <React.Fragment>
              {t('Next')}
              <i className='k-icon k-icon-caret-right' />
            </React.Fragment>
          }
          loadingText={<LoadingSpinner />}
          noDataText={t('Your filters returned no submissions.')}
          pageText={t('Page')}
          ofText={t('of')}
          rowsText={t('rows')}
          getTableProps={() => {
            return {
              onScroll: this.onTableScroll.bind(this),
            }
          }}
          filterable
          // Enables RTL support in table cells
          getTdProps={() => {
            return { dir: 'auto' }
          }}
        />
      </bem.FormView>
    )
  }
}

export default DataTable

import React, { useEffect, useRef, useState } from 'react'

import alertify from 'alertifyjs'
import cx from 'classnames'
import Select from 'react-select'
import { actions } from '#/actions'
import { getFlatQuestionsList, getSurveyFlatPaths, injectSupplementalRowsIntoListOfRows } from '#/assetUtils'
import bem from '#/bem'
import Button from '#/components/common/button'
import Checkbox from '#/components/common/checkbox'
import MultiCheckbox, { type MultiCheckboxItem } from '#/components/common/multiCheckbox'
import TextBox from '#/components/common/textBox'
import ToggleSwitch from '#/components/common/toggleSwitch'
import { PERMISSIONS_CODENAMES } from '#/components/permissions/permConstants'
import { userCan } from '#/components/permissions/utils'
import ExportTypeSelector from '#/components/projectDownloads/ExportTypeSelector'
import {
  DEFAULT_EXPORT_SETTINGS,
  EXPORT_FORMATS,
  EXPORT_MULTIPLE_OPTIONS,
  EXPORT_TYPES,
  type ExportMultiOption,
  type ExportTypeDefinition,
} from '#/components/projectDownloads/exportsConstants'
import exportsStore from '#/components/projectDownloads/exportsStore'
import {
  type ExportFormatOption,
  getContextualDefaultExportFormat,
  getExportFormatOptions,
} from '#/components/projectDownloads/exportsUtils'
import { getColumnLabel } from '#/components/submissions/tableUtils'
import { ADDITIONAL_SUBMISSION_PROPS, SUPPLEMENTAL_DETAILS_PROP } from '#/constants'
import type { AssetResponse, ExportSetting, ExportSettingRequest, MongoQuery, PaginatedResponse } from '#/dataInterface'
import { createDateQuery, formatTimeDate, recordEntries, recordKeys, recordValues } from '#/utils'

const NAMELESS_EXPORT_NAME = t('Latest unsaved settings')

interface ProjectExportsCreatorProps {
  asset: AssetResponse
}

interface ProjectExportsCreatorState {
  isComponentReady: boolean
  isPending: boolean
  selectedExportType: ExportTypeDefinition
  selectedExportFormat: ExportFormatOption
  groupSeparator: string
  selectedExportMultiple: ExportMultiOption
  isIncludeGroupsEnabled: boolean
  isIncludeAllVersionsEnabled: boolean
  isAdvancedViewVisible: boolean
  isSaveCustomExportEnabled: boolean
  customExportName: string
  isCustomSelectionEnabled: boolean
  isFlattenGeoJsonEnabled: boolean
  isXlsTypesAsTextEnabled: boolean
  isIncludeMediaUrlEnabled: boolean
  selectedRows: Set<string>
  selectableRowsCount: number
  selectedDefinedExport: null | DefinedExportOption
  definedExports: DefinedExportOption[]
  isUpdatingDefinedExportsList: boolean
  isDateEnabled: boolean
  startDate: string
  endDate: string
}

interface DefinedExportOption {
  value: number | null
  label: string
  data?: ExportSetting
}

/**
 * This is component responsible for creating and saving export settings. It can
 * also request a new download from backend.
 *
 * NOTE: we use a nameless export setting to keep last used export settings that
 * weren't saved as named custom setting.
 */
export default function ProjectExportsCreator(props: ProjectExportsCreatorProps) {
  function getAllSelectableRows() {
    let allRows: Set<string> = new Set()
    if (props.asset?.content?.survey) {
      const flatPaths = getSurveyFlatPaths(props.asset.content.survey, false, true)
      recordValues(flatPaths).forEach((path) => {
        allRows.add(path)
      })
      recordKeys(ADDITIONAL_SUBMISSION_PROPS).forEach((submissionProp) => {
        allRows.add(submissionProp)
      })
    }

    allRows = new Set(injectSupplementalRowsIntoListOfRows(props.asset, allRows))

    return allRows
  }

  function getInitialState(): ProjectExportsCreatorState {
    const newState: ProjectExportsCreatorState = {
      isComponentReady: false,
      isPending: false,
      selectedExportType: exportsStore.getExportType(),
      selectedExportFormat: getContextualDefaultExportFormat(props.asset),
      groupSeparator: DEFAULT_EXPORT_SETTINGS.GROUP_SEPARATOR,
      selectedExportMultiple: DEFAULT_EXPORT_SETTINGS.EXPORT_MULTIPLE,
      isIncludeGroupsEnabled: DEFAULT_EXPORT_SETTINGS.INCLUDE_GROUPS,
      isIncludeAllVersionsEnabled: DEFAULT_EXPORT_SETTINGS.INCLUDE_ALL_VERSIONS,
      isAdvancedViewVisible: false,
      isSaveCustomExportEnabled: DEFAULT_EXPORT_SETTINGS.SAVE_CUSTOM_EXPORT,
      customExportName: DEFAULT_EXPORT_SETTINGS.CUSTOM_EXPORT_NAME,
      isCustomSelectionEnabled: DEFAULT_EXPORT_SETTINGS.CUSTOM_SELECTION,
      isFlattenGeoJsonEnabled: DEFAULT_EXPORT_SETTINGS.FLATTEN_GEO_JSON,
      isXlsTypesAsTextEnabled: DEFAULT_EXPORT_SETTINGS.XLS_TYPES_AS_TEXT,
      isIncludeMediaUrlEnabled: DEFAULT_EXPORT_SETTINGS.INCLUDE_MEDIA_URL,
      selectedRows: new Set<string>(),
      selectableRowsCount: 0,
      selectedDefinedExport: null,
      definedExports: [],
      isUpdatingDefinedExportsList: false,
      isDateEnabled: true,
      startDate: '',
      endDate: '',
    }

    const allSelectableRows = getAllSelectableRows()
    if (allSelectableRows) {
      newState.selectedRows = new Set(allSelectableRows)
      newState.selectableRowsCount = newState.selectedRows.size
    }

    return newState
  }

  const [state, setState] = useState<ProjectExportsCreatorState>(() => getInitialState())
  const stateRef = useRef(state)
  const clearScheduledExportRef = useRef<Function | undefined>(undefined)

  useEffect(() => {
    stateRef.current = state
  }, [state])

  function mergeState(newState: Partial<ProjectExportsCreatorState>) {
    setState((currentState) => {
      return { ...currentState, ...newState }
    })
  }

  function createMongoDateQuery(): MongoQuery {
    if ((stateRef.current.startDate || stateRef.current.endDate) && stateRef.current.isDateEnabled) {
      return { $and: createDateQuery(stateRef.current.startDate, stateRef.current.endDate) }
    }

    return {}
  }

  function setDefaultExportSettings() {
    exportsStore.setExportType(DEFAULT_EXPORT_SETTINGS.EXPORT_TYPE)
    mergeState({
      selectedExportFormat: getContextualDefaultExportFormat(props.asset),
      groupSeparator: DEFAULT_EXPORT_SETTINGS.GROUP_SEPARATOR,
      selectedExportMultiple: DEFAULT_EXPORT_SETTINGS.EXPORT_MULTIPLE,
      isIncludeGroupsEnabled: DEFAULT_EXPORT_SETTINGS.INCLUDE_GROUPS,
      isIncludeAllVersionsEnabled: DEFAULT_EXPORT_SETTINGS.INCLUDE_ALL_VERSIONS,
      isSaveCustomExportEnabled: DEFAULT_EXPORT_SETTINGS.SAVE_CUSTOM_EXPORT,
      customExportName: DEFAULT_EXPORT_SETTINGS.CUSTOM_EXPORT_NAME,
      isCustomSelectionEnabled: DEFAULT_EXPORT_SETTINGS.CUSTOM_SELECTION,
      isFlattenGeoJsonEnabled: DEFAULT_EXPORT_SETTINGS.FLATTEN_GEO_JSON,
      isXlsTypesAsTextEnabled: DEFAULT_EXPORT_SETTINGS.XLS_TYPES_AS_TEXT,
      isIncludeMediaUrlEnabled: DEFAULT_EXPORT_SETTINGS.INCLUDE_MEDIA_URL,
      selectedRows: new Set(getAllSelectableRows()),
    })
  }

  function onExportsStoreChange() {
    const newExportType = exportsStore.getExportType()
    if (newExportType.value !== stateRef.current.selectedExportType.value) {
      mergeState({
        selectedExportType: newExportType,
        isSaveCustomExportEnabled: false,
        customExportName: '',
      })
    }
  }

  function onCreateExportCompleted() {
    mergeState({ isPending: false })
  }

  function onCreateExportFailed() {
    mergeState({ isPending: false })
  }

  function applyExportSettingToState(data: ExportSetting) {
    exportsStore.setExportType(EXPORT_TYPES[data.export_settings.type], false)

    const exportFormatOptions = getExportFormatOptions(props.asset)
    let selectedExportFormat = exportFormatOptions.find((option) => option.value === data.export_settings.lang)

    if (!selectedExportFormat) {
      selectedExportFormat = getContextualDefaultExportFormat(props.asset)
    }

    const customSelectionEnabled = Boolean(
      data.export_settings.fields?.length &&
        stateRef.current.selectableRowsCount !== data.export_settings.fields.length,
    )

    const newSelectedRows = new Set(data.export_settings.fields)

    const newStateObj: Partial<ProjectExportsCreatorState> = {
      selectedExportType: EXPORT_TYPES[data.export_settings.type],
      selectedExportFormat,
      groupSeparator: data.export_settings.group_sep,
      selectedExportMultiple: EXPORT_MULTIPLE_OPTIONS[data.export_settings.multiple_select],
      isIncludeGroupsEnabled: data.export_settings.hierarchy_in_labels,
      isIncludeAllVersionsEnabled: data.export_settings.fields_from_all_versions,
      isSaveCustomExportEnabled: typeof data.name === 'string' && data.name.length >= 1,
      customExportName: data.name,
      isCustomSelectionEnabled: customSelectionEnabled,
      isFlattenGeoJsonEnabled: data.export_settings.flatten,
      isXlsTypesAsTextEnabled: data.export_settings.xls_types_as_text,
      isIncludeMediaUrlEnabled: data.export_settings.include_media_url,
      selectedRows: newSelectedRows,
    }

    if (newStateObj.selectedRows?.size === 0) {
      newStateObj.selectedRows = new Set(getAllSelectableRows())
    }

    stateRef.current.definedExports.forEach((definedExport) => {
      if (definedExport.data?.name === data.name) {
        newStateObj.selectedDefinedExport = definedExport
      }
    })

    if (newStateObj.selectedExportType) {
      exportsStore.setExportType(newStateObj.selectedExportType)
    }

    mergeState(newStateObj)
  }

  function onGetExportSettingsCompleted(
    response: PaginatedResponse<ExportSetting>,
    passData?: { preselectLastSettings?: boolean },
  ) {
    const definedExports: DefinedExportOption[] = []
    response.results.forEach((result, index) => {
      definedExports.push({
        value: index,
        label: result.name ? result.name : NAMELESS_EXPORT_NAME,
        data: result,
      })
    })

    mergeState({
      isUpdatingDefinedExportsList: false,
      definedExports,
    })

    if (response.count >= 1 && passData?.preselectLastSettings) {
      applyExportSettingToState(response.results[0])
    }

    if (!stateRef.current.isComponentReady) {
      mergeState({ isComponentReady: true })
    }
  }

  function onDeleteExportSettingCompleted() {
    clearSelectedDefinedExport()
    fetchExportSettings()
  }

  function handleScheduledExport(response: ExportSettingRequest) {
    if (typeof clearScheduledExportRef.current === 'function') {
      clearScheduledExportRef.current()
    }

    mergeState({ isPending: true })

    const exportParams = response.export_settings
    actions.exports.createExport(props.asset.uid, exportParams)
  }

  function fetchExportSettings(preselectLastSettings = false) {
    mergeState({ isUpdatingDefinedExportsList: true })
    actions.exports.getExportSettings(props.asset.uid, { preselectLastSettings })
  }

  function safeDeleteExportSetting(exportSettingUid: string) {
    const dialog = alertify.dialog('confirm')
    const opts = {
      title: t('Delete export settings?'),
      message: t('Are you sure you want to delete this settings? This action is not reversible.'),
      labels: { ok: t('Delete'), cancel: t('Cancel') },
      onok: () => {
        actions.exports.deleteExportSetting(props.asset.uid, exportSettingUid)
      },
      oncancel: () => {
        dialog.destroy()
      },
    }
    dialog.set(opts).show()
  }

  function onSelectedDefinedExportChange(newDefinedExport: DefinedExportOption | null) {
    if (newDefinedExport === null || newDefinedExport.value === null || newDefinedExport.data === undefined) {
      setDefaultExportSettings()
      clearSelectedDefinedExport()
    } else {
      applyExportSettingToState(newDefinedExport.data)
    }
  }

  function getSelectedDefinedExportOptions(): DefinedExportOption[] {
    return [
      {
        value: null,
        label: t('None'),
      },
      ...state.definedExports,
    ]
  }

  function clearSelectedDefinedExport() {
    mergeState({ selectedDefinedExport: null })
  }

  function onSelectedRowsChange(newRowsArray: MultiCheckboxItem[]) {
    clearSelectedDefinedExport()
    const newSelectedRows = new Set<string>()
    newRowsArray.forEach((item) => {
      if (item.checked) {
        newSelectedRows.add(item.path)
      }
    })
    mergeState({ selectedRows: newSelectedRows })
  }

  function selectAllRows(evt: React.TouchEvent) {
    evt.preventDefault()
    clearSelectedDefinedExport()
    mergeState({ selectedRows: new Set(getAllSelectableRows()) })
  }

  function clearSelectedRows(evt: React.TouchEvent) {
    evt.preventDefault()
    clearSelectedDefinedExport()
    mergeState({ selectedRows: new Set() })
  }

  function toggleAdvancedView(evt: React.TouchEvent) {
    evt.preventDefault()
    mergeState({ isAdvancedViewVisible: !stateRef.current.isAdvancedViewVisible })
  }

  function generateExportName() {
    return `Export ${formatTimeDate(new Date().toString())}`
  }

  function onSubmit(evt: React.FormEvent) {
    evt.preventDefault()

    const currentState = stateRef.current
    const payload: ExportSettingRequest = {
      name: '',
      export_settings: {
        fields_from_all_versions: currentState.isIncludeAllVersionsEnabled,
        fields: [],
        group_sep: currentState.groupSeparator,
        hierarchy_in_labels: currentState.isIncludeGroupsEnabled,
        lang: currentState.selectedExportFormat.value,
        multiple_select: currentState.selectedExportMultiple.value,
        type: currentState.selectedExportType.value,
        query: createMongoDateQuery(),
      },
    }

    if (currentState.selectedExportType.value === EXPORT_TYPES.geojson.value) {
      payload.export_settings.flatten = currentState.isFlattenGeoJsonEnabled
    }

    if (currentState.selectedExportType.value === EXPORT_TYPES.xls.value) {
      payload.export_settings.xls_types_as_text = currentState.isXlsTypesAsTextEnabled
    }

    if (
      currentState.selectedExportType.value === EXPORT_TYPES.xls.value ||
      currentState.selectedExportType.value === EXPORT_TYPES.csv.value
    ) {
      payload.export_settings.include_media_url = currentState.isIncludeMediaUrlEnabled
    }

    if (currentState.isSaveCustomExportEnabled) {
      payload.name = currentState.customExportName || generateExportName()
    }

    if (currentState.isCustomSelectionEnabled) {
      payload.export_settings.fields = Array.from(currentState.selectedRows)
    }

    const foundDefinedExport = currentState.definedExports.find(
      (definedExport) => definedExport.data?.name === payload.name,
    )

    if (foundDefinedExport?.data) {
      recordEntries(foundDefinedExport.data.export_settings).forEach(([key, value]) => {
        if (!Object.prototype.hasOwnProperty.call(payload.export_settings, key)) {
          payload.export_settings[key] = value as never
        }
      })
    }

    mergeState({ isPending: true })

    if (typeof clearScheduledExportRef.current === 'function') {
      clearScheduledExportRef.current()
    }

    if (currentState.selectedDefinedExport !== null || !userCan(PERMISSIONS_CODENAMES.manage_asset, props.asset)) {
      handleScheduledExport(payload)
    } else if (foundDefinedExport) {
      clearScheduledExportRef.current = actions.exports.updateExportSetting.completed.listen(handleScheduledExport)
      actions.exports.updateExportSetting(props.asset.uid, foundDefinedExport.data?.uid, payload)
    } else {
      clearScheduledExportRef.current = actions.exports.createExportSetting.completed.listen(handleScheduledExport)
      actions.exports.createExportSetting(props.asset.uid, payload)
    }
  }

  function getQuestionsList(): Array<{ label: string; path: string; parents: string[] }> {
    const selectableRows = Array.from(getAllSelectableRows())

    const flatQuestionsList = getFlatQuestionsList(
      props.asset.content?.survey || [],
      state.selectedExportFormat?.langIndex,
      true,
    )

    return selectableRows.map((selectableRow) => {
      const foundFlatQuestion = flatQuestionsList.find((flatQuestion) => flatQuestion.path === selectableRow)

      if (foundFlatQuestion) {
        return {
          label: foundFlatQuestion.label,
          path: foundFlatQuestion.path,
          parents: foundFlatQuestion.parents,
        }
      }

      if (selectableRow.startsWith(SUPPLEMENTAL_DETAILS_PROP)) {
        return {
          label: getColumnLabel(props.asset, selectableRow, false, state.selectedExportFormat?.langIndex),
          path: selectableRow,
          parents: [],
        }
      }

      return {
        label: selectableRow,
        path: selectableRow,
        parents: [],
      }
    })
  }

  function renderRowsSelector() {
    const rows = getQuestionsList().map((row) => {
      let checkboxLabel = ''
      if (state.selectedExportFormat.value === EXPORT_FORMATS._xml.value) {
        checkboxLabel = row.path
      } else if (row.parents?.length >= 1) {
        checkboxLabel = row.parents.join(' / ') + ' / ' + row.label
      } else {
        checkboxLabel = row.label
      }

      return {
        checked: state.selectedRows.has(row.path) || row.path === ADDITIONAL_SUBMISSION_PROPS._uuid,
        disabled: !state.isCustomSelectionEnabled || row.path === ADDITIONAL_SUBMISSION_PROPS._uuid,
        label: checkboxLabel,
        path: row.path,
      }
    })

    return <MultiCheckbox type='frame' items={rows} onChange={onSelectedRowsChange} />
  }

  function renderAdvancedView() {
    const includeAllVersionsLabel = (
      <span>
        {t('Include fields from all ##count## versions').replace(
          '##count##',
          String(props.asset.deployed_versions?.count),
        )}
      </span>
    )

    const exportMultipleOptions = [
      EXPORT_MULTIPLE_OPTIONS.details,
      EXPORT_MULTIPLE_OPTIONS.summary,
      EXPORT_MULTIPLE_OPTIONS.both,
    ]
    const template = t('Export ##SELECT_MANY## questions as…')
    const [firstPart, nextPart] = template.split('##SELECT_MANY##')

    return (
      <bem.ProjectDownloads__advancedView>
        <bem.ProjectDownloads__column m='left'>
          <label className='project-downloads__column-row'>
            <bem.ProjectDownloads__title>
              {firstPart}
              <em>{t('Select Many')}</em>
              {nextPart}
            </bem.ProjectDownloads__title>

            <Select
              value={state.selectedExportMultiple}
              options={exportMultipleOptions}
              onChange={(newValue) => {
                if (newValue !== null) {
                  clearSelectedDefinedExport()
                  mergeState({ selectedExportMultiple: newValue })
                }
              }}
              className='kobo-select'
              classNamePrefix='kobo-select'
              menuPlacement='auto'
              placeholder={t('Select…')}
              isSearchable={false}
            />
          </label>

          <bem.ProjectDownloads__columnRow>
            <Checkbox
              checked={state.isIncludeAllVersionsEnabled}
              onChange={(newValue) => {
                clearSelectedDefinedExport()
                mergeState({ isIncludeAllVersionsEnabled: newValue })
              }}
              label={includeAllVersionsLabel}
            />
          </bem.ProjectDownloads__columnRow>

          <bem.ProjectDownloads__columnRow>
            <Checkbox
              checked={state.isIncludeGroupsEnabled}
              onChange={(newValue) => {
                clearSelectedDefinedExport()
                mergeState({ isIncludeGroupsEnabled: newValue })
              }}
              label={t('Include groups in headers')}
            />

            <div className='project-downloads-group-textbox'>
              <span
                className={cx('project-downloads-group-textbox__title', {
                  'project-downloads-group-textbox__title--disabled': !state.isIncludeGroupsEnabled,
                })}
              >
                {t('Group separator')}
              </span>

              <TextBox
                disabled={!state.isIncludeGroupsEnabled}
                value={state.groupSeparator}
                onChange={(newValue) => {
                  clearSelectedDefinedExport()
                  mergeState({ groupSeparator: newValue })
                }}
              />
            </div>
          </bem.ProjectDownloads__columnRow>

          {state.selectedExportType.value === EXPORT_TYPES.geojson.value && (
            <bem.ProjectDownloads__columnRow>
              <Checkbox
                checked={state.isFlattenGeoJsonEnabled}
                onChange={(newValue) => {
                  clearSelectedDefinedExport()
                  mergeState({ isFlattenGeoJsonEnabled: newValue })
                }}
                label={t('Flatten GeoJSON')}
              />
            </bem.ProjectDownloads__columnRow>
          )}

          {state.selectedExportType.value === EXPORT_TYPES.xls.value && (
            <bem.ProjectDownloads__columnRow>
              <Checkbox
                checked={state.isXlsTypesAsTextEnabled}
                onChange={(newValue) => {
                  clearSelectedDefinedExport()
                  mergeState({ isXlsTypesAsTextEnabled: newValue })
                }}
                label={t('Store date and number responses as text')}
              />
            </bem.ProjectDownloads__columnRow>
          )}

          {(state.selectedExportType.value === EXPORT_TYPES.xls.value ||
            state.selectedExportType.value === EXPORT_TYPES.csv.value) && (
            <bem.ProjectDownloads__columnRow>
              <Checkbox
                checked={state.isIncludeMediaUrlEnabled}
                onChange={(newValue) => {
                  clearSelectedDefinedExport()
                  mergeState({ isIncludeMediaUrlEnabled: newValue })
                }}
                label={t('Include media URLs')}
              />
            </bem.ProjectDownloads__columnRow>
          )}

          <bem.ProjectDownloads__columnRow>
            <Checkbox
              checked={state.isSaveCustomExportEnabled}
              onChange={(newValue) => {
                clearSelectedDefinedExport()
                mergeState({ isSaveCustomExportEnabled: newValue })
              }}
              label={t('Save selection as…')}
            />

            <TextBox
              disabled={!state.isSaveCustomExportEnabled}
              value={state.customExportName}
              onChange={(newValue) => {
                clearSelectedDefinedExport()
                mergeState({ customExportName: newValue })
              }}
              placeholder={t('Name your export settings')}
              className='custom-export-name-textbox'
            />
          </bem.ProjectDownloads__columnRow>

          <bem.ProjectDownloads__columnRow>
            <Checkbox
              checked={state.isDateEnabled}
              onChange={(newValue) => {
                clearSelectedDefinedExport()
                mergeState({ isDateEnabled: newValue })
              }}
              label={t('Date range')}
            />

            <div className='project-downloads__date-wrapper'>
              <label>
                {t('Between')}
                <input
                  type='date'
                  className='project-downloads__date-selector'
                  disabled={!state.isDateEnabled}
                  onChange={(e) => {
                    mergeState({ startDate: e.currentTarget.value })
                  }}
                />
              </label>
              <label>
                {t('and')}
                <input
                  type='date'
                  className='project-downloads__date-selector'
                  disabled={!state.isDateEnabled}
                  onChange={(e) => {
                    mergeState({ endDate: e.currentTarget.value })
                  }}
                />
              </label>
            </div>
          </bem.ProjectDownloads__columnRow>
        </bem.ProjectDownloads__column>

        <bem.ProjectDownloads__column m='right'>
          <bem.ProjectDownloads__columnRow m='rows-selector-header'>
            <ToggleSwitch
              checked={state.isCustomSelectionEnabled}
              onChange={(newValue) => {
                clearSelectedDefinedExport()
                mergeState({ isCustomSelectionEnabled: newValue })
              }}
              label={t('Select questions to be exported')}
            />

            <Button
              type='secondary'
              size='s'
              isDisabled={!state.isCustomSelectionEnabled || state.selectedRows.size === state.selectableRowsCount}
              onClick={selectAllRows}
              label={t('Select all')}
            />

            <span className='project-downloads__vr' />

            <Button
              type='secondary'
              size='s'
              isDisabled={!state.isCustomSelectionEnabled || state.selectedRows.size <= 1}
              onClick={clearSelectedRows}
              label={t('Deselect all')}
            />
          </bem.ProjectDownloads__columnRow>

          {renderRowsSelector()}
        </bem.ProjectDownloads__column>

        <hr />
      </bem.ProjectDownloads__advancedView>
    )
  }

  useEffect(() => {
    const unlisteners = [
      exportsStore.listen(onExportsStoreChange, null),
      actions.exports.createExport.completed.listen(onCreateExportCompleted),
      actions.exports.createExport.failed.listen(onCreateExportFailed),
      actions.exports.getExportSettings.completed.listen(onGetExportSettingsCompleted),
      actions.exports.updateExportSetting.completed.listen(() => fetchExportSettings(true)),
      actions.exports.createExportSetting.completed.listen(() => fetchExportSettings(true)),
      actions.exports.deleteExportSetting.completed.listen(onDeleteExportSettingCompleted),
    ]

    fetchExportSettings(true)

    return () => {
      unlisteners.forEach((unlisten) => {
        unlisten()
      })

      if (typeof clearScheduledExportRef.current === 'function') {
        clearScheduledExportRef.current()
      }
    }
  }, [props.asset.uid])

  const formClassNames = ['project-downloads__exports-creator']
  if (!state.isComponentReady) {
    formClassNames.push('project-downloads__exports-creator--loading')
  }

  const exportFormatOptions = getExportFormatOptions(props.asset)

  return (
    <bem.FormView__cell m={['box', 'padding']}>
      <bem.FormView__form className={formClassNames.join(' ')}>
        <bem.ProjectDownloads__selectorRow>
          <ExportTypeSelector />

          <label>
            <bem.ProjectDownloads__title>{t('Value and header format')}</bem.ProjectDownloads__title>

            <Select
              value={state.selectedExportFormat}
              options={exportFormatOptions}
              onChange={(newValue) => {
                if (newValue !== null) {
                  clearSelectedDefinedExport()
                  mergeState({ selectedExportFormat: newValue })
                }
              }}
              className='kobo-select'
              classNamePrefix='kobo-select'
              menuPlacement='auto'
              isSearchable={false}
            />
          </label>
        </bem.ProjectDownloads__selectorRow>

        <Button
          type='text'
          size='s'
          onClick={toggleAdvancedView}
          label={t('Advanced options')}
          endIcon={state.isAdvancedViewVisible ? 'angle-up' : 'angle-down'}
          className='project-downloads__advanced-button'
        />

        <hr />

        {state.isAdvancedViewVisible && renderAdvancedView()}

        <bem.ProjectDownloads__submitRow>
          <bem.ProjectDownloads__exportsSelector>
            {state.definedExports.length >= 1 && (
              <React.Fragment>
                <label>
                  <bem.ProjectDownloads__title>{t('Apply saved export settings')}</bem.ProjectDownloads__title>

                  <Select
                    isLoading={state.isUpdatingDefinedExportsList}
                    value={state.selectedDefinedExport}
                    options={getSelectedDefinedExportOptions()}
                    onChange={onSelectedDefinedExportChange}
                    className='kobo-select'
                    classNamePrefix='kobo-select'
                    menuPlacement='auto'
                    placeholder={t('No export settings selected')}
                  />
                </label>

                {state.selectedDefinedExport && userCan(PERMISSIONS_CODENAMES.manage_asset, props.asset) && (
                  <Button
                    type='secondary-danger'
                    size='m'
                    onClick={(evt: React.TouchEvent) => {
                      evt.preventDefault()
                      if (state.selectedDefinedExport?.data?.uid) {
                        safeDeleteExportSetting(state.selectedDefinedExport.data.uid)
                      }
                    }}
                    startIcon='trash'
                    className='project-downloads__delete-settings-button'
                  />
                )}
              </React.Fragment>
            )}
          </bem.ProjectDownloads__exportsSelector>

          <Button
            type='primary'
            size='l'
            isSubmit
            onClick={onSubmit}
            isDisabled={(state.isCustomSelectionEnabled && state.selectedRows.size === 0) || state.isPending}
            label={t('Export')}
          />
        </bem.ProjectDownloads__submitRow>
      </bem.FormView__form>
    </bem.FormView__cell>
  )
}

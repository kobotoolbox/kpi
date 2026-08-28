import { Loader, Switch } from '@mantine/core'
import * as Sentry from '@sentry/react'
import { IconTrashFilled } from '@tabler/icons-react'
import cx from 'classnames'
import React, { useEffect, useRef, useState } from 'react'
import { type OrvalFetchError, getApiErrorMessage } from '#/api/onErrorDefaultHandler'
import {
  useAssetsExportSettingsCreate,
  useAssetsExportSettingsList,
  useAssetsExportSettingsPartialUpdate,
  useAssetsExportsCreate,
} from '#/api/react-query/survey-data'
import { getFlatQuestionsList, getSurveyFlatPaths, injectSupplementalRowsIntoListOfRows } from '#/assetUtils'
import bem from '#/bem'
import Select from '#/components/common/Select'
import TextInput from '#/components/common/TextInput'
import Button from '#/components/common/button'
import Checkbox from '#/components/common/checkbox'
import MultiCheckbox, { type MultiCheckboxItem } from '#/components/common/multiCheckbox'
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
import {
  type ExportFormatOption,
  getContextualDefaultExportFormat,
  getExportFormatOptions,
  preserveApiOnlySettings,
} from '#/components/projectDownloads/exportsUtils'
import { openDeleteExportSettingModal } from '#/components/projectDownloads/openDeleteExportSettingModal'
import { getColumnLabel, orderColumns } from '#/components/submissions/tableUtils'
import { ADDITIONAL_SUBMISSION_PROPS, SUPPLEMENTAL_DETAILS_PROP } from '#/constants'
import type { AssetResponse, ExportSetting, ExportSettingRequest, MongoQuery } from '#/dataInterface'
import { createDateQuery, formatTimeDate, notify, recordKeys, recordValues } from '#/utils'
import ActionIcon from '../common/ActionIcon'

const NAMELESS_EXPORT_NAME = t('Latest unsaved settings')

interface ProjectExportsCreatorProps {
  asset: AssetResponse
  selectedExportType: ExportTypeDefinition
  setSelectedExportType: (newType: ExportTypeDefinition) => void
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
  /** The export setting's `uid`. */
  value: string
  label: string
  data: ExportSetting
}

/**
 * This is component responsible for creating and saving export settings. It can
 * also request a new download from backend.
 *
 * NOTE: we use a nameless export setting to keep last used export settings that
 * weren't saved as named custom setting.
 */
export default function ProjectExportsCreator(props: ProjectExportsCreatorProps) {
  const exportSettingsQuery = useAssetsExportSettingsList(props.asset.uid)
  const createExportMutation = useAssetsExportsCreate()
  const createExportSettingMutation = useAssetsExportSettingsCreate()
  const updateExportSettingMutation = useAssetsExportSettingsPartialUpdate()
  // This guard lets us auto-apply the latest saved settings once, without
  // overriding user edits on every background refetch.
  const shouldPreselectLastSettingsRef = useRef(true)

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

    // Order these the same way as Data Table does (see `orderColumns`), so that
    // users pick fields from a familiar looking list. Note that the list itself
    // is wider than Data Table's on purpose - some props are worth exporting
    // even though we never show them as columns.
    return new Set(orderColumns(props.asset, Array.from(allRows)))
  }

  function getInitialState(): ProjectExportsCreatorState {
    const newState: ProjectExportsCreatorState = {
      isComponentReady: false,
      isPending: false,
      selectedExportType: props.selectedExportType,
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
  // Async callbacks (submit/polling/dialog actions) can run after React state
  // updates. Keep a ref in sync so those callbacks always read current values.
  const stateRef = useRef(state)

  function mergeState(newState: Partial<ProjectExportsCreatorState>) {
    setState((currentState) => {
      const nextState = { ...currentState, ...newState }
      stateRef.current = nextState
      return nextState
    })
  }

  function createMongoDateQuery(): MongoQuery {
    if ((stateRef.current.startDate || stateRef.current.endDate) && stateRef.current.isDateEnabled) {
      return { $and: createDateQuery(stateRef.current.startDate, stateRef.current.endDate) }
    }

    return {}
  }

  function setDefaultExportSettings() {
    props.setSelectedExportType(DEFAULT_EXPORT_SETTINGS.EXPORT_TYPE)
    mergeState({
      selectedExportType: DEFAULT_EXPORT_SETTINGS.EXPORT_TYPE,
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

  function applyExportSettingToState(data: ExportSetting) {
    const exportTypeName = data.export_settings.type

    const exportType = EXPORT_TYPES[exportTypeName]

    // If the saved export type is still invalid after remapping, fall back to default
    if (!exportType) {
      console.warn(`Invalid export type "${data.export_settings.type}" in saved settings, using default settings`)
      setDefaultExportSettings()
      return
    }

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
      selectedExportType: exportType,
      selectedExportFormat,
      groupSeparator: data.export_settings.group_sep,
      selectedExportMultiple: EXPORT_MULTIPLE_OPTIONS[data.export_settings.multiple_select],
      isIncludeGroupsEnabled: data.export_settings.hierarchy_in_labels,
      isIncludeAllVersionsEnabled: data.export_settings.fields_from_all_versions,
      isSaveCustomExportEnabled: typeof data.name === 'string' && data.name.length >= 1,
      customExportName: data.name,
      isCustomSelectionEnabled: customSelectionEnabled,
      // Only some export types store these, so a setting saved for another type
      // leaves them undefined - use the defaults instead.
      isFlattenGeoJsonEnabled: data.export_settings.flatten ?? DEFAULT_EXPORT_SETTINGS.FLATTEN_GEO_JSON,
      isXlsTypesAsTextEnabled: data.export_settings.xls_types_as_text ?? DEFAULT_EXPORT_SETTINGS.XLS_TYPES_AS_TEXT,
      isIncludeMediaUrlEnabled: data.export_settings.include_media_url ?? DEFAULT_EXPORT_SETTINGS.INCLUDE_MEDIA_URL,
      selectedRows: newSelectedRows,
    }

    if (newStateObj.selectedRows?.size === 0) {
      newStateObj.selectedRows = new Set(getAllSelectableRows())
    }

    stateRef.current.definedExports.forEach((definedExport) => {
      if (definedExport.data.name === data.name) {
        newStateObj.selectedDefinedExport = definedExport
      }
    })

    props.setSelectedExportType(exportType)

    mergeState(newStateObj)
  }

  async function createExportWithSettings(response: ExportSettingRequest) {
    try {
      await createExportMutation.mutateAsync({
        uidAsset: props.asset.uid,
        data: response.export_settings as never,
      })
    } catch (error: unknown) {
      const errorMessage = getApiErrorMessage(error as OrvalFetchError) || t('Failed to create export')
      notify(errorMessage, 'error')
      Sentry.captureMessage(errorMessage)
      throw new Error(errorMessage)
    }
  }

  async function fetchExportSettings(preselectLastSettings = false) {
    shouldPreselectLastSettingsRef.current = preselectLastSettings
    mergeState({ isUpdatingDefinedExportsList: true })
    await exportSettingsQuery.refetch()
  }

  function safeDeleteExportSetting(exportSettingUid: string, exportSettingName: string) {
    openDeleteExportSettingModal(props.asset.uid, exportSettingUid, exportSettingName, async () => {
      clearSelectedDefinedExport()
      await fetchExportSettings()
    })
  }

  function onSelectedDefinedExportChange(newValue: string | null) {
    const newDefinedExport = state.definedExports.find((definedExport) => definedExport.value === newValue)

    // Nothing found means the "None" option was picked, so back to defaults.
    if (newDefinedExport === undefined) {
      setDefaultExportSettings()
      clearSelectedDefinedExport()
    } else {
      applyExportSettingToState(newDefinedExport.data)
    }
  }

  function getSelectedDefinedExportOptions() {
    return [
      {
        value: '',
        label: t('None'),
      },
      ...state.definedExports.map(({ value, label }) => ({ value, label })),
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

  async function onSubmit(evt: React.FormEvent) {
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
      currentState.selectedExportType.value === EXPORT_TYPES.csv.value ||
      currentState.selectedExportType.value === EXPORT_TYPES.geojson.value
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
      (definedExport) => definedExport.data.name === payload.name,
    )

    // We are about to overwrite that saved setting with this payload, so first
    // take over the options it holds that this form has no field for.
    if (foundDefinedExport) {
      payload.export_settings = preserveApiOnlySettings(
        payload.export_settings,
        foundDefinedExport.data.export_settings,
      )
    }

    mergeState({ isPending: true })

    try {
      if (currentState.selectedDefinedExport !== null || !userCan(PERMISSIONS_CODENAMES.manage_asset, props.asset)) {
        await createExportWithSettings(payload)
      } else if (foundDefinedExport?.data.uid) {
        try {
          await updateExportSettingMutation.mutateAsync({
            uidAsset: props.asset.uid,
            uidExportSetting: foundDefinedExport.data.uid,
            data: payload as never,
          })
        } catch {
          notify(t('Failed to update export setting'), 'error')
          throw new Error('update export setting failed')
        }

        await fetchExportSettings(true)
        await createExportWithSettings(payload)
      } else {
        try {
          await createExportSettingMutation.mutateAsync({
            uidAsset: props.asset.uid,
            data: payload as never,
          })
        } catch {
          notify(t('Failed to create export setting'), 'error')
          throw new Error('create export setting failed')
        }

        await fetchExportSettings(true)
        await createExportWithSettings(payload)
      }
    } catch {
      // Error notifications are handled at mutation call sites.
    } finally {
      mergeState({ isPending: false })
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
              value={state.selectedExportMultiple.value}
              data={exportMultipleOptions.map(({ value, label }) => ({ value, label }))}
              onChange={(newValue) => {
                if (newValue !== null) {
                  clearSelectedDefinedExport()
                  mergeState({ selectedExportMultiple: EXPORT_MULTIPLE_OPTIONS[newValue] })
                }
              }}
              searchable={false}
              clearable={false}
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

              <TextInput
                disabled={!state.isIncludeGroupsEnabled}
                value={state.groupSeparator}
                onChange={(evt) => {
                  clearSelectedDefinedExport()
                  mergeState({ groupSeparator: evt.currentTarget.value })
                }}
                size='sm'
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
            state.selectedExportType.value === EXPORT_TYPES.csv.value ||
            state.selectedExportType.value === EXPORT_TYPES.geojson.value) && (
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

            <TextInput
              disabled={!state.isSaveCustomExportEnabled}
              value={state.customExportName}
              onChange={(evt) => {
                clearSelectedDefinedExport()
                mergeState({ customExportName: evt.currentTarget.value })
              }}
              placeholder={t('Name your export settings')}
              className='custom-export-name-textbox'
              size='sm'
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
            <Switch
              checked={state.isCustomSelectionEnabled}
              onChange={(event) => {
                clearSelectedDefinedExport()
                mergeState({ isCustomSelectionEnabled: event.currentTarget.checked })
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
    if (props.selectedExportType.value !== stateRef.current.selectedExportType.value) {
      mergeState({
        selectedExportType: props.selectedExportType,
        isSaveCustomExportEnabled: false,
        customExportName: '',
      })
    }
  }, [props.selectedExportType])

  useEffect(() => {
    if (exportSettingsQuery.isFetching) {
      mergeState({ isUpdatingDefinedExportsList: true })
    }
  }, [exportSettingsQuery.isFetching])

  useEffect(() => {
    if (!exportSettingsQuery.isSuccess || exportSettingsQuery.data.status !== 200) {
      return
    }

    const response = exportSettingsQuery.data.data
    const definedExports: DefinedExportOption[] = []
    response.results.forEach((result) => {
      definedExports.push({
        value: result.uid,
        label: result.name ? result.name : NAMELESS_EXPORT_NAME,
        data: result as never,
      })
    })

    mergeState({
      isUpdatingDefinedExportsList: false,
      definedExports,
    })

    if (response.count >= 1 && shouldPreselectLastSettingsRef.current) {
      applyExportSettingToState(response.results[0] as never)
    }

    shouldPreselectLastSettingsRef.current = false

    if (!stateRef.current.isComponentReady) {
      mergeState({ isComponentReady: true })
    }
  }, [exportSettingsQuery.data, exportSettingsQuery.isSuccess])

  useEffect(() => {
    if (exportSettingsQuery.isError) {
      mergeState({
        isUpdatingDefinedExportsList: false,
        isComponentReady: true,
      })
    }
  }, [exportSettingsQuery.isError])

  const formClassNames = ['project-downloads__exports-creator']
  if (!state.isComponentReady) {
    formClassNames.push('project-downloads__exports-creator--loading')
  }

  const exportFormatOptions = getExportFormatOptions(props.asset)

  return (
    <bem.FormView__cell m={['box', 'padding']}>
      <bem.FormView__form className={formClassNames.join(' ')}>
        <bem.ProjectDownloads__selectorRow>
          <ExportTypeSelector
            selectedExportType={props.selectedExportType}
            onSelectedExportTypeChange={props.setSelectedExportType}
          />

          <label>
            <bem.ProjectDownloads__title>{t('Value and header format')}</bem.ProjectDownloads__title>

            <Select
              value={state.selectedExportFormat.value}
              data={exportFormatOptions.map(({ value, label }) => ({ value, label }))}
              onChange={(newValue) => {
                const newFormat = exportFormatOptions.find((option) => option.value === newValue)
                if (newFormat !== undefined) {
                  clearSelectedDefinedExport()
                  mergeState({ selectedExportFormat: newFormat })
                }
              }}
              searchable={false}
              clearable={false}
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
                    rightSection={state.isUpdatingDefinedExportsList ? <Loader size='xs' /> : undefined}
                    value={state.selectedDefinedExport?.value ?? ''}
                    data={getSelectedDefinedExportOptions()}
                    onChange={onSelectedDefinedExportChange}
                    placeholder={t('No export settings selected')}
                    clearable={false}
                  />
                </label>

                {state.selectedDefinedExport && userCan(PERMISSIONS_CODENAMES.manage_asset, props.asset) && (
                  <ActionIcon
                    variant='danger'
                    size='lg'
                    onClick={(evt: React.MouseEvent<HTMLButtonElement>) => {
                      evt.preventDefault()
                      if (state.selectedDefinedExport?.data.uid) {
                        safeDeleteExportSetting(state.selectedDefinedExport.data.uid, state.selectedDefinedExport.label)
                      }
                    }}
                    icon={IconTrashFilled}
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
            isDisabled={state.isCustomSelectionEnabled && state.selectedRows.size === 0}
            isPending={state.isPending}
            label={t('Export')}
          />
        </bem.ProjectDownloads__submitRow>
      </bem.FormView__form>
    </bem.FormView__cell>
  )
}

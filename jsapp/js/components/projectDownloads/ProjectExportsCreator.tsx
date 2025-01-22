// Libraries
import React from 'react';
import Select from 'react-select';
import alertify from 'alertifyjs';
import bem from 'js/bem';
import cx from 'classnames';

// Partial components
import MultiCheckbox, {type MultiCheckboxItem} from 'js/components/common/multiCheckbox';
import Checkbox from 'js/components/common/checkbox';
import TextBox from 'js/components/common/textBox';
import ToggleSwitch from 'js/components/common/toggleSwitch';
import ExportTypeSelector from 'js/components/projectDownloads/ExportTypeSelector';
import Button from 'js/components/common/button';

// Stores, hooks and utilities
import {actions} from 'js/actions';
import {formatTimeDate} from 'js/utils';
import {
  type ExportFormatOption,
  getContextualDefaultExportFormat,
  getExportFormatOptions,
} from 'js/components/projectDownloads/exportsUtils';
import {
  getSurveyFlatPaths,
  getFlatQuestionsList,
  injectSupplementalRowsIntoListOfRows,
} from 'js/assetUtils';
import {getColumnLabel} from 'js/components/submissions/tableUtils';
import exportsStore from 'js/components/projectDownloads/exportsStore';
import {userCan} from 'js/components/permissions/utils';

// Constants and types
import {
  ADDITIONAL_SUBMISSION_PROPS,
  SUPPLEMENTAL_DETAILS_PROP,
} from 'js/constants';
import {PERMISSIONS_CODENAMES} from 'js/components/permissions/permConstants';
import {
  EXPORT_TYPES,
  DEFAULT_EXPORT_SETTINGS,
  EXPORT_FORMATS,
  EXPORT_MULTIPLE_OPTIONS,
  type ExportTypeDefinition,
  type ExportMultiOption,
} from 'js/components/projectDownloads/exportsConstants';
import type {
  ExportSetting,
  ExportSettingRequest,
  ExportSettingSettings,
  PaginatedResponse,
  AssetResponse,
} from 'jsapp/js/dataInterface';

const NAMELESS_EXPORT_NAME = t('Latest unsaved settings');

interface ProjectExportsCreatorProps {
  asset: AssetResponse;
}

interface ProjectExportsCreatorState {
  isComponentReady: boolean;
  // is either saving setting or creating export
  isPending: boolean;
  // selectedExportType is being handled by exportsStore to allow other
  // components to know it changed
  selectedExportType: ExportTypeDefinition;
  selectedExportFormat: ExportFormatOption;
  groupSeparator: string;
  selectedExportMultiple: ExportMultiOption;
  isIncludeGroupsEnabled: boolean;
  isIncludeAllVersionsEnabled: boolean;
  isAdvancedViewVisible: boolean;
  isSaveCustomExportEnabled: boolean;
  customExportName: string;
  isCustomSelectionEnabled: boolean;
  isFlattenGeoJsonEnabled: boolean;
  isXlsTypesAsTextEnabled: boolean;
  isIncludeMediaUrlEnabled: boolean;
  selectedRows: Set<string>;
  selectableRowsCount: number;
  selectedDefinedExport: null | DefinedExportOption;
  definedExports: DefinedExportOption[];
  isUpdatingDefinedExportsList: boolean;
}

interface DefinedExportOption {
  value: number | null;
  label: string;
  data?: ExportSetting;
}

/**
 * This is component responsible for creating and saving export settings. It can
 * also request a new download from backend.
 *
 * NOTE: we use a nameless export setting to keep last used export settings that
 * weren't saved as named custom setting.
 */
export default class ProjectExportsCreator extends React.Component<
  ProjectExportsCreatorProps,
  ProjectExportsCreatorState
> {
  constructor(props: ProjectExportsCreatorProps) {
    super(props);
    this.state = this.getInitialState();
  }

  getInitialState(): ProjectExportsCreatorState {
    const newState = {
      isComponentReady: false,
      isPending: false,
      selectedExportType: exportsStore.getExportType(),
      selectedExportFormat: getContextualDefaultExportFormat(this.props.asset),
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
    };

    const allSelectableRows = this.getAllSelectableRows();
    if (allSelectableRows) {
      newState.selectedRows = new Set(allSelectableRows);
      newState.selectableRowsCount = newState.selectedRows.size;
    }

    return newState;
  }

  private unlisteners: Function[] = [];

  private clearScheduledExport?: Function;

  componentDidMount() {
    this.unlisteners.push(
      exportsStore.listen(this.onExportsStoreChange.bind(this), this),
      actions.exports.createExport.completed.listen(this.onCreateExportCompleted.bind(this)),
      actions.exports.getExportSettings.completed.listen(this.onGetExportSettingsCompleted.bind(this)),
      actions.exports.updateExportSetting.completed.listen(this.fetchExportSettings.bind(this, true)),
      actions.exports.createExportSetting.completed.listen(this.fetchExportSettings.bind(this, true)),
      actions.exports.deleteExportSetting.completed.listen(this.onDeleteExportSettingCompleted.bind(this)),
    );

    this.fetchExportSettings(true);
  }

  componentWillUnmount() {
    this.unlisteners.forEach((clb) => {clb();});
  }

  setDefaultExportSettings() {
    exportsStore.setExportType(DEFAULT_EXPORT_SETTINGS.EXPORT_TYPE);
    this.setState({
      selectedExportFormat: getContextualDefaultExportFormat(this.props.asset),
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
      selectedRows: new Set(this.getAllSelectableRows()),
    });
  }

  onExportsStoreChange() {
    const newExportType = exportsStore.getExportType();
    if (newExportType.value !== this.state.selectedExportType.value) {
      const newStateObj = {
        selectedExportType: newExportType,
        // when export type changes, make sure the custom export is cleared
        // to avoid users saving unwanted changes (the custom export name is not
        // visible unless Advanced View is toggled)
        isSaveCustomExportEnabled: false,
        customExportName: '',
      };

      this.setState(newStateObj);
    }
  }

  onCreateExportCompleted() {
    this.setState({isPending: false});
  }

  onGetExportSettingsCompleted(
    response: PaginatedResponse<ExportSetting>,
    passData?: {preselectLastSettings?: boolean}
  ) {
    // we need to prepare the results to be displayed in Select
    const definedExports: DefinedExportOption[] = [];
    response.results.forEach((result, index) => {
      definedExports.push({
        value: index,
        label: result.name ? result.name : NAMELESS_EXPORT_NAME,
        data: result,
      });
    });

    this.setState({
      isUpdatingDefinedExportsList: false,
      definedExports: definedExports,
    });

    // load last saved settings
    if (response.count >= 1 && passData?.preselectLastSettings) {
      this.applyExportSettingToState(response.results[0]);
    }

    if (!this.state.isComponentReady) {
      this.setState({isComponentReady: true});
    }
  }

  onDeleteExportSettingCompleted() {
    this.clearSelectedDefinedExport();
    this.fetchExportSettings();
  }

  /** Returns a simple list of paths for all columns. */
  getAllSelectableRows() {
    let allRows: Set<string> = new Set();
    if (this.props.asset?.content?.survey) {
      const flatPaths = getSurveyFlatPaths(
        this.props.asset.content.survey,
        false,
        true
      );
      Object.values(flatPaths).forEach((path) => {allRows.add(path);});
      Object.keys(ADDITIONAL_SUBMISSION_PROPS).forEach((submissionProp) => {
        allRows.add(submissionProp);
      });
    }

    allRows = new Set(
      injectSupplementalRowsIntoListOfRows(this.props.asset, allRows)
    );

    return allRows;
  }

  /**
   * Used when update/create export settings call goes through to make a next
   * call to create an export from this settings.
   * We did not want to make export from every update/create response to make
   * sure the export was actually wanted.
   */
  handleScheduledExport(response: ExportSettingRequest) {
    if (typeof this.clearScheduledExport === 'function') {
      this.clearScheduledExport();
    }

    this.setState({isPending: true});

    const exportParams = response.export_settings;
    actions.exports.createExport(this.props.asset.uid, exportParams);
  }

  /**
   * @param {boolean} preselectLastSettings - wheter to make the last saved
   * settings selected in the dropdown after fetching data
   */
  fetchExportSettings(preselectLastSettings = false) {
    this.setState({isUpdatingDefinedExportsList: true});
    actions.exports.getExportSettings(this.props.asset.uid, {preselectLastSettings});
  }

  safeDeleteExportSetting(exportSettingUid: string) {
    const dialog = alertify.dialog('confirm');
    const opts = {
      title: t('Delete export settings?'),
      message: t('Are you sure you want to delete this settings? This action is not reversible.'),
      labels: {ok: t('Delete'), cancel: t('Cancel')},
      onok: () => {
        actions.exports.deleteExportSetting(
          this.props.asset.uid,
          exportSettingUid
        );
      },
      oncancel: () => {dialog.destroy();},
    };
    dialog.set(opts).show();
  }

  onSelectedDefinedExportChange(newDefinedExport: DefinedExportOption | null) {
    if (
      newDefinedExport === null ||
      newDefinedExport.value === null ||
      newDefinedExport.data === undefined
    ) {
      this.setDefaultExportSettings();
      this.clearSelectedDefinedExport();
    } else {
      this.applyExportSettingToState(newDefinedExport.data);
    }
  }

  getSelectedDefinedExportOptions(): DefinedExportOption[] {
    return [
      {
        value: null,
        label: t('None'),
      },
      ...this.state.definedExports,
    ];
  }

  /**
   * FYI changing anything in the form should clear the selected defined export
   */
  clearSelectedDefinedExport() {
    this.setState({selectedDefinedExport: null});
  }

  onSelectedRowsChange(newRowsArray: MultiCheckboxItem[]) {
    this.clearSelectedDefinedExport();
    const newSelectedRows = new Set<string>();
    newRowsArray.forEach((item) => {
      if (item.checked) {
        newSelectedRows.add(item.path);
      }
    });
    this.setState({selectedRows: newSelectedRows});
  }

  selectAllRows(evt: React.TouchEvent) {
    evt.preventDefault();
    this.clearSelectedDefinedExport();
    this.setState({selectedRows: new Set(this.getAllSelectableRows())});
  }

  clearSelectedRows(evt: React.TouchEvent) {
    evt.preventDefault();
    this.clearSelectedDefinedExport();
    this.setState({selectedRows: new Set()});
  }

  toggleAdvancedView(evt: React.TouchEvent) {
    evt.preventDefault();
    this.setState({isAdvancedViewVisible: !this.state.isAdvancedViewVisible});
  }

  applyExportSettingToState(data: ExportSetting) {
    // this silently sets exportsStore value to current one
    exportsStore.setExportType(EXPORT_TYPES[data.export_settings.type], false);

    const exportFormatOptions = getExportFormatOptions(this.props.asset);
    let selectedExportFormat = exportFormatOptions.find((option) =>
      option.value === data.export_settings.lang
    );

    // If saved export lang option doesn't exist anymore select default one
    if (!selectedExportFormat) {
      selectedExportFormat = getContextualDefaultExportFormat(this.props.asset);
    }

    // Select custom export toggle if not all rows are selected
    // but only if at least one is selected
    const customSelectionEnabled = Boolean(
      data.export_settings.fields?.length &&
      this.state.selectableRowsCount !== data.export_settings.fields.length
    );

    const newSelectedRows = new Set(data.export_settings.fields);

    const newStateObj: Partial<ProjectExportsCreatorState> = {
      selectedExportType: EXPORT_TYPES[data.export_settings.type],
      selectedExportFormat: selectedExportFormat,
      groupSeparator: data.export_settings.group_sep,
      selectedExportMultiple: EXPORT_MULTIPLE_OPTIONS[data.export_settings.multiple_select],
      isIncludeGroupsEnabled: data.export_settings.hierarchy_in_labels,
      isIncludeAllVersionsEnabled: data.export_settings.fields_from_all_versions,
      // check whether a custom name was given
      isSaveCustomExportEnabled: typeof data.name === 'string' && data.name.length >= 1,
      customExportName: data.name,
      isCustomSelectionEnabled: customSelectionEnabled,
      isFlattenGeoJsonEnabled: data.export_settings.flatten,
      isXlsTypesAsTextEnabled: data.export_settings.xls_types_as_text,
      isIncludeMediaUrlEnabled: data.export_settings.include_media_url,
      selectedRows: newSelectedRows,
    };

    // if all rows are selected then fields will be empty, so we need to select all checkboxes manually
    if (newStateObj.selectedRows?.size === 0) {
      newStateObj.selectedRows = new Set(this.getAllSelectableRows());
    }

    // select existing item from the dropdown
    this.state.definedExports.forEach((definedExport) => {
      if (definedExport.data?.name === data.name) {
        newStateObj.selectedDefinedExport = definedExport;
      }
    });

    if (newStateObj.selectedExportType) {
      exportsStore.setExportType(newStateObj.selectedExportType);
    }

    this.setState(newStateObj as ProjectExportsCreatorState);
  }

  onSubmit(evt: React.FormEvent) {
    evt.preventDefault();

    const payload: ExportSettingRequest = {
      name: '',
      export_settings: {
        fields_from_all_versions: this.state.isIncludeAllVersionsEnabled,
        fields: [],
        group_sep: this.state.groupSeparator,
        hierarchy_in_labels: this.state.isIncludeGroupsEnabled,
        lang: this.state.selectedExportFormat.value,
        multiple_select: this.state.selectedExportMultiple.value,
        type: this.state.selectedExportType.value,
      },
    };

    // flatten is only for GeoJSON
    if (this.state.selectedExportType.value === EXPORT_TYPES.geojson.value) {
      payload.export_settings.flatten = this.state.isFlattenGeoJsonEnabled;
    }

    // xls_types_as_text is only for xls
    if (this.state.selectedExportType.value === EXPORT_TYPES.xls.value) {
      payload.export_settings.xls_types_as_text = this.state.isXlsTypesAsTextEnabled;
    }

    // include_media_url is only for xls and csv
    if (this.state.selectedExportType.value === EXPORT_TYPES.xls.value ||
        this.state.selectedExportType.value === EXPORT_TYPES.csv.value
    ) {
      payload.export_settings.include_media_url = this.state.isIncludeMediaUrlEnabled;
    }

    // if custom export is enabled, but there is no name provided
    // we generate a name for export ourselves
    if (this.state.isSaveCustomExportEnabled) {
      payload.name = this.state.customExportName || this.generateExportName();
    }

    // unless custom selection is enabled, we send empty fields (it means "all
    // fields" for backend); otherwise we send the selected rows
    if (this.state.isCustomSelectionEnabled) {
      payload.export_settings.fields = Array.from(this.state.selectedRows);
    }

    const foundDefinedExport = this.state.definedExports.find((definedExport) =>
      definedExport.data?.name === payload.name
    );

    // API allows for more options than our UI is handling at this moment, so we
    // need to make sure we are not losing some settings when patching.
    if (foundDefinedExport?.data) {
      Object.entries(foundDefinedExport.data.export_settings).forEach(([key, value]) => {
        if (!Object.prototype.hasOwnProperty.call(payload.export_settings, key)) {
          // TODO: find a TS way that is less hacky than this
          payload.export_settings[key as keyof ExportSettingSettings] = value as never;
        }
      });
    }

    this.setState({isPending: true});

    if (typeof this.clearScheduledExport === 'function') {
      this.clearScheduledExport();
    }

    // Case 1: Don't need to save the export if currently selected a saved one,
    // so we get directly to export creation.
    // Case 2: Also omit saving if user doesn't have permissions to save.
    if (
      this.state.selectedDefinedExport !== null ||
      !userCan(PERMISSIONS_CODENAMES.manage_asset, this.props.asset)
    ) {
      this.handleScheduledExport(payload);
    // Case 3: There is a defined export with the same name already, so we need
    // to update it.
    } else if (foundDefinedExport) {
      this.clearScheduledExport = actions.exports.updateExportSetting.completed.listen(
        this.handleScheduledExport.bind(this)
      );
      actions.exports.updateExportSetting(
        this.props.asset.uid,
        foundDefinedExport.data?.uid,
        payload,
      );
    // Case 4: There is no defined export like this one, we need to create it.
    } else {
      this.clearScheduledExport = actions.exports.createExportSetting.completed.listen(
        this.handleScheduledExport.bind(this)
      );
      actions.exports.createExportSetting(
        this.props.asset.uid,
        payload,
      );
    }
  }

  generateExportName() {
    return `Export ${formatTimeDate((new Date()).toString())}`;
  }

  /**
   * Used to display a list of selectable columns for export.
   */
  getQuestionsList(): Array<{label: string; path: string; parents: string[]}> {
    const selectableRows = Array.from(this.getAllSelectableRows());

    const flatQuestionsList = getFlatQuestionsList(
      this.props.asset.content?.survey || [],
      this.state.selectedExportFormat?.langIndex,
      true
    );

    const output = selectableRows.map((selectableRow) => {
      const foundFlatQuestion = flatQuestionsList.find((flatQuestion) =>
        flatQuestion.path === selectableRow
      );

      if (foundFlatQuestion) {
        return {
          label: foundFlatQuestion.label,
          path: foundFlatQuestion.path,
          parents: foundFlatQuestion.parents,
        };
      } else if (selectableRow.startsWith(SUPPLEMENTAL_DETAILS_PROP)) {
        return {
          label: getColumnLabel(
            this.props.asset,
            selectableRow,
            false,
            this.state.selectedExportFormat?.langIndex
          ),
          path: selectableRow,
          parents: [],
        };
      }

      return {
        label: selectableRow,
        path: selectableRow,
        parents: [],
      };
    });

    return output;
  }

  renderRowsSelector() {
    const rows = this.getQuestionsList().map((row) => {
      let checkboxLabel = '';
      if (this.state.selectedExportFormat.value === EXPORT_FORMATS._xml.value) {
        checkboxLabel = row.path;
      } else if (row.parents?.length >= 1) {
        checkboxLabel = row.parents.join(' / ') + ' / ' + row.label;
      } else {
        checkboxLabel = row.label;
      }

      return {
        // The _uuid column is always selected and thus disabled regardless of settings.
        checked: this.state.selectedRows.has(row.path) || row.path === ADDITIONAL_SUBMISSION_PROPS._uuid,
        disabled: !this.state.isCustomSelectionEnabled || row.path === ADDITIONAL_SUBMISSION_PROPS._uuid,
        label: checkboxLabel,
        path: row.path,
      };
    });

    return (
      <MultiCheckbox
        type='frame'
        items={rows}
        onChange={this.onSelectedRowsChange.bind(this)}
      />
    );
  }

  renderAdvancedView() {
    const includeAllVersionsLabel = (
      <span>
        {t('Include fields from all ##count## versions').replace(
          '##count##',
          String(this.props.asset.deployed_versions?.count)
        )}
      </span>
    );

    // make sure the order is right, can't trust object definition ordering :)
    const exportMultipleOptions = [
      EXPORT_MULTIPLE_OPTIONS.details,
      EXPORT_MULTIPLE_OPTIONS.summary,
      EXPORT_MULTIPLE_OPTIONS.both,
    ];
    const template = t('Export ##SELECT_MANY## questions as…');
    const [firstPart, nextPart] = template.split('##SELECT_MANY##');

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
              value={this.state.selectedExportMultiple}
              options={exportMultipleOptions}
              onChange={(newValue) => {
                if (newValue !== null) {
                  this.clearSelectedDefinedExport();
                  this.setState({selectedExportMultiple: newValue});
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
              checked={this.state.isIncludeAllVersionsEnabled}
              onChange={(newValue) => {
                this.clearSelectedDefinedExport();
                this.setState({isIncludeAllVersionsEnabled: newValue});
              }}
              label={includeAllVersionsLabel}
            />
          </bem.ProjectDownloads__columnRow>

          <bem.ProjectDownloads__columnRow>
            <Checkbox
              checked={this.state.isIncludeGroupsEnabled}
              onChange={(newValue) => {
                this.clearSelectedDefinedExport();
                this.setState({isIncludeGroupsEnabled: newValue});
              }}
              label={t('Include groups in headers')}
            />

            <div className='project-downloads-group-textbox'>
              <span
                className={cx(
                  'project-downloads-group-textbox__title',
                  {'project-downloads-group-textbox__title--disabled': !this.state.isIncludeGroupsEnabled}
                )}
              >
                {t('Group separator')}
              </span>

              <TextBox
                disabled={!this.state.isIncludeGroupsEnabled}
                value={this.state.groupSeparator}
                onChange={(newValue) => {
                  this.clearSelectedDefinedExport();
                  this.setState({groupSeparator: newValue});
                }}
              />
            </div>
          </bem.ProjectDownloads__columnRow>

          {this.state.selectedExportType.value === EXPORT_TYPES.geojson.value &&
            <bem.ProjectDownloads__columnRow>
              <Checkbox
                checked={this.state.isFlattenGeoJsonEnabled}
                onChange={(newValue) => {
                  this.clearSelectedDefinedExport();
                  this.setState({isFlattenGeoJsonEnabled: newValue});
                }}
                label={t('Flatten GeoJSON')}
              />
            </bem.ProjectDownloads__columnRow>
          }

          {this.state.selectedExportType.value === EXPORT_TYPES.xls.value &&
            <bem.ProjectDownloads__columnRow>
              <Checkbox
                checked={this.state.isXlsTypesAsTextEnabled}
                onChange={(newValue) => {
                  this.clearSelectedDefinedExport();
                  this.setState({isXlsTypesAsTextEnabled: newValue});
                }}
                label={t('Store date and number responses as text')}
              />
            </bem.ProjectDownloads__columnRow>
          }

          {(this.state.selectedExportType.value === EXPORT_TYPES.xls.value ||
              this.state.selectedExportType.value === EXPORT_TYPES.csv.value) &&
            <bem.ProjectDownloads__columnRow>
              <Checkbox
                checked={this.state.isIncludeMediaUrlEnabled}
                onChange={(newValue) => {
                  this.clearSelectedDefinedExport();
                  this.setState({isIncludeMediaUrlEnabled: newValue});
                }}
                label={t('Include media URLs')}
              />
            </bem.ProjectDownloads__columnRow>
          }

          <bem.ProjectDownloads__columnRow>
            <Checkbox
              checked={this.state.isSaveCustomExportEnabled}
              onChange={(newValue) => {
                this.clearSelectedDefinedExport();
                this.setState({isSaveCustomExportEnabled: newValue});
              }}
              label={t('Save selection as…')}
            />

            <TextBox
              disabled={!this.state.isSaveCustomExportEnabled}
              value={this.state.customExportName}
              onChange={(newValue) => {
                this.clearSelectedDefinedExport();
                this.setState({customExportName: newValue});
              }}
              placeholder={t('Name your export settings')}
              className='custom-export-name-textbox'
            />
          </bem.ProjectDownloads__columnRow>
        </bem.ProjectDownloads__column>

        <bem.ProjectDownloads__column m='right'>
          <bem.ProjectDownloads__columnRow m='rows-selector-header'>
            <ToggleSwitch
              checked={this.state.isCustomSelectionEnabled}
              onChange={(newValue) => {
                this.clearSelectedDefinedExport();
                this.setState({isCustomSelectionEnabled: newValue});
              }}
              label={t('Select questions to be exported')}
            />

            <Button
              type='secondary'
              size='s'
              isDisabled={(
                !this.state.isCustomSelectionEnabled ||
                this.state.selectedRows.size === this.state.selectableRowsCount
              )}
              onClick={this.selectAllRows.bind(this)}
              label={t('Select all')}
            />

            <span className='project-downloads__vr'/>

            <Button
              type='secondary'
              size='s'
              isDisabled={(
                !this.state.isCustomSelectionEnabled ||
                // We check vs 1 as `_uuid` is always required.
                this.state.selectedRows.size <= 1
              )}
              onClick={this.clearSelectedRows.bind(this)}
              label={t('Deselect all')}
            />
          </bem.ProjectDownloads__columnRow>

          {this.renderRowsSelector()}
        </bem.ProjectDownloads__column>

        <hr />
      </bem.ProjectDownloads__advancedView>
    );
  }

  getGroupSeparatorLabel() {
    return (
      <bem.ProjectDownloads__title>
        {t('Group separator')}
      </bem.ProjectDownloads__title>
    );
  }

  render() {
    const formClassNames = ['project-downloads__exports-creator'];
    if (!this.state.isComponentReady) {
      formClassNames.push('project-downloads__exports-creator--loading');
    }

    const exportFormatOptions = getExportFormatOptions(this.props.asset);

    return (
      <bem.FormView__cell m={['box', 'padding']}>
        <bem.FormView__form className={formClassNames.join(' ')}>
          <bem.ProjectDownloads__selectorRow>
            <ExportTypeSelector/>

            <label>
              <bem.ProjectDownloads__title>
                {t('Value and header format')}
              </bem.ProjectDownloads__title>

              <Select
                value={this.state.selectedExportFormat}
                options={exportFormatOptions}
                onChange={(newValue) => {
                  if (newValue !== null) {
                    this.clearSelectedDefinedExport();
                    this.setState({selectedExportFormat: newValue});
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
            onClick={this.toggleAdvancedView.bind(this)}
            label={t('Advanced options')}
            endIcon={this.state.isAdvancedViewVisible ? 'angle-up' : 'angle-down'}
            className='project-downloads__advanced-button'
          />

          <hr />

          {this.state.isAdvancedViewVisible && this.renderAdvancedView()}

          <bem.ProjectDownloads__submitRow>
            <bem.ProjectDownloads__exportsSelector>
              {this.state.definedExports.length >= 1 &&
                <React.Fragment>
                  <label>
                    <bem.ProjectDownloads__title>
                      {t('Apply saved export settings')}
                    </bem.ProjectDownloads__title>

                    <Select
                      isLoading={this.state.isUpdatingDefinedExportsList}
                      value={this.state.selectedDefinedExport}
                      options={this.getSelectedDefinedExportOptions()}
                      onChange={this.onSelectedDefinedExportChange.bind(this)}
                      className='kobo-select'
                      classNamePrefix='kobo-select'
                      menuPlacement='auto'
                      placeholder={t('No export settings selected')}
                    />
                  </label>

                  {this.state.selectedDefinedExport &&
                    userCan(PERMISSIONS_CODENAMES.manage_asset, this.props.asset) &&
                      <Button
                        type='secondary-danger'
                        size='m'
                        onClick={(evt: React.TouchEvent) => {
                          evt.preventDefault();
                          if (this.state.selectedDefinedExport?.data?.uid) {
                            this.safeDeleteExportSetting(
                              this.state.selectedDefinedExport.data.uid
                            );
                          }
                        }}
                        startIcon='trash'
                        className='project-downloads__delete-settings-button'
                      />
                    }
                  </React.Fragment>
                }
              </bem.ProjectDownloads__exportsSelector>

              <Button
                type='primary'
                size='l'
                isSubmit
                onClick={this.onSubmit.bind(this)}
                isDisabled={
                  (this.state.isCustomSelectionEnabled && this.state.selectedRows.size === 0) ||
                  this.state.isPending
                }
                label={t('Export')}
              />
            </bem.ProjectDownloads__submitRow>
          </bem.FormView__form>
      </bem.FormView__cell>
    );
  }
}

import React from 'react';
import autoBind from 'react-autobind';
import Select from 'react-select';
import alertify from 'alertifyjs';
import MultiCheckbox from 'js/components/common/multiCheckbox';
import Checkbox from 'js/components/common/checkbox';
import TextBox from 'js/components/common/textBox';
import ToggleSwitch from 'js/components/common/toggleSwitch';
import bem from 'js/bem';
import {actions} from 'js/actions';
import {formatTimeDate} from 'js/utils';
import mixins from 'js/mixins';
import {
  ADDITIONAL_SUBMISSION_PROPS,
  PERMISSIONS_CODENAMES,
} from 'js/constants';
import {
  EXPORT_TYPES,
  DEFAULT_EXPORT_SETTINGS,
  EXPORT_FORMATS,
  EXPORT_MULTIPLE_OPTIONS,
} from 'js/components/projectDownloads/exportsConstants';
import {
  getContextualDefaultExportFormat,
  getExportFormatOptions,
} from 'js/components/projectDownloads/exportsUtils';
import assetUtils from 'js/assetUtils';
import exportsStore from 'js/components/projectDownloads/exportsStore';
import ExportTypeSelector from 'js/components/projectDownloads/exportTypeSelector';

const NAMELESS_EXPORT_NAME = t('Latest unsaved settings');

/**
 * This is component responsible for creating and saving export settings. It can
 * also request a new download from backend.
 *
 * @prop {object} asset
 *
 * NOTE: we use a nameless export setting to keep last used export settings that
 * weren't saved as named custom setting.
 */
export default class ProjectExportsCreator extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      isComponentReady: false,
      isPending: false, // is either saving setting or creating export
      // selectedExportType is being handled by exportsStore to allow other
      // components to know it changed
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
      isXlsTypesEnabled: DEFAULT_EXPORT_SETTINGS.XLS_TYPES,
      selectedRows: new Set(),
      selectableRowsCount: 0,
      selectedDefinedExport: null,
      definedExports: [],
      isUpdatingDefinedExportsList: false,
    };

    this.unlisteners = [];

    const allSelectableRows = this.getAllSelectableRows();
    if (allSelectableRows) {
      this.state.selectedRows = new Set(allSelectableRows);
      this.state.selectableRowsCount = this.state.selectedRows.size;
    }

    autoBind(this);
  }

  componentDidMount() {
    this.unlisteners.push(
      exportsStore.listen(this.onExportsStoreChange),
      actions.exports.getExportSettings.completed.listen(this.onGetExportSettingsCompleted),
      actions.exports.updateExportSetting.completed.listen(this.fetchExportSettings.bind(this, true)),
      actions.exports.createExportSetting.completed.listen(this.fetchExportSettings.bind(this, true)),
      actions.exports.deleteExportSetting.completed.listen(this.onDeleteExportSettingCompleted),
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
      isXlsTypesEnabled: DEFAULT_EXPORT_SETTINGS.XLS_TYPES,
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

  onGetExportSettingsCompleted(response, passData) {
    // we need to prepare the results to be displayed in Select
    const definedExports = [];
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

  getAllSelectableRows() {
    const allRows = new Set();
    if (this.props.asset?.content?.survey) {
      const flatPaths = assetUtils.getSurveyFlatPaths(
        this.props.asset.content.survey,
        false,
        true
      );
      Object.values(flatPaths).forEach((path) => {allRows.add(path);});
      Object.keys(ADDITIONAL_SUBMISSION_PROPS).forEach((submissionProp) => {
        allRows.add(submissionProp);
      });
    }
    return allRows;
  }

  /**
   * Used when update/create export settings call goes through to make a next
   * call to create an export from this settings.
   * We did not want to make export from every update/create response to make
   * sure the export was actually wanted.
   */
  handleScheduledExport(response) {
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

  onDeleteExportSetting(exportSettingUid, evt) {
    evt.preventDefault();

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

  onSelectedDefinedExportChange(newDefinedExport) {
    if (newDefinedExport.value === null) {
      this.setDefaultExportSettings();
      this.clearSelectedDefinedExport();
    } else {
      this.applyExportSettingToState(newDefinedExport.data);
    }
  }

  getSelectedDefinedExportOptions() {
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

  onAnyInputChange(statePropName, newValue) {
    this.clearSelectedDefinedExport();
    const newStateObj = {};
    newStateObj[statePropName] = newValue;
    this.setState(newStateObj);
  }

  onSelectedRowsChange(newRowsArray) {
    this.clearSelectedDefinedExport();
    const newSelectedRows = new Set();
    newRowsArray.forEach((item) => {
      if (item.checked) {
        newSelectedRows.add(item.path);
      }
    });
    this.setState({selectedRows: newSelectedRows});
  }

  selectAllRows(evt) {
    evt.preventDefault();
    this.clearSelectedDefinedExport();
    this.setState({selectedRows: new Set(this.getAllSelectableRows())});
  }

  clearSelectedRows(evt) {
    evt.preventDefault();
    this.clearSelectedDefinedExport();
    this.setState({selectedRows: new Set()});
  }

  toggleAdvancedView(evt) {
    evt.preventDefault();
    this.setState({isAdvancedViewVisible: !this.state.isAdvancedViewVisible});
  }

  applyExportSettingToState(data) {
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
    const customSelectionEnabled = (
      data.export_settings.fields.length !== 0 &&
      this.state.selectableRowsCount !== data.export_settings.fields.length
    );

    const newStateObj = {
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
      isXlsTypesEnabled: data.export_settings.xls_types,
      selectedRows: new Set(data.export_settings.fields),
    };

    // if all rows are selected then fields will be empty, so we need to select all checkboxes manually
    if (newStateObj.selectedRows.size === 0) {
      newStateObj.selectedRows = new Set(this.getAllSelectableRows());
    }

    // select existing item from the dropdown
    this.state.definedExports.forEach((definedExport) => {
      if (definedExport.data.name === data.name) {
        newStateObj.selectedDefinedExport = definedExport;
      }
    });

    this.setState(newStateObj);
  }

  onSubmit(evt) {
    evt.preventDefault();

    const payload = {
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

    // xls_types is only for xls
    if (this.state.selectedExportType.value === EXPORT_TYPES.xls.value) {
      payload.export_settings.xls_types = this.state.isXlsTypesEnabled;
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
      definedExport.data.name === payload.name
    );

    this.setState({isPending: true});

    if (typeof this.clearScheduledExport === 'function') {
      this.clearScheduledExport();
    }

    // Case 1: Don't need to save the export if currently selected a saved one,
    // so we get directly to export creation.
    // Case 2: Also omit saving if user doesn't have permissions to save.
    if (
      this.state.selectedDefinedExport !== null ||
      !mixins.permissions.userCan(PERMISSIONS_CODENAMES.manage_asset, this.props.asset)
    ) {
      this.handleScheduledExport(payload);
    // Case 3: There is a defined export with the same name already, so we need
    // to update it.
    } else if (foundDefinedExport) {
      this.clearScheduledExport = actions.exports.updateExportSetting.completed.listen(
        this.handleScheduledExport
      );
      actions.exports.updateExportSetting(
        this.props.asset.uid,
        foundDefinedExport.data.uid,
        payload,
      );
    // Case 4: There is no defined export like this one, we need to create it.
    } else {
      this.clearScheduledExport = actions.exports.createExportSetting.completed.listen(
        this.handleScheduledExport
      );
      actions.exports.createExportSetting(
        this.props.asset.uid,
        payload,
      );
    }
  }

  generateExportName() {
    return `Export ${formatTimeDate()}`;
  }

  getQuestionsList() {
    // survey question rows with data
    const output = assetUtils.getFlatQuestionsList(
      this.props.asset.content.survey,
      this.state.selectedExportFormat?.langIndex,
      true
    );

    // additional submission properties added by backend
    Object.keys(ADDITIONAL_SUBMISSION_PROPS).forEach((submissionProp) => {
      output.push({
        name: submissionProp,
        label: submissionProp,
        path: submissionProp,
      });
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
        checked: this.state.selectedRows.has(row.path),
        disabled: !this.state.isCustomSelectionEnabled,
        label: checkboxLabel,
        path: row.path,
      };
    });

    return (
      <MultiCheckbox
        items={rows}
        onChange={this.onSelectedRowsChange}
      />
    );
  }

  renderAdvancedView() {
    const includeAllVersionsLabel = (
      <span>
        {t('Include data from all')}
        &nbsp;
        <strong>{this.props.asset.deployed_versions.count}</strong>
        &nbsp;
        {t('versions')}
      </span>
    );

    // make sure the order is right, can't trust object definition ordering :)
    const exportMultipleOptions = [
      EXPORT_MULTIPLE_OPTIONS.details,
      EXPORT_MULTIPLE_OPTIONS.summary,
      EXPORT_MULTIPLE_OPTIONS.both,
    ];

    return (
      <bem.ProjectDownloads__advancedView>
        <bem.ProjectDownloads__column m='left'>
          <label className='project-downloads__column-row'>
            <bem.ProjectDownloads__title>
              {t('Export')}
              &nbsp;
              <em>{t('Select Many')}</em>
              &nbsp;
              {t('questions as…')}
            </bem.ProjectDownloads__title>

            <Select
              value={this.state.selectedExportMultiple}
              options={exportMultipleOptions}
              onChange={this.onAnyInputChange.bind(
                this,
                'selectedExportMultiple'
              )}
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
              onChange={this.onAnyInputChange.bind(this, 'isIncludeAllVersionsEnabled')}
              label={includeAllVersionsLabel}
            />
          </bem.ProjectDownloads__columnRow>

          <bem.ProjectDownloads__columnRow>
            <Checkbox
              checked={this.state.isIncludeGroupsEnabled}
              onChange={this.onAnyInputChange.bind(this, 'isIncludeGroupsEnabled')}
              label={t('Include groups in headers')}
            />

            <TextBox
              disabled={!this.state.isIncludeGroupsEnabled}
              value={this.state.groupSeparator}
              onChange={this.onAnyInputChange.bind(this, 'groupSeparator')}
              label={t('Group separator')}
              customModifiers={[
                'on-white',
                'group-separator',
                (!this.state.isIncludeGroupsEnabled ? 'group-separator-disabled' : undefined),
              ]}
            />
          </bem.ProjectDownloads__columnRow>

          {this.state.selectedExportType.value === EXPORT_TYPES.geojson.value &&
            <bem.ProjectDownloads__columnRow>
              <Checkbox
                checked={this.state.isFlattenGeoJsonEnabled}
                onChange={this.onAnyInputChange.bind(this, 'isFlattenGeoJsonEnabled')}
                label={t('Flatten GeoJSON')}
              />
            </bem.ProjectDownloads__columnRow>
          }

          {this.state.selectedExportType.value === EXPORT_TYPES.xls.value &&
            <bem.ProjectDownloads__columnRow>
              <Checkbox
                checked={this.state.isXlsTypesEnabled}
                onChange={this.onAnyInputChange.bind(this, 'isXlsTypesEnabled')}
                label={t('Use XLS date and number formats')}
              />
            </bem.ProjectDownloads__columnRow>
          }

          <bem.ProjectDownloads__columnRow>
            <Checkbox
              checked={this.state.isSaveCustomExportEnabled}
              onChange={this.onAnyInputChange.bind(
                this,
                'isSaveCustomExportEnabled'
              )}
              label={t('Save selection as…')}
            />

            <TextBox
              disabled={!this.state.isSaveCustomExportEnabled}
              value={this.state.customExportName}
              onChange={this.onAnyInputChange.bind(this, 'customExportName')}
              placeholder={t('Name your export settings')}
              customModifiers={['on-white', 'custom-export']}
            />
          </bem.ProjectDownloads__columnRow>
        </bem.ProjectDownloads__column>

        <bem.ProjectDownloads__column m='right'>
          <bem.ProjectDownloads__columnRow m='rows-selector-header'>
            <ToggleSwitch
              checked={this.state.isCustomSelectionEnabled}
              onChange={this.onAnyInputChange.bind(
                this,
                'isCustomSelectionEnabled'
              )}
              label={t('Select questions to be exported')}
            />

            <bem.ProjectDownloads__textButton
              disabled={(
                !this.state.isCustomSelectionEnabled ||
                this.state.selectedRows.size === this.state.selectableRowsCount
              )}
              onClick={this.selectAllRows}
            >
              {t('Select all')}
            </bem.ProjectDownloads__textButton>

            <span className='project-downloads__vr'/>

            <bem.ProjectDownloads__textButton
              disabled={(
                !this.state.isCustomSelectionEnabled ||
                this.state.selectedRows.size === 0
              )}
              onClick={this.clearSelectedRows}
            >
              {t('Deselect all')}
            </bem.ProjectDownloads__textButton>
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
    let formClassNames = ['project-downloads__exports-creator'];
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
                onChange={this.onAnyInputChange.bind(
                  this,
                  'selectedExportFormat'
                )}
                className='kobo-select'
                classNamePrefix='kobo-select'
                menuPlacement='auto'
                isSearchable={false}
              />
            </label>
          </bem.ProjectDownloads__selectorRow>

          <bem.ProjectDownloads__textButton onClick={this.toggleAdvancedView}>
            {t('Advanced options')}
            {this.state.isAdvancedViewVisible && (
              <i className='k-icon k-icon-up' />
            )}
            {!this.state.isAdvancedViewVisible && (
              <i className='k-icon k-icon-down' />
            )}
          </bem.ProjectDownloads__textButton>

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
                      onChange={this.onSelectedDefinedExportChange}
                      className='kobo-select'
                      classNamePrefix='kobo-select'
                      menuPlacement='auto'
                      placeholder={t('No export settings selected')}
                    />
                  </label>

                  {this.state.selectedDefinedExport &&
                    mixins.permissions.userCan(PERMISSIONS_CODENAMES.manage_asset, this.props.asset) &&
                    <bem.ProjectDownloads__deleteSettingsButton
                      onClick={this.onDeleteExportSetting.bind(
                        this,
                        this.state.selectedDefinedExport.data.uid
                      )}
                      >
                        <i className='k-icon k-icon-trash'/>
                      </bem.ProjectDownloads__deleteSettingsButton>
                    }
                  </React.Fragment>
                }
              </bem.ProjectDownloads__exportsSelector>

              <bem.KoboButton
                m='blue'
                type='submit'
                onClick={this.onSubmit}
                disabled={this.state.selectedRows.size === 0}
              >
                {t('Export')}
              </bem.KoboButton>
            </bem.ProjectDownloads__submitRow>
          </bem.FormView__form>
      </bem.FormView__cell>
    );
  }
}

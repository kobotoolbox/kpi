import React from 'react';
import autoBind from 'react-autobind';
import Select from 'react-select';
import moment from 'moment';
import Checkbox from 'js/components/checkbox';
import TextBox from 'js/components/textBox';
import ToggleSwitch from 'js/components/toggleSwitch';
import {bem} from 'js/bem';
import {actions} from 'js/actions';
import {
  QUESTION_TYPES,
  META_QUESTION_TYPES,
  ADDITIONAL_SUBMISSION_PROPS,
} from 'js/constants';
import {
  EXPORT_TYPES,
  EXPORT_FORMATS,
  EXPORT_MULTIPLE_OPTIONS,
} from './exportsConstants';
import assetUtils from 'js/assetUtils';

const NAMELESS_EXPORT_NAME = t('Latest settings');

/**
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
      selectedExportType: EXPORT_TYPES.xls,
      selectedExportFormat: EXPORT_FORMATS._default,
      groupSeparator: '/',
      selectedExportMultiple: EXPORT_MULTIPLE_OPTIONS.both,
      isIncludeGroupsEnabled: false,
      isIncludeAllVersionsEnabled: false,
      isAdvancedViewVisible: false,
      isSaveCustomExportEnabled: false,
      customExportName: '',
      isCustomSelectionEnabled: false,
      isFlattenGeoJsonEnabled: true,
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
      actions.exports.getExportSettings.completed.listen(this.onGetExportSettings),
      actions.exports.updateExportSetting.completed.listen(this.fetchExportSettings),
      actions.exports.createExportSetting.completed.listen(this.fetchExportSettings),
      actions.exports.deleteExportSetting.completed.listen(this.onDeleteExportSetting),
    );

    this.fetchExportSettings();
  }

  componentWillUnmount() {
    this.unlisteners.forEach((clb) => {clb();});
  }

  onGetExportSettings(response) {
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

    if (!this.state.isComponentReady && response.count >= 1) {
      // load first export settings on initial list load
      this.applyExportSettingToState(response.results[0]);
    }

    this.setState({isComponentReady: true});
  }

  onDeleteExportSetting() {
    this.setState({selectedDefinedExport: null});
    this.fetchExportSettings();
  }

  getAllSelectableRows() {
    const allRows = new Set();
    if (this.props.asset?.content?.survey) {
      this.props.asset.content.survey.forEach((row) => {
        allRows.add(assetUtils.getRowName(row));
      });
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
    if (typeof this.cancelScheduledExport === 'function') {
      this.cancelScheduledExport();
    }

    this.setState({isPending: true});

    const exportParams = response.export_settings;
    exportParams.source = this.props.asset.url;
    actions.exports.createExport(exportParams);
  }

  fetchExportSettings() {
    this.setState({isUpdatingDefinedExportsList: true});
    actions.exports.getExportSettings(this.props.asset.uid);
  }

  deleteExportSetting(exportSettingUid) {
    actions.exports.deleteExportSetting(this.props.asset.uid, exportSettingUid);
  }

  onSelectedDefinedExportChange(newDefinedExport) {
    this.applyExportSettingToState(newDefinedExport.data);
  }

  onAnyInputChange(statePropName, newValue) {
    const newStateObj = {};
    newStateObj[statePropName] = newValue;
    // changing anything in the form clears the selected defined export
    newStateObj.selectedDefinedExport = null;
    this.setState(newStateObj);
  }

  onRowSelected(rowName) {
    const newSelectedRows = this.state.selectedRows;
    if (this.state.selectedRows.has(rowName)) {
      newSelectedRows.delete(rowName);
    } else {
      newSelectedRows.add(rowName);
    }
    this.setState({selectedRows: newSelectedRows});
  }

  toggleAdvancedView() {
    this.setState({isAdvancedViewVisible: !this.state.isAdvancedViewVisible});
  }

  applyExportSettingToState(data) {
    const newStateObj = {
      selectedExportType: EXPORT_TYPES[data.export_settings.type],
      selectedExportFormat: EXPORT_FORMATS[data.export_settings.lang],
      groupSeparator: data.export_settings.group_sep,
      selectedExportMultiple: EXPORT_MULTIPLE_OPTIONS[data.export_settings.multiple_select],
      // FYI Backend keeps booleans as strings
      isIncludeGroupsEnabled: Boolean(data.export_settings.hierarchy_in_labels),
      isIncludeAllVersionsEnabled: Boolean(data.export_settings.fields_from_all_versions),
      // check whether a custom name was given
      isSaveCustomExportEnabled: typeof data.name === 'string' && data.name.length >= 1,
      customExportName: data.name,
      // Select custom export toggle if not all rows are selected
      isCustomSelectionEnabled: this.state.selectableRowsCount !== data.export_settings.fields.length,
      isFlattenGeoJsonEnabled: data.export_settings.flatten,
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
        flatten: this.state.isFlattenGeoJsonEnabled,
      },
    };

    // if custom export is enabled, but there is no name provided
    // we generate a name for export ourselves
    if (this.state.isSaveCustomExportEnabled) {
      payload.name = this.state.customExportName || this.generateExportName();
    }

    // unless custom selection is enabled, we send empty fields (it means "all fields" for backend)
    if (this.state.isCustomSelectionEnabled) {
      payload.export_settings.fields = Array.from(this.state.selectedRows);
    }

    const foundDefinedExport = this.state.definedExports.find((definedExport) => {
      return definedExport.name === payload.name;
    });

    this.setState({isPending: true});

    if (typeof this.cancelScheduledExport === 'function') {
      this.cancelScheduledExport();
    }

    // TODO if someone selected a defined export and doesn't change it in any way
    // we don't need to save it, we just need to schedule export

    if (foundDefinedExport) {
      this.cancelScheduledExport = actions.exports.updateExportSetting.completed.listen(
        this.handleScheduledExport
      );
      actions.exports.updateExportSetting(
        this.props.asset.uid,
        foundDefinedExport.uid,
        payload,
      );
    } else {
      this.cancelScheduledExport = actions.exports.createExportSetting.completed.listen(
        this.handleScheduledExport
      );
      actions.exports.createExportSetting(
        this.props.asset.uid,
        payload,
      );
    }
  }

  generateExportName() {
    const timeString = moment().format('YYYY/MM/DD HH:mm:ss');
    return `Export ${timeString}`;
  }

  getQuestionsList() {
    // survey rows with data
    const output = this.props.asset.content.survey.filter((row) => {
      return (
        Object.keys(QUESTION_TYPES).includes(row.type) ||
        Object.keys(META_QUESTION_TYPES).includes(row.type)
      );
    });

    // additional submission properties added by backend
    Object.keys(ADDITIONAL_SUBMISSION_PROPS).forEach((submissionProp) => {
      output.push({
        name: submissionProp,
        type: submissionProp,
      });
    });

    return output;
  }

  renderRowSelector(row) {
    const rowName = assetUtils.getRowName(row);
    let isChecked = this.state.selectedRows.has(rowName);
    let checkboxLabel = assetUtils.getQuestionDisplayName(row);
    if (this.state.selectedExportFormat.value === EXPORT_FORMATS._xml.value) {
      checkboxLabel = rowName;
    }
    return (
      <li key={rowName}>
        <Checkbox
          disabled={!this.state.isCustomSelectionEnabled}
          checked={isChecked}
          onChange={this.onRowSelected.bind(this, rowName)}
          label={checkboxLabel}
        />
      </li>
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

    const customSelectionLabel = (
      <span className='project-downloads__title'>
        {t('Custom selection export')}
      </span>
    );

    return (
      <div className='project-downloads__advanced-view'>
        <div className='project-downloads__column project-downloads__column--left'>
          <label className='project-downloads__column-row'>
            <span className='project-downloads__title'>
              {t('Export select_multiple responses')}
            </span>

            <Select
              value={this.state.selectedExportMultiple}
              options={Object.values(EXPORT_MULTIPLE_OPTIONS)}
              onChange={this.onAnyInputChange.bind(
                this,
                'selectedExportMultiple'
              )}
              className='kobo-select'
              classNamePrefix='kobo-select'
              menuPlacement='auto'
              placeholder={t('Select…')}
            />
          </label>

          <div className='project-downloads__column-row'>
            <Checkbox
              checked={this.state.isIncludeAllVersionsEnabled}
              onChange={this.onAnyInputChange.bind(this, 'isIncludeAllVersionsEnabled')}
              label={includeAllVersionsLabel}
            />
          </div>

          <div className='project-downloads__column-row'>
            <Checkbox
              checked={this.state.isIncludeGroupsEnabled}
              onChange={this.onAnyInputChange.bind(this, 'isIncludeGroupsEnabled')}
              label={t('Include groups in headers')}
            />
          </div>

          {this.state.selectedExportType.value === EXPORT_TYPES.geojson.value &&
            <div className='project-downloads__column-row'>
              <Checkbox
                checked={this.state.isFlattenGeoJsonEnabled}
                onChange={this.onAnyInputChange.bind(this, 'isFlattenGeoJsonEnabled')}
                label={t('Flatten GeoJSON')}
              />
            </div>
          }

          <div className='project-downloads__column-row project-downloads__column-row--custom-export'>
            <Checkbox
              checked={this.state.isSaveCustomExportEnabled}
              onChange={this.onAnyInputChange.bind(
                this,
                'isSaveCustomExportEnabled'
              )}
              label={t('Save selection as custom export')}
            />

            <TextBox
              disabled={!this.state.isSaveCustomExportEnabled}
              value={this.state.customExportName}
              onChange={this.onAnyInputChange.bind(this, 'customExportName')}
              placeholder={t('Name your custom export')}
              customModifiers={['on-white']}
            />
          </div>
        </div>

        <div className='project-downloads__column project-downloads__column--right'>
          <ToggleSwitch
            checked={this.state.isCustomSelectionEnabled}
            onChange={this.onAnyInputChange.bind(
              this,
              'isCustomSelectionEnabled'
            )}
            label={customSelectionLabel}
          />

          <ul className='project-downloads__questions-list'>
            {this.getQuestionsList().map(this.renderRowSelector)}
          </ul>
        </div>

        <hr />
      </div>
    );
  }

  render() {
    let translations = this.props.asset.content.translations;

    // TODO Someone without manage_asset should not be able to modify these exports

    // TODO each time someone does an export and doesn't decide to save their settings (i.e. they also have manage_asset) the "last used" settings are updated (with a PATCH?). If that person doesn't have manage_asset but they can still export data, must the frontend ensure that it doesn't send a PATCH to update the "last used" settings?

    const groupSeparatorLabel = (
      <span className='project-downloads__title'>
        {t('Group separator')}
      </span>
    );

    let formClassNames = ['exports-creator'];
    if (!this.state.isComponentReady) {
      formClassNames.push('exports-creator--loading');
    }

    return (
      <bem.FormView__row>
        <bem.FormView__cell m={['page-title']}>
          {t('Downloads')}
        </bem.FormView__cell>

        <bem.FormView__cell m={['box', 'padding']}>
          <bem.FormView__form className={formClassNames.join(' ')}>
            <div className='project-downloads__selector-row'>
              <label>
                <span className='project-downloads__title'>
                  {t('Select export type')}
                </span>

                <Select
                  value={this.state.selectedExportType}
                  options={Object.values(EXPORT_TYPES)}
                  onChange={this.onAnyInputChange.bind(
                    this,
                    'selectedExportType'
                  )}
                  className='kobo-select'
                  classNamePrefix='kobo-select'
                  menuPlacement='auto'
                />
              </label>

              <label>
                <span className='project-downloads__title'>
                  {t('Value and header format')}
                </span>

                <Select
                  value={this.state.selectedExportFormat}
                  options={Object.values(EXPORT_FORMATS)}
                  onChange={this.onAnyInputChange.bind(
                    this,
                    'selectedExportFormat'
                  )}
                  className='kobo-select'
                  classNamePrefix='kobo-select'
                  menuPlacement='auto'
                />
              </label>

              <TextBox
                value={this.state.groupSeparator}
                onChange={this.onAnyInputChange.bind(this, 'groupSeparator')}
                label={groupSeparatorLabel}
                customModifiers={['on-white', 'group-separator']}
              />
            </div>

            <div
              className='project-downloads__advanced-toggle'
              onClick={this.toggleAdvancedView}
            >
              {t('Advanced options')}
              {this.state.isAdvancedViewVisible && (
                <i className='k-icon k-icon-up' />
              )}
              {!this.state.isAdvancedViewVisible && (
                <i className='k-icon k-icon-down' />
              )}
            </div>

            <hr />

            {this.state.isAdvancedViewVisible && this.renderAdvancedView()}

            <div className='project-downloads__submit-row'>
              <div className='project-downloads__defined-exports-selector'>
                {this.state.definedExports.length >= 1 &&
                  <React.Fragment>
                    <label>
                      <span className='project-downloads__title'>
                        {t('Custom exports')}
                      </span>

                      <Select
                        isLoading={this.state.isUpdatingDefinedExportsList}
                        value={this.state.selectedDefinedExport}
                        options={this.state.definedExports}
                        onChange={this.onSelectedDefinedExportChange}
                        className='kobo-select'
                        classNamePrefix='kobo-select'
                        menuPlacement='auto'
                        placeholder={t('Select…')}
                      />
                    </label>

                    {this.state.selectedDefinedExport &&
                      <bem.KoboLightButton
                        m={['red', 'icon-only']}
                        onClick={this.deleteExportSetting.bind(
                          this,
                          this.state.selectedDefinedExport.data.uid
                        )}
                      >
                        <i className='k-icon k-icon-trash'/>
                      </bem.KoboLightButton>
                    }
                  </React.Fragment>
                }
              </div>

              <bem.KoboButton
                m='blue'
                type='submit'
                onClick={this.onSubmit}
              >
                {t('Export')}
              </bem.KoboButton>
            </div>
          </bem.FormView__form>
        </bem.FormView__cell>
      </bem.FormView__row>
    );
  }
}

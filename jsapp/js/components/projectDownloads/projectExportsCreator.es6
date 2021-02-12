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
      isVirgin: true,
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
      selectedDefinedExport: null,
      definedExports: [],
    };

    this.unlisteners = [];

    // preselect all rows
    if (this.props.asset?.content?.survey) {
      this.props.asset.content.survey.forEach((row) => {
        this.state.selectedRows.add(assetUtils.getRowName(row));
      });
      Object.keys(ADDITIONAL_SUBMISSION_PROPS).forEach((submissionProp) => {
        this.state.selectedRows.add(submissionProp);
      });
    }

    autoBind(this);
  }

  componentDidMount() {
    this.unlisteners.push(
      actions.exports.getExportSettings.completed.listen(this.onGetExportSettings),
      actions.exports.getExportSetting.completed.listen(this.onGetExportSetting),
      actions.exports.updateExportSetting.completed.listen(this.onUpdateExportSetting),
      actions.exports.createExportSetting.completed.listen(this.onCreateExportSetting),
      actions.exports.deleteExportSetting.completed.listen(this.onDeleteExportSetting),
    );

    this.fetchExportSettings();
  }

  componentWillUnmount() {
    this.unlisteners.forEach((clb) => {clb();});
  }

  onGetExportSettings(response) {
    if (this.state.isVirgin && response.count >= 1) {
      // TODO load latest saved
      this.applyExportSettingToState(response.results[0]);
    }
    console.log('onGetExportSettings', response);

    // we need to prepare the results to be displayed in Select
    const definedExports = [];
    response.results.forEach((result, index) => {
      definedExports.push({
        value: index,
        label: result.name,
        data: result,
      });
    });

    this.setState({
      isVirgin: false,
      definedExports: definedExports,
    });
  }

  onGetExportSetting(response) {
    console.log('onGetExportSetting', response);
  }

  onUpdateExportSetting(response) {
    console.log('onUpdateExportSetting', response);
  }

  onCreateExportSetting(response) {
    console.log('onCreateExportSetting', response);
    this.fetchExportSettings();
  }

  onDeleteExportSetting(response) {
    console.log('onDeleteExportSetting', response);
    this.setState({selectedDefinedExport: null});
    this.fetchExportSettings();
  }

  fetchExportSettings() {
    actions.exports.getExportSettings(this.props.asset.uid);
  }

  deleteExportSetting(exportSettingUid) {
    actions.exports.deleteExportSetting(this.props.asset.uid, exportSettingUid);
  }

  onSelectedDefinedExportChange(newDefinedExport) {
    this.applyExportSettingToState(newDefinedExport.data);

    this.setState({selectedDefinedExport: newDefinedExport});
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

  applyExportSettingToState(exportSettingData) {
    console.log('applyExportSettingToState', exportSettingData);
  }

  onSubmit(evt) {
    evt.preventDefault();
    console.log(this.state);

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

    if (foundDefinedExport) {
      actions.exports.updateExportSetting(
        this.props.asset.uid,
        foundDefinedExport.uid,
        payload
      );
    } else {
      actions.exports.createExportSetting(
        this.props.asset.uid,
        payload
      );
    }

    // TODO when call goes through make a call to createExport using the setting
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

    const groupSeparatorLabel = (
      <span className='project-downloads__title'>
        {t('Group separator')}
      </span>
    );

    let formClassNames = ['exports-creator'];
    if (this.state.isVirgin) {
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

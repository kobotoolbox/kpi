import React from 'react';
import autoBind from 'react-autobind';
import Select from 'react-select';
import moment from 'moment';
import Checkbox from 'js/components/checkbox';
import TextBox from 'js/components/textBox';
import ToggleSwitch from 'js/components/toggleSwitch';
import {bem} from 'js/bem';
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
 */
export default class ProjectExportsCreator extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      selectedExportType: null,
      selectedExportFormat: null,
      groupSeparator: '/',
      selectedExportMultiple: null,
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

    if (this.props.asset?.content?.survey) {
      this.props.asset.content.survey.forEach((row) => {
        this.state.selectedRows.add(assetUtils.getRowName(row));
      });
      Object.keys(ADDITIONAL_SUBMISSION_PROPS).forEach((submissionProp) => {
        this.state.selectedRows.add(submissionProp);
      });
    }

    this.state.definedExports = [
      {value: 'todo1', label: 'todo1'},
      {value: 'todo2', label: 'todo2'},
    ];

    autoBind(this);
  }

  onAnyInputChange(statePropName, isChecked) {
    const newStateObj = {};
    newStateObj[statePropName] = isChecked;
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

  onSubmit(evt) {
    evt.preventDefault();
    console.log(this.state);
    console.log(this.getPayloadData());
  }

  generateDefaulExportName() {
    const timeString = moment().format('YYYY/MM/DD HH:mm:ss');
    return `Export ${timeString}`;
  }

  getPayloadData() {
    let name = this.generateDefaulExportName();
    if (this.state.customExportName) {
      name = this.state.customExportName;
    }

    return {
      name: name, // required
      export_settings: {
        fields_from_all_versions: 'true', // required
        fields: ['field_1', 'field_2'], // optional; empty or missing means all fields
        group_sep: '/', // required
        hierarchy_in_labels: 'true', // required
        lang: 'English (en)',
        multiple_select: 'both', // required
        type: 'csv', // required
        flatten: true, // should default to true
      },
    };
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
    return (
      <li key={rowName}>
        <Checkbox
          disabled={!this.state.isCustomSelectionEnabled}
          checked={isChecked}
          onChange={this.onRowSelected.bind(this, rowName)}
          label={assetUtils.getQuestionDisplayName(row)}
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

          {this.state.selectedExportType?.value === EXPORT_TYPES.geojson.value &&
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

    return (
      <bem.FormView__row>
        <bem.FormView__cell m={['page-title']}>
          {t('Downloads')}
        </bem.FormView__cell>

        <bem.FormView__cell m={['box', 'padding']}>
          <bem.FormView__form>
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
                  placeholder={t('Select…')}
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
                  placeholder={t('Select…')}
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
              {/* show this only if definedExports exist */}
              <div>
                <label>
                  <span className='project-downloads__title'>
                    {t('Custom exports')}
                  </span>

                  <Select
                    value={this.state.selectedDefinedExport}
                    options={this.state.definedExports}
                    onChange={this.onAnyInputChange.bind(
                      this,
                      'selectedDefinedExport'
                    )}
                    className='kobo-select'
                    classNamePrefix='kobo-select'
                    menuPlacement='auto'
                    placeholder={t('Select…')}
                  />
                </label>
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

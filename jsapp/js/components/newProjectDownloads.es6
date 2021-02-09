import React from 'react';
import autoBind from 'react-autobind';
import Select from 'react-select';
import Checkbox from 'js/components/checkbox';
import TextBox from 'js/components/textBox';
import ToggleSwitch from 'js/components/toggleSwitch';
import {bem} from 'js/bem';
import assetUtils from 'js/assetUtils';

const EXPORT_TYPES = Object.freeze({
  xls: {value: 'xls', label: t('XLS')},
  xls_legacy: {value: 'xls_legacy', label: t('XLS (legacy)')},
  csv: {value: 'csv', label: t('CSV')},
  csv_legacy: {value: 'csv_legacy', label: t('CSV (legacy)')},
  zip_legacy: {value: 'zip_legacy', label: t('Media Attachments (ZIP)')},
  kml_legacy: {value: 'kml_legacy', label: t('GPS coordinates (KML)')},
  analyser_legacy: {value: 'analyser_legacy', label: t('Excel Analyser')},
  spss_labels: {value: 'spss_labels', label: t('SPSS Labels')},
});
const EXPORT_FORMATS = Object.freeze({
  xml: {value: 'xml', label: t('XML values and headers')},
  labels: {value: 'labels', label: t('Labels')},
});
const EXPORT_MULTIPLE_OPTIONS = Object.freeze({
  separate_columns: {
    value: 'separate_columns',
    label: t('Split into separate columns'),
  },
  TODO: {value: 'TODO', label: t('TODO')},
});

/**
 * @prop {object} asset
 */
export default class ProjectDownloads extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      selectedExportType: null,
      selectedExportFormat: null,
      groupSeparator: '/',
      selectedExportMultiple: null,
      isIncludeGroupsEnabled: false,
      isIncludeDataEnabled: false,
      isAdvancedViewVisible: false,
      isSaveCustomExportEnabled: false,
      customExportName: '',
      isCustomSelectionEnabled: false,
      selectedRows: new Set(),
    };

    if (this.props.asset?.content?.survey) {
      this.props.asset.content.survey.forEach((row) => {
        this.state.selectedRows.add(assetUtils.getRowName(row));
      });
    }

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
  }

  renderRowSelector(row) {
    const rowName = assetUtils.getRowName(row);
    let isChecked = this.state.selectedRows.has(rowName);
    return (
      <Checkbox
        checked={isChecked}
        onChange={this.onRowSelected.bind(this, rowName)}
        label={assetUtils.getQuestionDisplayName(row)}
      />
    );
  }

  renderAdvancedView() {
    const deployedVersionsCount = 'TODO';
    return (
      <div className='project-downloads__advanced-view'>
        <div className='project-downloads__column project-downloads__column--left'>
          <label>
            {t('Export select_multiple responses')}

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

          <Checkbox
            checked={this.state.isIncludeDataEnabled}
            onChange={this.onAnyInputChange.bind(this, 'isIncludeDataEnabled')}
            label={t('Include data from all ##count## versions').replace(
              '##count##',
              deployedVersionsCount
            )}
          />

          <Checkbox
            checked={this.state.isIncludeGroupsEnabled}
            onChange={this.onAnyInputChange.bind(this, 'isIncludeGroupsEnabled')}
            label={t('Include groups in headers')}
          />

          <Checkbox
            checked={this.state.isSaveCustomExportEnabled}
            onChange={this.onAnyInputChange.bind(
              this,
              'isSaveCustomExportEnabled'
            )}
            label={t('Save selection as custom export')}
          />

          <TextBox
            value={this.state.customExportName}
            onChange={this.onAnyInputChange.bind(this, 'customExportName')}
            placeholder={t('Name your custom export')}
            customModifiers={['on-white']}
          />
        </div>

        <div className='project-downloads__column project-downloads__column--right'>
          <ToggleSwitch
            checked={this.state.isCustomSelectionEnabled}
            onChange={this.onAnyInputChange.bind(
              this,
              'isCustomSelectionEnabled'
            )}
            label={t('Custom selection export')}
          />

          <div className='project-downloads__questions-list'>
            {this.props.asset.content.survey.map(this.renderRowSelector)}
          </div>
        </div>

        <hr />
      </div>
    );
  }

  render() {
    let translations = this.props.asset.content.translations;
    let dvcount = this.props.asset.deployed_versions.count;

    return (
      <bem.FormView className='project-downloads'>
        <bem.FormView__row>
          <bem.FormView__cell m={['page-title']}>
            {t('Downloads')}
          </bem.FormView__cell>

          <bem.FormView__cell m={['box', 'padding']}>
            <bem.FormView__form>
              <div className='project-downloads__selector-row'>
                <label>
                  {t('Select export type')}

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
                  {t('Value and header format')}

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
                  label={t('Group separator')}
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

              <bem.KoboButton type='submit' onClick={this.onSubmit}>
                {t('Export')}
              </bem.KoboButton>
            </bem.FormView__form>
          </bem.FormView__cell>
        </bem.FormView__row>
      </bem.FormView>
    );
  }
}

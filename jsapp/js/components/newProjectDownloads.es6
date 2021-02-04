import React from 'react';
import autoBind from 'react-autobind';
import Select from 'react-select';
import Checkbox from './checkbox';
import Textbox from './textbox';
import {bem} from 'js/bem';

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

/**
 * @prop {object} asset
 */
export default class ProjectDownloads extends React.Component {
  constructor(props){
    super(props);
    this.state = {
      selectedExportType: null,
      selectedExportFormat: null,
      isIncludeGroupsEnabled: false,
      groupSeparator: '/',
      isSplitEnabled: false,
      isAdvancedViewVisible: false,
    };
    autoBind(this);
  }

  onExportTypeChange(newValue) {
    this.setState({selectedExportType: newValue});
  }

  onExportFormatChange(newValue) {
    this.setState({selectedExportFormat: newValue});
  }

  onIncludeGroupsChange(isChecked) {
    this.setState({isIncludeGroupsEnabled: isChecked});
  }

  onGroupSeparatorChange(newValue) {
    this.setState({groupSeparator: newValue});
  }

  onSplitChange(isChecked) {
    this.setState({isSplitEnabled: isChecked});
  }

  toggleAdvancedView() {
    this.setState({isAdvancedViewVisible: !this.state.isAdvancedViewVisible});
  }

  renderAdvancedView() {
    return (
      <React.Fragment>
        <Checkbox
          checked={this.state.isSplitEnabled}
          onChange={this.onSplitChange}
          label={t('Split select_multiple questions')}
        />

        <Textbox
          value={this.state.groupSeparator}
          onChange={this.onGroupSeparatorChange}
        />
      </React.Fragment>
    );
  }

  render() {
    let translations = this.props.asset.content.translations;
    let dvcount = this.props.asset.deployed_versions.count;

    return (
      <bem.FormView>
        <bem.FormView__row>
          <bem.FormView__cell m={['label', 'first']}>
            {t('Downloads')}
          </bem.FormView__cell>

          <bem.FormView__cell m={['box', 'padding']}>
            <label>
              {t('Select export type')}

              <Select
                value={this.state.selectedExportType}
                options={Object.values(EXPORT_TYPES)}
                onChange={this.onExportTypeChange}
                className='kobo-select'
                classNamePrefix='kobo-select'
                menuPlacement='auto'
              />
            </label>

            <label>
              {t('Value and header format')}

              <Select
                value={this.state.selectedExportFormat}
                options={Object.values(EXPORT_FORMATS)}
                onChange={this.onExportFormatChange}
                className='kobo-select'
                classNamePrefix='kobo-select'
                menuPlacement='auto'
                isDisabled={!this.state.selectedExportType}
              />
            </label>

            <Checkbox
              checked={this.state.isIncludeGroupsEnabled}
              onChange={this.onIncludeGroupsChange}
              label={t('Include groups in headers')}
            />

            <span
              onClick={this.toggleAdvancedView}
            >
              {t('Advanced options')}
              {this.state.isAdvancedViewVisible &&
                <i className='k-icon k-icon-up'/>
              }
              {!this.state.isAdvancedViewVisible &&
                <i className='k-icon k-icon-down'/>
              }
            </span>

            {this.state.isAdvancedViewVisible && this.renderAdvancedView()}
          </bem.FormView__cell>
        </bem.FormView__row>
      </bem.FormView>
    );
  }
}

import React from 'react';
import autoBind from 'react-autobind';
import Select from 'react-select';
import Checkbox from './checkbox';
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
    };
    autoBind(this);
  }

  onExportTypeChange(exportTypeValue) {
    this.setState({selectedExportType: exportTypeValue});
  }

  onExportFormatChange(exportFormatValue) {
    this.setState({selectedExportFormat: exportFormatValue});
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
          </bem.FormView__cell>
        </bem.FormView__row>
      </bem.FormView>
    );
  }
}

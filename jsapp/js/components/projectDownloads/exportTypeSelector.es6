import React from 'react';
import autoBind from 'react-autobind';
import Select from 'react-select';
import {bem} from 'js/bem';
import {EXPORT_TYPES} from 'js/components/projectDownloads/exportsConstants';
import exportsStore from 'js/components/projectDownloads/exportsStore';

/**
 * @prop {boolean} [disabled]
 */
export default class ExportTypeSelector extends React.Component {
  constructor(props){
    super(props);
    this.state = {selectedExportType: exportsStore.getExportType()};
    this.unlisteners = [];
    autoBind(this);
  }

  componentDidMount() {
    this.unlisteners.push(
      exportsStore.listen(this.onExportsStoreChange),
    );
  }

  componentWillUnmount() {
    this.unlisteners.forEach((clb) => {clb();});
  }

  onExportsStoreChange() {
    this.setState({selectedExportType: exportsStore.getExportType()});
  }

  onSelectedExportTypeChange(newValue) {
    exportsStore.setExportType(newValue);
  }

  render() {
    // make xls topmost (as most popular), then with non-legacy and finish with legacy
    const exportTypesOptions = [
      EXPORT_TYPES.xls,
      EXPORT_TYPES.csv,
      EXPORT_TYPES.geojson,
      EXPORT_TYPES.spss_labels,
      EXPORT_TYPES.csv_legacy,
      EXPORT_TYPES.kml_legacy,
      EXPORT_TYPES.xls_legacy,
      EXPORT_TYPES.zip_legacy,
    ];

    return (
      <label>
        <bem.ProjectDownloads__title>
          {t('Select export type')}
        </bem.ProjectDownloads__title>

        <Select
          value={this.state.selectedExportType}
          options={exportTypesOptions}
          onChange={this.onSelectedExportTypeChange}
          className='kobo-select'
          classNamePrefix='kobo-select'
          menuPlacement='auto'
          isSearchable={false}
          isDisabled={this.props.disabled}
        />
      </label>
    );
  }
}

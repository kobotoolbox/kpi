import React from 'react';
import Select from 'react-select';
import bem from 'js/bem';
import {EXPORT_TYPES, type ExportTypeDefinition} from 'js/components/projectDownloads/exportsConstants';
import exportsStore from 'js/components/projectDownloads/exportsStore';

interface ExportTypeSelectorProps {
  disabled?: boolean;
  /** Hides legacy options */
  noLegacy?: boolean;
}

interface ExportTypeSelectorState {
  selectedExportType: ExportTypeDefinition;
}

/**
 * This is a selector that is handling the currently selected export type and
 * is storing it in exportsStore.
 */
export default class ExportTypeSelector extends React.Component<
  ExportTypeSelectorProps,
  ExportTypeSelectorState
> {
  constructor(props: ExportTypeSelectorProps) {
    super(props);
    this.state = {selectedExportType: exportsStore.getExportType()};
  }

  private unlisteners: Function[] = [];

  componentDidMount() {
    this.unlisteners.push(
      exportsStore.listen(this.onExportsStoreChange.bind(this), this),
    );
  }

  componentWillUnmount() {
    this.unlisteners.forEach((clb) => {clb();});
  }

  onExportsStoreChange() {
    this.setState({selectedExportType: exportsStore.getExportType()});
  }

  onSelectedExportTypeChange(newValue: ExportTypeDefinition | null) {
    // It's not really possible to have `null` here, as Select requires a value
    // to always be set.
    if (newValue !== null) {
      exportsStore.setExportType(newValue);
    }
  }

  render() {
    // make xls topmost (as most popular)
    const exportTypesOptions: ExportTypeDefinition[] = [
      EXPORT_TYPES.xls,
      EXPORT_TYPES.csv,
      EXPORT_TYPES.geojson,
      EXPORT_TYPES.spss_labels,
    ];

    // legacy options are optional
    if (!this.props.noLegacy) {
      exportTypesOptions.push(EXPORT_TYPES.csv_legacy);
      exportTypesOptions.push(EXPORT_TYPES.kml_legacy);
      exportTypesOptions.push(EXPORT_TYPES.xls_legacy);
      exportTypesOptions.push(EXPORT_TYPES.zip_legacy);
    }

    return (
      <label>
        <bem.ProjectDownloads__title>
          {t('Select export type')}
        </bem.ProjectDownloads__title>

        <Select<ExportTypeDefinition>
          value={this.state.selectedExportType}
          options={exportTypesOptions}
          onChange={this.onSelectedExportTypeChange.bind(this)}
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

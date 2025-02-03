// Libraries
import React from 'react';
import bem from 'js/bem';

// Partial components
import InlineMessage from 'js/components/common/inlineMessage';
import ExportTypeSelector from 'js/components/projectDownloads/ExportTypeSelector';

// Stores, hooks and utilities
import exportsStore from 'js/components/projectDownloads/exportsStore';

// Constants and types
import {
  EXPORT_TYPES,
  type ExportTypeDefinition,
  type ExportTypeName,
} from 'js/components/projectDownloads/exportsConstants';
import {type AssetResponse} from 'jsapp/js/dataInterface';

interface LegacyExportsProps {
  asset: AssetResponse;
}

interface LegacyExportsState {
  selectedExportType: ExportTypeDefinition;
}

/**
 * A component for displaying the legacy exports iframe with an export type selector.
 */
export default class LegacyExports extends React.Component<
  LegacyExportsProps,
  LegacyExportsState
> {
  constructor(props: LegacyExportsProps){
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

  render() {
    const exportType = this.state.selectedExportType.value as keyof typeof ExportTypeName;

    return (
      <bem.FormView__cell m={['box', 'padding']}>
        <bem.ProjectDownloads__selectorRow>
          <ExportTypeSelector/>
        </bem.ProjectDownloads__selectorRow>

        {exportType !== EXPORT_TYPES.zip_legacy.value && (
          <InlineMessage
            type='warning'
            icon='alert'
            message={t('This export format will not be supported in the future. Please consider using one of the other export types available.')}
          />
        )}

        <div className='project-downloads__legacy-iframe-wrapper'>
          <iframe src={
            this.props.asset.deployment__data_download_links?.[exportType]
          } />
        </div>
      </bem.FormView__cell>
    );
  }
}

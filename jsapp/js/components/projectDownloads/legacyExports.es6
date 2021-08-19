import React from 'react';
import autoBind from 'react-autobind';
import bem from 'js/bem';
import {EXPORT_TYPES} from 'js/components/projectDownloads/exportsConstants';
import exportsStore from 'js/components/projectDownloads/exportsStore';
import ExportTypeSelector from 'js/components/projectDownloads/exportTypeSelector';

/**
 * A component for displaying the legacy exports iframe with an export type selector.
 * @prop {object} asset
 */
export default class LegacyExports extends React.Component {
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

  render() {
    return (
      <bem.FormView__cell m={['box', 'padding']}>
        <bem.ProjectDownloads__selectorRow>
          <ExportTypeSelector/>
        </bem.ProjectDownloads__selectorRow>

        {this.state.selectedExportType.value !== EXPORT_TYPES.zip_legacy.value && (
          <bem.FormView__cell m='warning'>
            <i className='k-icon-alert' />
            <p>{t('This export format will not be supported in the future. Please consider using one of the other export types available.')}</p>
          </bem.FormView__cell>
        )}

        <div className='project-downloads__legacy-iframe-wrapper'>
          <iframe src={
            this.props.asset.deployment__data_download_links[this.state.selectedExportType.value]
          } />
        </div>
      </bem.FormView__cell>
    );
  }
}

import React from 'react';
import autoBind from 'react-autobind';
import bem from 'js/bem';
import {actions} from 'js/actions';
import {downloadUrl} from 'js/utils';
import {
  EXPORT_STATUSES,
  DEFAULT_EXPORT_SETTINGS,
} from 'js/components/projectDownloads/exportsConstants';
import {getContextualDefaultExportFormat} from 'js/components/projectDownloads/exportsUtils';
import exportsStore from 'js/components/projectDownloads/exportsStore';
import ExportTypeSelector from 'js/components/projectDownloads/exportTypeSelector';
import ExportFetcher from 'js/components/projectDownloads/exportFetcher';
import Button from 'js/components/common/button';

/**
 * A compontent that ROUTES.FORM_DOWNLOADS route is displayint for not logged in
 * users. It allows to select an export type and download a file.
 * @prop {object} asset
 */
export default class AnonymousExports extends React.Component {
  constructor(props){
    super(props);
    this.state = {
      selectedExportType: exportsStore.getExportType(),
      isPending: false,
      exportUrl: null,
    };
    this.unlisteners = [];
    autoBind(this);
  }

  componentDidMount() {
    this.unlisteners.push(
      exportsStore.listen(this.onExportsStoreChange),
      actions.exports.createExport.completed.listen(this.onCreateExportCompleted),
      actions.exports.getExport.completed.listen(this.onGetExportCompleted),
    );
  }

  componentWillUnmount() {
    this.unlisteners.forEach((clb) => {clb();});
  }

  onExportsStoreChange() {
    this.setState({
      selectedExportType: exportsStore.getExportType(),
      exportUrl: null,
    });
  }

  onCreateExportCompleted(exportData) {
    this.fetchExport(exportData.uid);
  }

  onGetExportCompleted(exportData) {
    this.checkExportFetcher(exportData.uid, exportData.status);

    if (exportData.status === EXPORT_STATUSES.complete) {
      this.setState({
        isPending: false,
        exportUrl: exportData.result,
      });
      downloadUrl(this.state.exportUrl);
    }
  }

  onSubmit() {
    if (this.state.exportUrl) {
      // we remember the current type download to not make multiple calls
      downloadUrl(this.state.exportUrl);
    } else {
      this.setState({isPending: true});

      const defaultExportFormat = getContextualDefaultExportFormat(this.props.asset);

      // NOTE: this wouldn't work for legacy formats, but luckily we don't allow
      // choosing legacy types in this component
      actions.exports.createExport(
        this.props.asset.uid,
        {
          type: this.state.selectedExportType.value,
          fields_from_all_versions: DEFAULT_EXPORT_SETTINGS.INCLUDE_ALL_VERSIONS,
          group_sep: DEFAULT_EXPORT_SETTINGS.GROUP_SEPARATOR,
          hierarchy_in_labels: DEFAULT_EXPORT_SETTINGS.INCLUDE_GROUPS,
          lang: defaultExportFormat.value,
          multiple_select: DEFAULT_EXPORT_SETTINGS.EXPORT_MULTIPLE.value,
        }
      );
    }
  }

  checkExportFetcher(exportUid, exportStatus) {
    if (
      exportStatus !== EXPORT_STATUSES.error &&
      exportStatus !== EXPORT_STATUSES.complete &&
      !this.fetchIntervalId
    ) {
      this.exportFetcher = new ExportFetcher(this.props.asset.uid, exportUid);
    }

    // clean up after it is completed
    if (
      exportStatus === EXPORT_STATUSES.error ||
      exportStatus === EXPORT_STATUSES.complete
    ) {
      if (this.exportFetcher) {
        this.exportFetcher.stop();
        delete this.exportFetcher;
      }
    }
  }

  fetchExport(exportUid) {
    actions.exports.getExport(this.props.asset.uid, exportUid);
  }

  /**
   * We allow only one pending download at a time, so we disable the type
   * selector and the export button for simplicity.
   */
  render() {
    return (
      <bem.FormView__cell m={['box', 'padding']}>
        <bem.ProjectDownloads__anonymousRow>
          <bem.ProjectDownloads__exportsSelector>
            <ExportTypeSelector
              disabled={this.state.isPending}
              noLegacy
            />
          </bem.ProjectDownloads__exportsSelector>

          <Button
            type='full'
            color='blue'
            size='l'
            isSubmit
            onClick={this.onSubmit.bind(this)}
            isPending={this.state.isPending}
            label={t('Export')}
          />
        </bem.ProjectDownloads__anonymousRow>
      </bem.FormView__cell>
    );
  }
}

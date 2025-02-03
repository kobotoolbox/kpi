// Libraries
import React from 'react';
import bem from 'js/bem';

// Partial components
import ExportTypeSelector from 'js/components/projectDownloads/ExportTypeSelector';
import Button from 'js/components/common/button';

// Stores, hooks and utilities
import {actions} from 'js/actions';
import {downloadUrl} from 'js/utils';
import {getContextualDefaultExportFormat} from 'js/components/projectDownloads/exportsUtils';
import exportsStore from 'js/components/projectDownloads/exportsStore';
import ExportFetcher from 'js/components/projectDownloads/exportFetcher';

// Constants and types
import {
  ExportStatusName,
  DEFAULT_EXPORT_SETTINGS,
  type ExportTypeDefinition,
} from 'js/components/projectDownloads/exportsConstants';
import type {AssetResponse, ExportDataResponse} from 'jsapp/js/dataInterface';

interface AnonymousExportsProps {
  asset: AssetResponse;
}

interface AnonymousExportsState {
  selectedExportType: ExportTypeDefinition;
  isPending: boolean;
  exportUrl: string | null;
}

/**
 * A compontent that ROUTES.FORM_DOWNLOADS route is displayint for not logged in
 * users. It allows to select an export type and download a file.
 * @prop {object} asset
 */
export default class AnonymousExports extends React.Component<
  AnonymousExportsProps,
  AnonymousExportsState
> {
  constructor(props: AnonymousExportsProps){
    super(props);
    this.state = {
      selectedExportType: exportsStore.getExportType(),
      isPending: false,
      exportUrl: null,
    };
  }

  private unlisteners: Function[] = [];
  private exportFetcher?: ExportFetcher;

  componentDidMount() {
    this.unlisteners.push(
      exportsStore.listen(this.onExportsStoreChange.bind(this), this),
      actions.exports.createExport.completed.listen(this.onCreateExportCompleted.bind(this)),
      actions.exports.getExport.completed.listen(this.onGetExportCompleted.bind(this)),
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

  onCreateExportCompleted(exportData: ExportDataResponse) {
    this.fetchExport(exportData.uid);
  }

  onGetExportCompleted(exportData: ExportDataResponse) {
    this.checkExportFetcher(exportData.uid, exportData.status);

    if (exportData.status === ExportStatusName.complete) {
      this.setState({
        isPending: false,
        exportUrl: exportData.result,
      }, () => {
        if (this.state.exportUrl !== null) {
          downloadUrl(this.state.exportUrl);
        }
      });
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

  checkExportFetcher(exportUid: string, exportStatus: ExportStatusName) {
    if (
      exportStatus !== ExportStatusName.error &&
      exportStatus !== ExportStatusName.complete &&
      !this.exportFetcher
    ) {
      this.exportFetcher = new ExportFetcher(this.props.asset.uid, exportUid);
    }

    // clean up after it is completed
    if (
      exportStatus === ExportStatusName.error ||
      exportStatus === ExportStatusName.complete
    ) {
      if (this.exportFetcher) {
        this.exportFetcher.stop();
        delete this.exportFetcher;
      }
    }
  }

  fetchExport(exportUid: string) {
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
            type='primary'
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

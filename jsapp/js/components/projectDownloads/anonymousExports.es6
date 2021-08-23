import React from 'react';
import autoBind from 'react-autobind';
import bem from 'js/bem';
import {actions} from 'js/actions';
import {
  EXPORT_STATUSES,
  EXPORT_REFRESH_TIME,
  DEFAULT_EXPORT_SETTINGS,
} from 'js/components/projectDownloads/exportsConstants';
import {getContextualDefaultExportFormat} from 'js/components/projectDownloads/exportsUtils';
import exportsStore from 'js/components/projectDownloads/exportsStore';
import ExportTypeSelector from 'js/components/projectDownloads/exportTypeSelector';

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
    this.fetchIntervalId = null;
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
    this.prepareFetchInterval(exportData.uid, exportData.status);

    if (exportData.status === EXPORT_STATUSES.complete) {
      this.setState({
        isPending: false,
        exportUrl: exportData.result,
      });
      this.downloadUrl(this.state.exportUrl);
    }
  }

  onSubmit() {
    if (this.state.exportUrl) {
      // we remember the current type download to not make multiple calls
      // TODO: try storing all the created export urls (for some amount of
      // time?) so that whenever user switches between types, in each clicking
      // "Export" button, we don't make unnecessary calls.
      this.downloadUrl(this.state.exportUrl);
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

  prepareFetchInterval(exportUid, exportStatus) {
    // if the export is not complete yet, and there is no fetch interval
    // fetch it in some time again and again
    if (
      exportStatus !== EXPORT_STATUSES.error &&
      exportStatus !== EXPORT_STATUSES.complete &&
      !this.fetchIntervalId
    ) {
      const intervalId = setInterval(this.fetchExport.bind(this, exportUid), EXPORT_REFRESH_TIME);
      this.fetchIntervalId = intervalId;
    }

    // clean up after it is completed
    if (
      exportStatus === EXPORT_STATUSES.error ||
      exportStatus === EXPORT_STATUSES.complete
    ) {
      this.removeFetchInterval();
    }
  }

  removeFetchInterval() {
    clearInterval(this.fetchIntervalId);
    this.fetchIntervalId = null;
  }

  fetchExport(exportUid) {
    actions.exports.getExport(this.props.asset.uid, exportUid);
  }

  downloadUrl(url) {
    const aEl = document.createElement('a');
    const splitUrl = url.split('/');
    const fileName = splitUrl[splitUrl.length - 1];
    aEl.href = url;
    aEl.setAttribute('download', fileName);
    aEl.click();
  }

  /**
   * We allow only one pending download at a time, so we disable the type
   * selector and the export button for simplicity.
   */
  render() {
    const buttonModifiers = ['blue'];
    if (this.state.isPending) {
      buttonModifiers.push('pending');
    }

    return (
      <bem.FormView__cell m={['box', 'padding']}>
        <bem.ProjectDownloads__anonymousRow>
          <bem.ProjectDownloads__exportsSelector>
            <ExportTypeSelector
              disabled={this.state.isPending}
              noLegacy
            />
          </bem.ProjectDownloads__exportsSelector>

          <bem.KoboButton
            m={buttonModifiers}
            type='submit'
            onClick={this.onSubmit}
            disabled={this.state.isPending}
          >
            {t('Export')}
            {this.state.isPending &&
              <i className='k-spin k-icon k-icon-spinner'/>
            }
          </bem.KoboButton>
        </bem.ProjectDownloads__anonymousRow>
      </bem.FormView__cell>
    );
  }
}

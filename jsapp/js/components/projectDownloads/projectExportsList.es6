import React from 'react';
import autoBind from 'react-autobind';
import {bem} from 'js/bem';
import {actions} from 'js/actions';
import {formatTime} from 'js/utils';
import {renderLoading} from 'js/components/modalForms/modalHelpers.es6';
import {
  EXPORT_TYPES,
  EXPORT_FORMATS,
  EXPORT_STATUSES,
} from './exportsConstants';
import exportsStore from 'js/components/projectDownloads/exportsStore';

const EXPORT_REFRESH_TIME = 4000;

/**
 * @prop {object} asset
 */
export default class ProjectExportsList extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      isComponentReady: false,
      rows: [],
      selectedExportType: exportsStore.getExportType(),
    };

    this.unlisteners = [];
    this.fetchIntervals = new Map();

    autoBind(this);
  }

  componentDidMount() {
    this.unlisteners.push(
      exportsStore.listen(this.onExportsStoreChange),
      actions.exports.getExports.completed.listen(this.onGetExports),
      actions.exports.createExport.completed.listen(this.onCreateExport),
      actions.exports.deleteExport.completed.listen(this.onDeleteExport),
      actions.exports.getExport.completed.listen(this.onGetExport),
    );
    this.fetchExports();
  }

  componentWillUnmount() {
    this.unlisteners.forEach((clb) => {clb();});
    this.removeAllFetchIntervals();
  }

  onExportsStoreChange() {
    this.setState({selectedExportType: exportsStore.getExportType()});
  }

  onGetExports(response) {
    // TODO for now exports endpoint doesn't allow `ordering` parameter, and the
    // results are oldest first, so:
    response.results.reverse();

    response.results.forEach((exportData) => {
      this.prepareFetchInterval(exportData.uid, exportData.status);
    });

    this.setState({
      isComponentReady: true,
      rows: response.results,
    });
  }

  onCreateExport(response) {
    this.fetchExport(response.uid);
  }

  onDeleteExport() {
    this.fetchExports();
  }

  onGetExport(exportData) {
    this.prepareFetchInterval(exportData.uid, exportData.status);

    // Replace existing export with fresh data or add new on top
    const newStateObj = {rows: this.state.rows};
    let wasAdded = false;
    newStateObj.rows.forEach((rowData, index) => {
      if (rowData.uid === exportData.uid) {
        newStateObj.rows[index] = exportData;
        wasAdded = true;
      }
    });
    if (!wasAdded) {
      newStateObj.rows.unshift(exportData);
    }
    this.setState(newStateObj);
  }

  prepareFetchInterval(exportUid, exportStatus) {
    // if the export is not complete yet, and there is no fetch interval
    // fetch it in some time again and again
    if (
      exportStatus !== EXPORT_STATUSES.complete &&
      !this.fetchIntervals.has(exportUid)
    ) {
      const intervalId = setInterval(this.fetchExport.bind(this, exportUid), EXPORT_REFRESH_TIME);
      this.fetchIntervals.set(exportUid, intervalId);
    }

    // clean up after it is completed
    if (exportStatus === EXPORT_STATUSES.complete) {
      this.removeFetchInterval(exportUid);
    }
  }

  removeFetchInterval(exportUid) {
    clearInterval(this.fetchIntervals.get(exportUid));
    this.fetchIntervals.delete(exportUid);
  }

  removeAllFetchIntervals() {
    this.fetchIntervals.forEach((intervalId, exportUid) => {
      this.removeFetchInterval(exportUid);
    });
  }

  fetchExport(exportUid) {
    actions.exports.getExport(exportUid);
  }

  fetchExports() {
    actions.exports.getExports(this.props.asset.uid);
  }

  deleteExport(exportUid) {
    actions.exports.deleteExport(exportUid);
  }

  renderBooleanAnswer(isTrue) {
    if (isTrue) {
      return t('Yes');
    } else {
      return t('No');
    }
  }

  renderRow(exportData) {
    return (
      <bem.SimpleTable__row key={exportData.uid}>
        <bem.SimpleTable__cell>
          {EXPORT_TYPES[exportData.data.type]?.label}
        </bem.SimpleTable__cell>

        <bem.SimpleTable__cell>
          {formatTime(exportData.date_created)}
        </bem.SimpleTable__cell>

        <bem.SimpleTable__cell>
          {EXPORT_FORMATS[exportData.data.lang]?.label}
        </bem.SimpleTable__cell>

        <bem.SimpleTable__cell>
          {this.renderBooleanAnswer(exportData.data.hierarchy_in_labels)}
        </bem.SimpleTable__cell>

        <bem.SimpleTable__cell>
          {this.renderBooleanAnswer(exportData.data.fields_from_all_versions)}
        </bem.SimpleTable__cell>

        <bem.SimpleTable__cell>
          {exportData.status === EXPORT_STATUSES.complete &&
            <a
              className='kobo-light-button kobo-light-button--blue'
              href={exportData.result}
            >
              <i className='k-icon k-icon-download'/>
              {t('Download')}
            </a>
          }

          {exportData.status === EXPORT_STATUSES.error &&
            <span data-tip={exportData.messages?.error}>
              {t('Export Failed')}
            </span>
          }

          {(
            exportData.status !== EXPORT_STATUSES.complete &&
            exportData.status !== EXPORT_STATUSES.error
          ) &&
            <span className='animate-processing'>{t('Processing…')}</span>
          }

          <bem.KoboLightButton
            m={['red', 'icon-only']}
            onClick={this.deleteExport.bind(this, exportData.uid)}
          >
            <i className='k-icon k-icon-trash'/>
          </bem.KoboLightButton>
        </bem.SimpleTable__cell>
      </bem.SimpleTable__row>
    );
  }

  render() {
    if (!this.state.isComponentReady) {
      return (
        <bem.FormView__row>
          <bem.FormView__cell>
            {renderLoading()}
          </bem.FormView__cell>
        </bem.FormView__row>
      );
    // don't display the component if no exports
    // or if selected a legacy type
    } else if (
      this.state.rows.length === 0 ||
      this.state.selectedExportType.isLegacy
    ) {
      return null;
    } else {
      return (
        <bem.FormView__row>
          <bem.FormView__cell m={['page-subtitle']}>
            {t('Exports')}
          </bem.FormView__cell>

          <bem.SimpleTable m='project-exports'>
            <bem.SimpleTable__header>
              <bem.SimpleTable__row>
                <bem.SimpleTable__cell>
                  {t('Type')}
                </bem.SimpleTable__cell>

                <bem.SimpleTable__cell>
                  {t('Created')}
                </bem.SimpleTable__cell>

                <bem.SimpleTable__cell>
                  {t('Language')}
                </bem.SimpleTable__cell>

                <bem.SimpleTable__cell>
                  {t('Include Groups')}
                </bem.SimpleTable__cell>

                <bem.SimpleTable__cell>
                  {t('Multiple Versions')}
                </bem.SimpleTable__cell>

                <bem.SimpleTable__cell/>
              </bem.SimpleTable__row>
            </bem.SimpleTable__header>

            <bem.SimpleTable__body>
              {this.state.rows.map(this.renderRow)}
            </bem.SimpleTable__body>
          </bem.SimpleTable>
        </bem.FormView__row>
      );
    }
  }
}

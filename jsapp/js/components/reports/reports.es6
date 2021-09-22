import React from 'react';
import reactMixin from 'react-mixin';
import autoBind from 'react-autobind';
import Reflux from 'reflux';
import {dataInterface} from 'js/dataInterface';
import {actions} from 'js/actions';
import bem from 'js/bem';
import {stores} from 'js/stores';
import PopoverMenu from 'js/popoverMenu';
import LoadingSpinner from 'js/components/common/loadingSpinner';
import Modal from 'js/components/common/modal';
import mixins from 'js/mixins';
import DocumentTitle from 'react-document-title';
import {txtid} from '../../../xlform/src/model.utils';
import alertify from 'alertifyjs';
import {launchPrinting} from 'utils';
import {REPORT_STYLES} from './reportsConstants';
import CustomReportForm from './customReportForm';
import QuestionGraphSettings from './questionGraphSettings';
import ReportContents from './reportContents';
import ReportStyleSettings from './reportStyleSettings';
import './reports.scss';

export default class Reports extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      graphWidth: '700',
      graphHeight: '250',
      translations: false,
      activeModalTab: 0,
      error: false,
      isFullscreen: false,
      reportLimit: 200,
      customReports: false,
      showReportGraphSettings: false,
      showCustomReportModal: false,
      currentCustomReport: false,
      currentQuestionGraph: false,
      groupBy: '',
    };
    autoBind(this);
  }

  componentDidMount() {
    this.loadReportData();
    this.listenTo(actions.reports.setStyle, this.reportStyleListener);
    this.listenTo(actions.reports.setCustom, this.reportCustomListener);
  }

  componentDidUpdate(prevProps, prevState) {
    if (this.state.currentCustomReport !== prevState.currentCustomReport) {
      this.refreshReportData();
    }
    if (this.state.groupBy !== prevState.groupBy) {
      this.refreshReportData();
    }
  }

  loadReportData() {
    const uid = this.props.params.assetid || this.props.params.uid;

    stores.allAssets.whenLoaded(uid, (asset) => {
      let rowsByKuid = {};
      let rowsByIdentifier = {};
      let groupBy = '';
      let reportStyles = asset.report_styles;
      let reportCustom = asset.report_custom;

      if (
        this.state.currentCustomReport &&
        this.state.currentCustomReport.reportStyle &&
        this.state.currentCustomReport.reportStyle.groupDataBy
      ) {
        groupBy = this.state.currentCustomReport.reportStyle.groupDataBy;
      } else if (reportStyles.default.groupDataBy !== undefined) {
        groupBy = reportStyles.default.groupDataBy;
      }

      // TODO: improve the defaults below
      if (reportStyles.default.report_type === undefined) {
        reportStyles.default.report_type = REPORT_STYLES.vertical.value;
      }
      if (reportStyles.default.translationIndex === undefined) {
        reportStyles.default.translationIndex = 0;
      }
      if (reportStyles.default.groupDataBy === undefined) {
        reportStyles.default.groupDataBy = '';
      }

      if (asset.content.survey != undefined) {
        asset.content.survey.forEach(function (r) {
          if (r.$kuid) {
            rowsByKuid[r.$kuid] = r;
          }

          let $identifier = r.$autoname || r.name;
          rowsByIdentifier[$identifier] = r;
        });

        dataInterface
          .getReportData({uid: uid, identifiers: [], group_by: groupBy})
          .done((data) => {
            var dataWithResponses = [];

            data.list.forEach(function (row) {
              if (row.data.responses || row.data.values || row.data.mean) {
                if (rowsByIdentifier[row.name] !== undefined) {
                  row.row.label = rowsByIdentifier[row.name].label;
                } else if (row.name !== undefined) {
                  row.row.label = row.name;
                } else {
                  row.row.label = t('untitled');
                }
                dataWithResponses.push(row);
              }
            });

            this.setState({
              asset: asset,
              rowsByKuid: rowsByKuid,
              rowsByIdentifier: rowsByIdentifier,
              reportStyles: reportStyles,
              reportData: dataWithResponses,
              reportCustom: reportCustom,
              translations: asset.content.translations.length > 1,
              groupBy: groupBy,
              error: false,
            });
          })
          .fail((err) => {
            if (
              groupBy &&
              groupBy.length > 0 &&
              !this.state.currentCustomReport &&
              reportStyles.default.groupDataBy !== undefined
            ) {
              // reset default report groupBy if it fails and notify user
              reportStyles.default.groupDataBy = '';
              this.setState({reportStyles: reportStyles});
              alertify.error(
                t(
                  'Could not load grouped results via "##". Will attempt to load the ungrouped report.'
                ).replace('##', groupBy)
              );
              this.loadReportData();
            } else {
              this.setState({
                error: err,
                asset: asset,
              });
            }
          });
      } else {
        // Redundant?
        console.error('Survey not defined.');
      }
    });
  }

  refreshReportData() {
    let uid = this.props.params.assetid || this.props.params.uid;
    let rowsByIdentifier = this.state.rowsByIdentifier;
    let customReport = this.state.currentCustomReport;

    var groupBy = '';

    if (
      !customReport &&
      this.state.reportStyles.default.groupDataBy !== undefined
    ) {
      groupBy = this.state.reportStyles.default.groupDataBy;
    }

    if (
      customReport &&
      customReport.reportStyle &&
      customReport.reportStyle.groupDataBy
    ) {
      groupBy = this.state.currentCustomReport.reportStyle.groupDataBy;
    }

    dataInterface
      .getReportData({uid: uid, identifiers: [], group_by: groupBy})
      .done((data) => {
        var dataWithResponses = [];

        data.list.forEach(function (row) {
          if (row.data.responses || row.data.values || row.data.mean) {
            if (rowsByIdentifier[row.name] !== undefined) {
              row.row.label = rowsByIdentifier[row.name].label;
            } else if (row.name !== undefined) {
              row.row.label = row.name;
            } else {
              row.row.label = t('untitled');
            }
            dataWithResponses.push(row);
          }
        });

        this.setState({
          reportData: dataWithResponses,
          error: false,
        });
      })
      .fail((err) => {
        alertify.error(t('Could not refresh report.'));
        this.setState({error: err});
      });
  }

  reportStyleListener(assetUid, reportStyles) {
    this.setState({
      reportStyles: reportStyles,
      showReportGraphSettings: false,
      currentQuestionGraph: false,
      groupBy: reportStyles.default.groupDataBy,
    });
  }

  reportCustomListener(assetUid, reportCustom) {
    var crid = this.state.currentCustomReport.crid;
    let newGroupBy = false;

    if (reportCustom[crid]) {
      if (
        reportCustom[crid].reportStyle &&
        reportCustom[crid].reportStyle.groupDataBy
      ) {
        newGroupBy = reportCustom[crid].reportStyle.groupDataBy;
      }

      this.setState({
        reportCustom: reportCustom,
        showCustomReportModal: false,
        showReportGraphSettings: false,
        currentQuestionGraph: false,
        groupBy: newGroupBy,
      });
    } else {
      if (REPORT_STYLES.default && REPORT_STYLES.default.groupDataBy) {
        newGroupBy = REPORT_STYLES.default.groupDataBy;
      }

      this.setState({
        reportCustom: reportCustom,
        showCustomReportModal: false,
        showReportGraphSettings: false,
        currentQuestionGraph: false,
        currentCustomReport: false,
        groupBy: newGroupBy,
      });
    }
  }

  toggleReportGraphSettings() {
    this.setState({
      showReportGraphSettings: !this.state.showReportGraphSettings,
    });
  }

  hasAnyProvidedData(reportData) {
    let hasAny = false;
    reportData.map((rowContent) => {
      if (rowContent.data.provided) {
        hasAny = true;
      }
    });
    return hasAny;
  }

  setCustomReport(e) {
    var crid = e ? e.target.getAttribute('data-crid') : false;

    if (!this.state.showCustomReportModal) {
      let currentCustomReport;
      if (crid) {
        // existing report
        currentCustomReport = this.state.reportCustom[crid];
      } else {
        // new custom report
        currentCustomReport = {
          crid: txtid(),
          name: '',
          questions: [],
        };
      }
      this.setState({currentCustomReport: currentCustomReport});
    }
  }

  editCustomReport() {
    if (this.state.currentCustomReport) {
      this.setState({showCustomReportModal: true});
    }
  }

  toggleCustomReportModal() {
    if (!this.state.showCustomReportModal) {
      this.setCustomReport();
    } else if (this.state.currentCustomReport) {
      var crid = this.state.currentCustomReport.crid;
      if (this.state.reportCustom[crid] == undefined) {
        this.triggerDefaultReport();
      }
    }

    this.setState({showCustomReportModal: !this.state.showCustomReportModal});
  }

  triggerDefaultReport() {
    this.setState({currentCustomReport: false});
  }

  toggleFullscreen() {
    this.setState({isFullscreen: !this.state.isFullscreen});
  }

  renderReportButtons() {
    var customReports = this.state.reportCustom || {};
    var customReportsList = [];
    for (var key in customReports) {
      if (customReports[key] && customReports[key].crid) {
        customReportsList.push(customReports[key]);
      }
    }

    customReportsList.sort((a, b) => {
      return a.name.localeCompare(b.name);
    });
    var _this = this;

    let menuLabel = t('Custom Reports');
    if (this.state.currentCustomReport) {
      menuLabel = this.state.currentCustomReport.name || t('Untitled Report');
    }

    return (
      <bem.FormView__reportButtons>
        <PopoverMenu type='custom-reports' triggerLabel={menuLabel}>
          <bem.PopoverMenu__link
            key='default'
            data-name=''
            onClick={this.triggerDefaultReport}
            className={!this.state.currentCustomReport ? 'active' : ''}
          >
            {t('Default Report')}
          </bem.PopoverMenu__link>
          {customReportsList.map(function (m) {
            let itemClassName;
            if (
              _this.state.currentCustomReport &&
              _this.state.currentCustomReport.crid === m.crid
            ) {
              itemClassName = 'active';
            }
            return (
              <bem.PopoverMenu__link
                key={m.crid}
                data-crid={m.crid}
                onClick={_this.setCustomReport}
                className={itemClassName}
              >
                {m.name || t('Untitled report')}
              </bem.PopoverMenu__link>
            );
          })}
          {this.userCan('change_asset', this.state.asset) && (
            <bem.PopoverMenu__link
              key='new'
              onClick={this.toggleCustomReportModal}
            >
              {t('Create New Report')}
            </bem.PopoverMenu__link>
          )}
        </PopoverMenu>

        {this.state.currentCustomReport && (
          <bem.Button
            m='icon'
            className='report-button__edit'
            onClick={this.editCustomReport}
            data-tip={t('Edit Report Questions')}
          >
            <i className='k-icon k-icon-edit' />
          </bem.Button>
        )}

        <bem.Button
          m='icon'
          className='report-button__expand right-tooltip'
          onClick={this.toggleFullscreen}
          data-tip={t('Toggle fullscreen')}
        >
          <i className='k-icon k-icon-expand' />
        </bem.Button>

        <bem.Button
          m='icon'
          className='report-button__print'
          onClick={launchPrinting}
          data-tip={t('Print')}
        >
          <i className='k-icon k-icon-print' />
        </bem.Button>

        {this.userCan('change_asset', this.state.asset) && (
          <bem.Button
            m='icon'
            className='report-button__settings'
            onClick={this.toggleReportGraphSettings}
            data-tip={t('Configure Report Style')}
          >
            <i className='k-icon k-icon-settings' />
          </bem.Button>
        )}
      </bem.FormView__reportButtons>
    );
  }

  renderCustomReportModal() {
    return (
      <bem.GraphSettings>
        <Modal.Body>
          <CustomReportForm
            reportData={this.state.reportData}
            customReport={this.state.currentCustomReport}
            asset={this.state.asset}
          />
        </Modal.Body>
      </bem.GraphSettings>
    );
  }

  resetReportLimit() {
    this.setState({
      reportLimit: false,
    });
  }

  triggerQuestionSettings(evt) {
    let question = evt.target.getAttribute('data-question');
    if (question) {
      this.setState({currentQuestionGraph: question});
    }
  }

  renderQuestionSettings() {
    return (
      <bem.GraphSettings>
        <Modal.Body />
      </bem.GraphSettings>
    );
  }
  closeQuestionSettings() {
    this.setState({currentQuestionGraph: false});
  }

  renderLoadingOrError() {
    if (this.state.error) {
      return (
        <bem.Loading>
          <bem.Loading__inner>
            {t('This report cannot be loaded.')}
            <br />
            <code>
              {this.state.error.statusText}
              {': ' + this.state.error.responseText}
            </code>
          </bem.Loading__inner>
        </bem.Loading>
      );
    } else {
      return (
        <bem.Loading>
          <LoadingSpinner />
        </bem.Loading>
      );
    }
  }

  render() {
    if (!this.state.asset) {
      return this.renderLoadingOrError();
    }

    let asset = this.state.asset;
    let currentCustomReport = this.state.currentCustomReport;
    let docTitle;

    if (asset && asset.content) {
      docTitle = asset.name || t('Untitled');
    }

    var reportData = this.state.reportData || [];

    if (reportData.length) {
      if (currentCustomReport && currentCustomReport.questions.length) {
        const currentQuestions = currentCustomReport.questions;
        const fullReportData = this.state.reportData;
        reportData = fullReportData.filter((q) => {
          return currentQuestions.includes(q.name);
        });
      }

      if (
        this.state.reportLimit &&
        reportData.length > this.state.reportLimit
      ) {
        reportData = reportData.slice(0, this.state.reportLimit);
      }
    }

    if (this.state.reportData === undefined) {
      return this.renderLoadingOrError();
    }

    const formViewModifiers = [];
    if (this.state.isFullscreen) {
      formViewModifiers.push('fullscreen');
    }

    const hasAnyProvidedData = this.hasAnyProvidedData(reportData);
    const hasGroupBy = this.state.groupBy.length !== 0;

    return (
      <DocumentTitle title={`${docTitle} | KoboToolbox`}>
        <bem.FormView m={formViewModifiers}>
          <bem.ReportView>
            {this.renderReportButtons()}

            {!hasAnyProvidedData && (
              <bem.ReportView__wrap>
                <bem.Loading>
                  <bem.Loading__inner>
                    {t('This report has no data.')}

                    {hasGroupBy &&
                      ' ' + t('Try changing Report Style to "No grouping".')}
                  </bem.Loading__inner>
                </bem.Loading>
              </bem.ReportView__wrap>
            )}

            {hasAnyProvidedData && (
              <bem.ReportView__wrap>
                <bem.PrintOnly>
                  <h3>{asset.name}</h3>
                </bem.PrintOnly>
                {!this.state.currentCustomReport &&
                  this.state.reportLimit &&
                  reportData.length &&
                  this.state.reportData.length > this.state.reportLimit && (
                    <bem.FormView__cell m={['centered', 'reportLimit']}>
                      <div>
                        {t(
                          'For performance reasons, this report only includes the first ## questions.'
                        ).replace('##', this.state.reportLimit)}
                      </div>
                      <bem.Button m='colored' onClick={this.resetReportLimit}>
                        {t('Show all (##)').replace(
                          '##',
                          this.state.reportData.length
                        )}
                      </bem.Button>
                    </bem.FormView__cell>
                  )}

                <bem.FormView__cell m='warning'>
                  <i className='k-icon k-icon-alert' />
                  <p>
                    {t(
                      'This is an automated report based on raw data submitted to this project. Please conduct proper data cleaning prior to using the graphs and figures used on this page. '
                    )}
                  </p>
                </bem.FormView__cell>

                <ReportContents
                  parentState={this.state}
                  reportData={reportData}
                  triggerQuestionSettings={this.triggerQuestionSettings}
                />
              </bem.ReportView__wrap>
            )}

            {this.state.showReportGraphSettings && (
              <Modal
                open
                onClose={this.toggleReportGraphSettings}
                title={t('Edit Report Style')}
              >
                <ReportStyleSettings parentState={this.state} />
              </Modal>
            )}

            {this.state.showCustomReportModal && (
              <Modal
                open
                onClose={this.toggleCustomReportModal}
                title={t('Custom Report')}
              >
                {this.renderCustomReportModal()}
              </Modal>
            )}

            {this.state.currentQuestionGraph && (
              <Modal
                open
                onClose={this.closeQuestionSettings}
                title={t('Question Style')}
              >
                <QuestionGraphSettings
                  question={this.state.currentQuestionGraph}
                  parentState={this.state}
                />
              </Modal>
            )}
          </bem.ReportView>
        </bem.FormView>
      </DocumentTitle>
    );
  }
}

reactMixin(Reports.prototype, mixins.permissions);
reactMixin(Reports.prototype, Reflux.ListenerMixin);

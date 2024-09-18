import React from 'react';
import reactMixin from 'react-mixin';
import autoBind from 'react-autobind';
import Reflux from 'reflux';
import {dataInterface} from 'js/dataInterface';
import {actions} from 'js/actions';
import bem from 'js/bem';
import {stores} from 'js/stores';
import PopoverMenu from 'js/popoverMenu';
import InlineMessage from 'js/components/common/inlineMessage';
import LoadingSpinner from 'js/components/common/loadingSpinner';
import Modal from 'js/components/common/modal';
import DocumentTitle from 'react-document-title';
import {txtid} from '../../../xlform/src/model.utils';
import {notify, launchPrinting} from 'utils';
import {REPORT_STYLES} from './reportsConstants';
import CustomReportForm from './customReportForm';
import QuestionGraphSettings from './questionGraphSettings';
import ReportContents from './reportContents';
import ReportStyleSettings from './reportStyleSettings';
import './reports.scss';
import {userCan} from 'js/components/permissions/utils';
import CenteredMessage from 'js/components/common/centeredMessage.component';
import Button from 'js/components/common/button';

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
              translations: asset.content.translations?.length > 1,
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
              notify.error(
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
        notify.error(t('Could not refresh report.'));
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
        <div className='form-view__report-buttons-left'>
          <PopoverMenu
            type='custom-reports'
            triggerLabel={
              <Button
                type='primary'
                size='m'
                label={menuLabel}
                endIcon='angle-down'
              />
            }
          >
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
            {userCan('change_asset', this.state.asset) && (
              <bem.PopoverMenu__link
                key='new'
                onClick={this.toggleCustomReportModal}
              >
                {t('Create New Report')}
              </bem.PopoverMenu__link>
            )}
          </PopoverMenu>

          <Button
            type='text'
            size='m'
            startIcon='edit'
            onClick={this.editCustomReport.bind(this)}
            tooltip={t('Edit Report Questions')}
            isDisabled={!this.state.currentCustomReport}
          />

          <Button
            type='text'
            size='m'
            startIcon='settings'
            onClick={this.toggleReportGraphSettings.bind(this)}
            tooltip={t('Configure Report Style')}
            isDisabled={!userCan('change_asset', this.state.asset)}
          />
        </div>

        <div className='form-view__report-buttons-right'>
          <Button
            type='text'
            size='m'
            startIcon='print'
            onClick={launchPrinting}
            tooltip={t('Print')}
            tooltipPosition='right'
          />

          <Button
            type='text'
            size='m'
            startIcon='expand'
            onClick={this.toggleFullscreen.bind(this)}
            tooltip={t('Toggle fullscreen')}
            tooltipPosition='right'
          />
        </div>
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

  triggerQuestionSettings(questionName) {
    if (questionName) {
      this.setState({currentQuestionGraph: questionName});
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
        <CenteredMessage
          message={(
            <>
            {t('This report cannot be loaded.')}
            <br />
            <code>
              {this.state.error.statusText}
              {': ' + this.state.error.responseText || t('An error occurred')}
            </code>
            </>
          )}
        />
      );
    } else {
      return (
        <LoadingSpinner />
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

    let noDataMessage = t('This report has no data.');
    if (hasGroupBy) {
      noDataMessage += ' ';
      noDataMessage += t('Try changing Report Style to "No grouping".');
    }

    return (
      <DocumentTitle title={`${docTitle} | KoboToolbox`}>
        <bem.FormView m={formViewModifiers}>
          <bem.ReportView>
            {this.renderReportButtons()}

            {!hasAnyProvidedData && (
              <bem.ReportView__wrap>
                <InlineMessage type='warning' message={noDataMessage}/>
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
                    <InlineMessage
                      type='warning'
                      message={
                        <div className='report-view__limit-message'>
                          <p>
                            {t(
                              'For performance reasons, this report only includes the first ## questions.'
                            ).replace('##', this.state.reportLimit)}
                          </p>

                          <Button
                            type='secondary'
                            size='s'
                            onClick={this.resetReportLimit.bind(this)}
                            label={t('Show all (##)').replace('##', this.state.reportData.length)}
                          />
                        </div>
                      }
                    />
                  )
                }

                <InlineMessage
                  type='warning'
                  icon='alert'
                  message={t('This is an automated report based on raw data submitted to this project. Please conduct proper data cleaning prior to using the graphs and figures used on this page.')}
                />

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

reactMixin(Reports.prototype, Reflux.ListenerMixin);

// Libraries
import React from 'react';
import clonedeep from 'lodash.clonedeep';

// Partial components
import Radio from 'js/components/common/radio';
import Modal from 'js/components/common/modal';
import ReportTypeEditor from './reportTypeEditor.component';
import ReportColorsEditor from './reportColorsEditor.component';
import Button from 'js/components/common/button';
import ReportsModalTabs, {ReportsModalTabNames, DEFAULT_REPORTS_MODAL_TAB} from 'js/components/reports/reportsModalTabs.component';

// Utilities
import bem from 'js/bem';
import {actions} from 'js/actions';
import {handleApiFail} from 'jsapp/js/api';

// Types & constants
import type {FailResponse, LabelValuePair} from 'js/dataInterface';
import type {ReportStyle, ReportStyleName} from './reportsConstants';
import type {ReportsState} from './reports';

interface ReportStyleSettingsProps {
  parentState: ReportsState;
}

interface ReportStyleSettingsState {
  activeModalTab: ReportsModalTabNames;
  reportStyle: ReportStyle;
  isPending: boolean;
}

/**
 * This component is being used to modify existing report style settings.
 *
 * It displays up to 4 available tabs ("type" and "color" are always available,
 * "group by" and "translation" based on the form questions).
 */
export default class ReportStyleSettings extends React.Component<
  ReportStyleSettingsProps,
  ReportStyleSettingsState
> {
  private unlisteners: Function[] = [];

  constructor(props: ReportStyleSettingsProps) {
    super(props);

    let initialReportStyle = props.parentState.reportStyles?.default;
    if (props.parentState.currentCustomReport?.reportStyle) {
      initialReportStyle = props.parentState.currentCustomReport.reportStyle;
    }

    this.state = {
      activeModalTab: DEFAULT_REPORTS_MODAL_TAB,
      reportStyle: initialReportStyle || {},
      isPending: false,
    };
  }

  componentDidMount() {
    this.unlisteners.push(
      actions.reports.setStyle.completed.listen(this.onSetStyleCompleted.bind(this)),
      actions.reports.setStyle.failed.listen(this.onSetStyleFailed.bind(this)),
      actions.reports.setCustom.completed.listen(this.onSetCustomCompleted.bind(this)),
      actions.reports.setCustom.failed.listen(this.onSetCustomFailed.bind(this)),
    );
  }

  componentWillUnmount() {
    this.unlisteners.forEach((clb) => clb());
  }

  onSetStyleCompleted() {
    this.setState({isPending: false});
  }

  onSetStyleFailed(response: FailResponse) {
    handleApiFail(response);
    this.setState({isPending: false});
  }

  onSetCustomCompleted() {
    this.setState({isPending: false});
  }

  onSetCustomFailed(response: FailResponse) {
    handleApiFail(response);
    this.setState({isPending: false});
  }

  toggleTab(tabName: ReportsModalTabNames) {
    this.setState({activeModalTab: tabName});
  }

  onReportColorsChange(newColors: string[]) {
    const newStyle = clonedeep(this.state.reportStyle);
    newStyle.report_colors = newColors;
    this.setState({reportStyle: newStyle});
  }

  onReportTypeChange(newType: ReportStyleName) {
    const newStyles = clonedeep(this.state.reportStyle);
    newStyles.report_type = newType;
    this.setState({reportStyle: newStyles});
  }

  onTranslationIndexChange(newIndex: string) {
    const newStyle = clonedeep(this.state.reportStyle);
    newStyle.translationIndex = parseInt(newIndex);
    this.setState({reportStyle: newStyle});
  }

  onGroupByChange(newValue: string) {
    const newStyle = clonedeep(this.state.reportStyle);
    newStyle.groupDataBy = newValue;
    this.setState({reportStyle: newStyle});
  }

  saveReportStyles() {
    const currentCustomReport = this.props.parentState.currentCustomReport;
    const assetUid = this.props.parentState.asset?.uid;

    if (!assetUid) {
      return;
    }

    if (currentCustomReport) {
      const reportCustom = clonedeep(this.props.parentState.asset?.report_custom || {});
      if (reportCustom) {
        reportCustom[currentCustomReport.crid].reportStyle = this.state.reportStyle;
        actions.reports.setCustom(assetUid, reportCustom, currentCustomReport.crid);
        this.setState({isPending: true});
      }
    } else {
      const parentReportStyles = this.props.parentState.reportStyles;
      if (parentReportStyles?.default) {
        Object.assign(parentReportStyles.default, this.state.reportStyle);
        actions.reports.setStyle(assetUid, parentReportStyles);
        this.setState({isPending: true});
      }
    }
  }

  render() {
    const rows = this.props.parentState.rowsByIdentifier || {};
    const translations = this.props.parentState.asset?.content?.translations || [];
    const reportStyle = this.state.reportStyle;

    const groupByOptions = [];
    groupByOptions.push({
      value: '',
      label: t('No grouping'),
    });

    for (const key in rows) {
      if (
        key in rows &&
        'type' in rows[key] &&
        rows[key].type === 'select_one'
      ) {
        const row = rows[key];
        const val = row.name || row.$autoname;
        let label = row.label?.[0] || '';
        if (
          translations.length > 1 &&
          typeof reportStyle.translationIndex === 'number' &&
          row.label?.[reportStyle.translationIndex]
        ) {
          label = row.label?.[reportStyle.translationIndex];
        }

        // Safeguard for TS reasons
        if (val !== undefined) {
          groupByOptions.push({
            value: val,
            label: label,
          });
        }
      }
    }

    const tabs: ReportsModalTabNames[] = [
      ReportsModalTabNames['chart-type'],
      ReportsModalTabNames.colors
    ];

    if (groupByOptions.length > 1) {
      tabs.push(ReportsModalTabNames['group-by']);
    }

    const selectedTranslationOptions: LabelValuePair[] = [];
    if (translations.length > 1) {
      tabs.push(ReportsModalTabNames.translation);
      translations?.map((row, i) => {
        selectedTranslationOptions.push({
          value: String(i),
          label: row || t('Unnamed language'),
        });
      });
    }

    return (
      <bem.GraphSettings>
        <Modal.Tabs>
          <ReportsModalTabs
            tabs={tabs}
            activeTabName={this.state.activeModalTab}
            onRequestTabChange={this.toggleTab.bind(this)}
          />
        </Modal.Tabs>

        <Modal.Body>
          <div className='tabs-content'>
            {this.state.activeModalTab === ReportsModalTabNames['chart-type'] && (
              <div id='graph-type'>
                <ReportTypeEditor
                  style={reportStyle}
                  onChange={this.onReportTypeChange.bind(this)}
                />
              </div>
            )}
            {this.state.activeModalTab === ReportsModalTabNames.colors && (
              <div id='graph-colors'>
                <ReportColorsEditor
                  style={reportStyle}
                  onChange={this.onReportColorsChange.bind(this)}
                />
              </div>
            )}
            {this.state.activeModalTab === ReportsModalTabNames['group-by'] &&
              groupByOptions.length > 1 && (
                <div className='graph-tab__groupby' id='graph-labels' dir='auto'>
                  <Radio
                    name='reports-groupby'
                    options={groupByOptions}
                    onChange={this.onGroupByChange.bind(this)}
                    selected={reportStyle.groupDataBy || ''}
                  />
                </div>
              )}
            {this.state.activeModalTab === ReportsModalTabNames.translation &&
              selectedTranslationOptions.length > 1 && (
                <div className='graph-tab__translation' id='graph-labels'>
                  <Radio
                    name='reports-selected-translation'
                    options={selectedTranslationOptions}
                    onChange={this.onTranslationIndexChange.bind(this)}
                    selected={String(reportStyle.translationIndex)}
                  />
                </div>
              )}
          </div>

          <Modal.Footer>
            <Button
              type='primary'
              size='l'
              onClick={this.saveReportStyles.bind(this)}
              label={t('Save')}
              isPending={this.state.isPending}
            />
          </Modal.Footer>
        </Modal.Body>
      </bem.GraphSettings>
    );
  }
}

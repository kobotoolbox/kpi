// Libraries
import React from 'react';
import clonedeep from 'lodash.clonedeep';

// Partial components
import Radio from 'js/components/common/radio';
import Modal from 'js/components/common/modal';
import ChartTypePicker from './chartTypePicker.component';
import ChartColorsPicker from './chartColorsPicker.component';
import Button from 'js/components/common/button';
import ReportsModalTabs, {DEFAULT_REPORTS_MODAL_TAB} from 'js/components/reports/reportsModalTabs.component';

// Utilities
import bem from 'js/bem';
import {actions} from 'js/actions';
import {handleApiFail} from 'jsapp/js/api';

// Types & constants
import type {FailResponse, LabelValuePair} from 'js/dataInterface';
import {
  DEFAULT_MINIMAL_REPORT_STYLE,
  type ReportStyle,
  type ReportStyleName,
} from './reportsConstants';
import type {ReportsState} from './reports';
import type {ReportsModalTabName} from 'js/components/reports/reportsModalTabs.component';

interface ReportStyleSettingsProps {
  parentState: ReportsState;
}

interface ReportStyleSettingsState {
  activeModalTab: ReportsModalTabName;
  reportStyle: ReportStyle;
  isPending: boolean;
}

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
      reportStyle: initialReportStyle || DEFAULT_MINIMAL_REPORT_STYLE,
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

  toggleTab(tabName: ReportsModalTabName) {
    this.setState({activeModalTab: tabName});
  }

  reportColorsChange({}, value: {report_colors: string[]}) {
    const newStyle = clonedeep(this.state.reportStyle);
    Object.assign(newStyle, value);
    this.setState({reportStyle: newStyle});
  }

  reportTypeChange({}, value: {report_type: ReportStyleName}) {
    const newStyle = clonedeep(this.state.reportStyle);
    Object.assign(newStyle, value);
    this.setState({reportStyle: newStyle});
  }

  reportSizeChange(params: {id: string; value: number}) {
    if (params.id === 'width') {
      const newStyle = clonedeep(this.state.reportStyle);
      newStyle.graphWidth = params.value;
      this.setState({reportStyle: newStyle});
    }
  }

  translationIndexChange(newIndex: string) {
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
        groupByOptions.push({
          value: val,
          label: label,
        });
      }
    }

    const tabs: ReportsModalTabName[] = ['chart-type', 'colors'];

    if (groupByOptions.length > 1) {
      tabs.push('group-by');
    }

    const selectedTranslationOptions: LabelValuePair[] = [];
    if (translations.length > 1) {
      tabs.push('translation');
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
            {this.state.activeModalTab === 'chart-type' && (
              <div id='graph-type'>
                <ChartTypePicker
                  defaultStyle={reportStyle}
                  onChange={this.reportTypeChange.bind(this)}
                />
              </div>
            )}
            {this.state.activeModalTab === 'colors' && (
              <div id='graph-colors'>
                <ChartColorsPicker
                  defaultStyle={reportStyle}
                  onChange={this.reportColorsChange.bind(this)}
                />
              </div>
            )}
            {this.state.activeModalTab === 'group-by' &&
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
            {this.state.activeModalTab === 'translation' &&
              selectedTranslationOptions.length > 1 && (
                <div className='graph-tab__translation' id='graph-labels'>
                  <Radio
                    name='reports-selected-translation'
                    options={selectedTranslationOptions}
                    onChange={this.translationIndexChange.bind(this)}
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

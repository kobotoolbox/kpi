// Libraries
import React from 'react';
import clonedeep from 'lodash.clonedeep';

// Partial components
import bem from 'js/bem';
import Modal from 'js/components/common/modal';
import ChartTypePicker from './chartTypePicker.component';
import ChartColorsPicker from './chartColorsPicker.component';
import Button from 'js/components/common/button';
import ReportsModalTabs, {DEFAULT_REPORTS_MODAL_TAB} from 'js/components/reports/reportsModalTabs.component';

// Utilities
import {actions} from 'js/actions';

// Types
import type {ReportStyle, ReportStyleName} from './reportsConstants';
import type {ReportsState} from './reports';
import type {ReportsModalTabName} from 'js/components/reports/reportsModalTabs.component';

interface QuestionGraphSettingsProps {
  parentState: ReportsState;
  question: string;
}

interface QuestionGraphSettingsState {
  activeModalTab: ReportsModalTabName;
  reportStyle: ReportStyle;
}

export default class QuestionGraphSettings extends React.Component<
  QuestionGraphSettingsProps,
  QuestionGraphSettingsState
> {
  constructor(props: QuestionGraphSettingsProps) {
    super(props);

    this.state = {
      activeModalTab: DEFAULT_REPORTS_MODAL_TAB,
      reportStyle: {},
    };
  }

  toggleTab(tabName: ReportsModalTabName) {
    this.setState({activeModalTab: tabName});
  }

  componentDidMount() {
    let specificSettings: {[rowName: string]: ReportStyle} | ReportStyle | undefined;

    if (!this.props.parentState.currentCustomReport) {
      specificSettings = this.props.parentState.reportStyles?.specified;
    } else {
      specificSettings = this.props.parentState.currentCustomReport.specified;
    }

    if (
      specificSettings &&
      this.props.question in specificSettings &&
      specificSettings?.[this.props.question] &&
      Object.keys(specificSettings[this.props.question]).length
    ) {
      const reportStyle = Object.assign({}, specificSettings[this.props.question]);
      this.setState({reportStyle: reportStyle});
    }
  }

  saveQS(reset: boolean) {
    const assetUid = this.props.parentState.asset?.uid;
    const customReport = this.props.parentState.currentCustomReport;

    if (!assetUid) {
      return;
    }

    if (!customReport) {
      const parentReportStyles = this.props.parentState.reportStyles;
      if (parentReportStyles) {
        parentReportStyles.specified[this.props.question] = reset ? {} : this.state.reportStyle;
        actions.reports.setStyle(assetUid, parentReportStyles);
      }
    } else {
      // TODO FIXME: we are mutating parent state data here (we shouldn't!)
      const parentReportCustom = this.props.parentState.asset?.report_custom;

      if (parentReportCustom) {
        const newStyle = reset ? {} : this.state.reportStyle;

        if (parentReportCustom[customReport.crid].specified === undefined) {
          parentReportCustom[customReport.crid].specified = {};
        }

        // `specified` is definitely defined here, but TS needs this check
        if (parentReportCustom[customReport.crid].specified) {
          parentReportCustom[customReport.crid].specified = newStyle;
        }

        actions.reports.setCustom(assetUid, parentReportCustom);
      }
    }
  }

  anyQuestionStyleChange(
    params: {
      default?: boolean;
      id?: string;
      value?: number | boolean;
    },
    value: ReportStyle
  ) {
    const newStyles = clonedeep(this.state.reportStyle);

    if (value?.report_type) {
      newStyles.report_type = value.report_type;
    }
    if (value?.report_colors) {
      newStyles.report_colors = value.report_colors;
    }
    if (params && params.id === 'width') {
      newStyles.width = params.value;
    }

    this.setState({reportStyle: newStyles});
  }

  render() {
    return (
      <bem.GraphSettings>
        <Modal.Tabs>
          <ReportsModalTabs
            tabs={['chart-type', 'colors']}
            activeTabName={this.state.activeModalTab}
            onRequestTabChange={this.toggleTab.bind(this)}
          />
        </Modal.Tabs>

        <Modal.Body>
          <div className='tabs-content'>
            {this.state.activeModalTab === 'chart-type' && (
              <div id='graph-type'>
                <ChartTypePicker
                  defaultStyle={this.state.reportStyle}
                  onChange={this.anyQuestionStyleChange.bind(this)}
                />
              </div>
            )}
            {this.state.activeModalTab === 'colors' && (
              <div id='graph-colors'>
                <ChartColorsPicker
                  defaultStyle={this.state.reportStyle}
                  onChange={this.anyQuestionStyleChange.bind(this)}
                />
              </div>
            )}
          </div>
        </Modal.Body>

        <Modal.Footer>
          {(this.state.reportStyle.report_type ||
            this.state.reportStyle.report_colors ||
            this.state.reportStyle.width) && (
            <Button
              type='danger'
              size='l'
              onClick={this.saveQS.bind(this, true)}
              label={t('Reset')}
            />
          )}

          <Button
            type='primary'
            size='l'
            onClick={this.saveQS.bind(this, false)}
            label={t('Save')}
          />
        </Modal.Footer>
      </bem.GraphSettings>
    );
  }
}

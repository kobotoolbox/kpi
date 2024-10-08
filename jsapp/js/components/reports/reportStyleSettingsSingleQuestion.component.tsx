// Libraries
import React from 'react';
import clonedeep from 'lodash.clonedeep';

// Partial components
import bem from 'js/bem';
import Modal from 'js/components/common/modal';
import ReportTypeEditor from './reportTypeEditor.component';
import ReportColorsEditor from './reportColorsEditor.component';
import Button from 'js/components/common/button';
import ReportsModalTabs, {ReportsModalTabNames, DEFAULT_REPORTS_MODAL_TAB} from 'js/components/reports/reportsModalTabs.component';

// Utilities
import {actions} from 'js/actions';
import {handleApiFail} from 'js/api';

// Types & constants
import type {ReportStyleName, ReportStyle} from './reportsConstants';
import type {ReportsState} from './reports';
import type {FailResponse} from 'js/dataInterface';

interface ReportStyleSettingsSingleQuestionProps {
  parentState: ReportsState;
  question: string;
}

interface ReportStyleSettingsSingleQuestionState {
  activeModalTab: ReportsModalTabNames;
  reportStyle: ReportStyle;
  isPending: boolean;
}

/**
 * This is a component that is being used for editing report styles for a single
 * question. So basically for overriding the main report settings.
 *
 * It displays 2 available tabs ("type" and "color").
 */
export default class ReportStyleSettingsSingleQuestion extends React.Component<
  ReportStyleSettingsSingleQuestionProps,
  ReportStyleSettingsSingleQuestionState
> {
  private unlisteners: Function[] = [];

  constructor(props: ReportStyleSettingsSingleQuestionProps) {
    super(props);

    this.state = {
      activeModalTab: DEFAULT_REPORTS_MODAL_TAB,
      reportStyle: {},
      isPending: false,
    };
  }

  toggleTab(tabName: ReportsModalTabNames) {
    this.setState({activeModalTab: tabName});
  }

  componentDidMount() {
    this.unlisteners.push(
      actions.reports.setStyle.completed.listen(this.onSetStyleCompleted.bind(this)),
      actions.reports.setStyle.failed.listen(this.onSetStyleFailed.bind(this)),
      actions.reports.setCustom.completed.listen(this.onSetCustomCompleted.bind(this)),
      actions.reports.setCustom.failed.listen(this.onSetCustomFailed.bind(this)),
    );

    let specificSettings: {[rowName: string]: ReportStyle} | undefined;

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


  saveSettings(reset: boolean) {
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
        this.setState({isPending: true});
      }
    } else {
      // TODO FIXME: we are mutating parent state data here (we shouldn't!)
      const parentReportCustom = this.props.parentState.asset?.report_custom;

      if (parentReportCustom) {
        const newStyle = reset ? {} : this.state.reportStyle;

        const cridReport = parentReportCustom[customReport.crid];

        if (cridReport.specified === undefined) {
          cridReport.specified = {};
        }

        // `specified` is definitely defined here, but TS needs this check
        if (cridReport?.specified !== undefined) {
          cridReport.specified[this.props.question] = newStyle;
        }

        actions.reports.setCustom(assetUid, parentReportCustom, customReport.crid);
        this.setState({isPending: true});
      }
    }
  }

  onReportTypeChange(newType: ReportStyleName) {
    const newStyles = clonedeep(this.state.reportStyle);
    newStyles.report_type = newType;
    this.setState({reportStyle: newStyles});
  }

  onReportColorsChange(newColors: string[]) {
    const newStyles = clonedeep(this.state.reportStyle);
    newStyles.report_colors = newColors;
    this.setState({reportStyle: newStyles});
  }

  render() {
    return (
      <bem.GraphSettings>
        <Modal.Tabs>
          <ReportsModalTabs
            tabs={[ReportsModalTabNames['chart-type'], ReportsModalTabNames.colors]}
            activeTabName={this.state.activeModalTab}
            onRequestTabChange={this.toggleTab.bind(this)}
          />
        </Modal.Tabs>

        <Modal.Body>
          <div className='tabs-content'>
            {this.state.activeModalTab === ReportsModalTabNames['chart-type'] && (
              <div id='graph-type'>
                <ReportTypeEditor
                  style={this.state.reportStyle}
                  onChange={this.onReportTypeChange.bind(this)}
                />
              </div>
            )}
            {this.state.activeModalTab === ReportsModalTabNames.colors && (
              <div id='graph-colors'>
                <ReportColorsEditor
                  style={this.state.reportStyle}
                  onChange={this.onReportColorsChange.bind(this)}
                />
              </div>
            )}
          </div>
        </Modal.Body>

        <Modal.Footer>
          {(this.state.reportStyle.report_type ||
            this.state.reportStyle.report_colors) && (
            <Button
              type='danger'
              size='l'
              onClick={this.saveSettings.bind(this, true)}
              label={t('Reset')}
              isPending={this.state.isPending}
            />
          )}

          <Button
            type='primary'
            size='l'
            onClick={this.saveSettings.bind(this, false)}
            label={t('Save')}
            isPending={this.state.isPending}
          />
        </Modal.Footer>
      </bem.GraphSettings>
    );
  }
}

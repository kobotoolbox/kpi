// Libraries
import React from 'react';
import clonedeep from 'lodash.clonedeep';

// Partial components
import bem from 'js/bem';
import Checkbox from 'js/components/common/checkbox';
import Button from 'js/components/common/button';
import TextBox from 'js/components/common/textBox';

// Utilities
import {actions} from 'js/actions';

// Types
import type {
  CustomReport,
  ReportsResponse,
} from 'js/components/reports/reportsConstants';
import type {AssetResponse} from 'js/dataInterface';

interface CustomReportFormProps {
  reportData: ReportsResponse[];
  customReport: CustomReport;
  asset: AssetResponse;
}

interface CustomReportFormState {
  customReport: CustomReport;
}

export default class CustomReportForm extends React.Component<
  CustomReportFormProps,
  CustomReportFormState
> {
  constructor(props: CustomReportFormProps) {
    super(props);

    this.state = {
      customReport: props.customReport,
    };
  }

  onCustomReportNameChange(newName: string) {
    const newReport = clonedeep(this.state.customReport);
    newReport.name = newName;
    this.setState({customReport: newReport});
  }

  customReportQuestionChange(name: string, isChecked: boolean) {
    const newReport = clonedeep(this.state.customReport);

    if (isChecked) {
      newReport.questions.push(name);
    } else {
      newReport.questions.splice(newReport.questions.indexOf(name), 1);
    }
    this.setState({customReport: newReport});
  }

  saveCustomReport() {
    const report_custom = this.props.asset.report_custom || {};
    const crid = this.state.customReport.crid;

    report_custom[crid] = this.state.customReport;
    actions.reports.setCustom(this.props.asset.uid, report_custom);
  }

  deleteCustomReport() {
    const report_custom = this.props.asset.report_custom || {};
    const crid = this.state.customReport.crid;

    delete report_custom[crid];
    actions.reports.setCustom(this.props.asset.uid, report_custom);
  }

  render() {
    const crid = this.state.customReport.crid;

    return (
      <div className='custom-report-form'>
        <div className='custom-report--title'>
          <TextBox
            value={this.state.customReport.name}
            placeholder={t('Untitled Report')}
            onChange={this.onCustomReportNameChange.bind(this)}
          />
        </div>

        <strong>{t('Include the following questions:')}</strong>

        <div className='custom-report--questions'>
          {this.props.reportData.map((item, index) => {
            let label = t('Unlabeled');
            if (item.row.label?.[0] && item.row.label[0] !== null) {
              label = item.row.label[0];
            }

            return (
              <div className='graph-settings__question' key={index}>
                <Checkbox
                  checked={this.state.customReport.questions.includes(item.name)}
                  onChange={this.customReportQuestionChange.bind(this, item.name)}
                  label={label}
                />
              </div>
            );
          })}
        </div>

        <bem.Modal__footer>
          {this.props.asset.report_custom?.[crid] && (
            <Button
              type='danger'
              size='l'
              onClick={this.deleteCustomReport.bind(this)}
              label={t('Delete')}
            />
          )}

          <Button
            type='primary'
            size='l'
            onClick={this.saveCustomReport.bind(this)}
            label={t('Save')}
          />
        </bem.Modal__footer>
      </div>
    );
  }
}

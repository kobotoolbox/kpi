import React from 'react';
import autoBind from 'react-autobind';
import Checkbox from 'js/components/common/checkbox';
import {actions} from 'js/actions';
import bem from 'js/bem';

export default class CustomReportForm extends React.Component {
  constructor(props) {
    super(props);
    autoBind(this);

    this.state = {
      customReport: props.customReport,
    };
  }

  customReportNameChange(evt) {
    var report = this.state.customReport;
    report.name = evt.target.value;
    this.setState({customReport: report});
  }

  customReportQuestionChange(name, isChecked) {
    var r = this.state.customReport;

    if (isChecked) {
      r.questions.push(name);
    } else {
      r.questions.splice(r.questions.indexOf(name), 1);
    }
    this.setState({customReport: r});
  }

  saveCustomReport() {
    let report_custom = this.props.asset.report_custom;
    const crid = this.state.customReport.crid;

    report_custom[crid] = this.state.customReport;
    actions.reports.setCustom(this.props.asset.uid, report_custom);
  }

  deleteCustomReport() {
    let report_custom = this.props.asset.report_custom;
    const crid = this.state.customReport.crid;

    delete report_custom[crid];
    actions.reports.setCustom(this.props.asset.uid, report_custom);
  }

  render() {
    const crid = this.state.customReport.crid;
    var questionList = this.props.reportData.map(function (q, i) {
      return (
        <div className='graph-settings__question' key={i}>
          <Checkbox
            checked={this.state.customReport.questions.includes(q.name)}
            onChange={this.customReportQuestionChange.bind(this, q.name)}
            label={q.row.label ? q.row.label[0] : t('Unlabeled')}
          />
        </div>
      );
    }, this);

    return (
      <div className='custom-report-form'>
        <div className='custom-report--title'>
          <input
            type='text'
            name='title'
            value={this.state.customReport.name}
            placeholder={t('Untitled Report')}
            onChange={this.customReportNameChange}
          />
        </div>

        <strong>{t('Include the following questions:')}</strong>

        <div className='custom-report--questions'>{questionList}</div>

        <bem.Modal__footer>
          {this.props.asset.report_custom[crid] && (
            <bem.KoboButton m='red' onClick={this.deleteCustomReport}>
              {t('Delete')}
            </bem.KoboButton>
          )}
          <bem.KoboButton m='blue' onClick={this.saveCustomReport}>
            {t('Save')}
          </bem.KoboButton>
        </bem.Modal__footer>
      </div>
    );
  }
}

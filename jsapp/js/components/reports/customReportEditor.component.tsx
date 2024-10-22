// Libraries
import React from 'react';
import clonedeep from 'lodash.clonedeep';

// Partial components
import bem from 'js/bem';
import Modal from 'js/components/common/modal';
import Checkbox from 'js/components/common/checkbox';
import Button from 'js/components/common/button';
import TextBox from 'js/components/common/textBox';

// Utilities
import {actions} from 'js/actions';
import {getReportRowTranslatedLabel} from './reports.utils';
import {handleApiFail} from 'js/api';

// Types
import type {
  CustomReportSettings,
  ReportsResponse,
} from 'js/components/reports/reportsConstants';
import type {
  AssetResponse,
  FailResponse,
} from 'js/dataInterface';

interface CustomReportEditorProps {
  reportData: ReportsResponse[];
  customReport: CustomReportSettings;
  asset: AssetResponse;
}

interface CustomReportEditorState {
  customReport: CustomReportSettings;
  isPending: boolean;
}

/**
 * This component is being used to create or modify custom report.
 */
export default class CustomReportEditor extends React.Component<
  CustomReportEditorProps,
  CustomReportEditorState
> {
  private unlisteners: Function[] = [];

  constructor(props: CustomReportEditorProps) {
    super(props);

    this.state = {
      customReport: props.customReport,
      isPending: false,
    };
  }

  componentDidMount() {
    this.unlisteners.push(
      actions.reports.setCustom.completed.listen(this.onSetCustomCompleted.bind(this)),
      actions.reports.setCustom.failed.listen(this.onSetCustomFailed.bind(this)),
    );
  }

  componentWillUnmount() {
    this.unlisteners.forEach((clb) => clb());
  }

  onSetCustomCompleted(_response: AssetResponse) {
    this.setState({isPending: false});
  }

  onSetCustomFailed(response: FailResponse) {
    handleApiFail(response);
    this.setState({isPending: false});
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

  /** Pass `null` to delete report */
  updateAssetCustomReports(crid: string, newReport: CustomReportSettings | null) {
    const assetCustomReports = clonedeep(this.props.asset.report_custom || {});
    if (newReport === null) {
      delete assetCustomReports[crid];
    } else {
      assetCustomReports[crid] = newReport;
    }
    actions.reports.setCustom(this.props.asset.uid, assetCustomReports, crid);
    this.setState({isPending: true});
  }

  render() {
    const crid = this.state.customReport.crid;

    return (
      <bem.GraphSettings>
        <Modal.Body>
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
                const label = getReportRowTranslatedLabel(
                  item,
                  this.props.asset.content?.survey,
                  0
                );

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
                  onClick={() => {
                    this.updateAssetCustomReports(
                      this.state.customReport.crid,
                      null
                    );
                  }}
                  label={t('Delete')}
                  isPending={this.state.isPending}
                />
              )}

              <Button
                type='primary'
                size='l'
                onClick={() => {
                  this.updateAssetCustomReports(
                    this.state.customReport.crid,
                    this.state.customReport
                  );
                }}
                label={t('Save')}
                isPending={this.state.isPending}
              />
            </bem.Modal__footer>
          </div>
        </Modal.Body>
      </bem.GraphSettings>
    );
  }
}

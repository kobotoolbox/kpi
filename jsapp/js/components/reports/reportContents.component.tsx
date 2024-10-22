// Libraries
import React from 'react';
import bem from 'js/bem';

// Partial components
import ReportViewItem from './reportViewItem.component';

// Utils
import {getReportRowTranslatedLabel} from './reports.utils';

// Types & constants
import {QUESTION_TYPES} from 'js/constants';
import type {ReportsState} from './reports';
import type {ReportStyle, ReportsResponse} from './reportsConstants';
import type {AssetResponse} from 'jsapp/js/dataInterface';

interface ReportContentsProps {
  triggerQuestionSettings: (questionName: string) => void;
  parentState: ReportsState;
  reportData: ReportsResponse[];
  asset: AssetResponse;
}

export default class ReportContents extends React.Component<ReportContentsProps> {
  shouldComponentUpdate(nextProps: ReportContentsProps) {
    // to improve UI performance, don't refresh report while a modal window is visible
    if (
      nextProps.parentState.showReportGraphSettings ||
      nextProps.parentState.showCustomReportModal ||
      nextProps.parentState.currentQuestionGraph
    ) {
      return false;
    } else {
      return true;
    }
  }

  render() {
    let translationIndex = 0;
    const customReport = this.props.parentState.currentCustomReport;
    const defaultRS = this.props.parentState.reportStyles;
    const asset = this.props.asset;
    const groupBy = this.props.parentState.groupBy;

    if (customReport) {
      if (customReport.reportStyle?.translationIndex) {
        translationIndex = customReport.reportStyle.translationIndex;
      }
    } else {
      translationIndex = defaultRS?.default?.translationIndex || 0;
    }

    // reset to first language if translation index cannot be found
    if (
      asset?.content?.translations &&
      !asset.content?.translations[translationIndex]
    ) {
      translationIndex = 0;
    }

    const reportData = this.props.reportData;

    // TODO: the code below is very convoluted and hard to read/understand, even
    // with all the types in place. Please consider rewriting it from scratch
    for (let i = reportData.length - 1; i > -1; i--) {
      const rowName = reportData[i].name;
      const rowType = reportData[i].row.type || null;
      let specifiedReportStyles: ReportStyle | undefined;

      if (customReport) {
        if (customReport.specified?.[rowName]) {
          specifiedReportStyles = customReport.specified[rowName];
        }
      } else {
        specifiedReportStyles = defaultRS?.specified?.[rowName];
      }

      if (specifiedReportStyles && Object.keys(specifiedReportStyles).length) {
        reportData[i].style = specifiedReportStyles;
      } else if (customReport?.reportStyle) {
        reportData[i].style = customReport.reportStyle;
      } else if (defaultRS?.default) {
        reportData[i].style = defaultRS.default;
      }

      if (
        asset?.content?.choices &&
        (
          rowType === QUESTION_TYPES.select_one.id ||
          rowType === QUESTION_TYPES.select_multiple.id
        )
      ) {
        const question = asset.content?.survey?.find((z) =>
          z.name === rowName || z.$autoname === rowName
        );
        const resps = reportData[i].data.responses;
        let choice;
        if (resps) {
          reportData[i].data.responseLabels = [];
          for (let j = resps.length - 1; j >= 0; j--) {
            choice = asset.content.choices.find((o) =>
              question &&
              o.list_name === question.select_from_list_name &&
              (o.name === resps[j])
            );
            if (choice?.label?.[translationIndex]) {
              reportData[i].data.responseLabels?.unshift(choice.label[translationIndex]);
            } else {
              reportData[i].data.responseLabels?.unshift(resps[j]);
            }
          }
        } else {
          const vals = reportData[i].data.values;
          if (vals?.[0]?.[1] && 'responses' in vals?.[0]?.[1] && vals?.[0]?.[1]?.responses) {
            const respValues = vals[0][1].responses;

            const newLabels: string[] = [];
            const qGB = asset.content?.survey?.find((z) =>
              z.name === groupBy || z.$autoname === groupBy
            );
            respValues.forEach((r, ind) => {
              choice = asset.content?.choices?.find((o) =>
                qGB &&
                o.list_name === qGB.select_from_list_name &&
                (o.label?.includes(r))
              );
              if (choice?.label?.[translationIndex]) {
                newLabels[ind] = choice.label[translationIndex];
              } else {
                newLabels[ind] = r;
              }
            });
            reportData[i].data.responseLabels = newLabels;

            for (let vD = vals.length - 1; vD >= 0; vD--) {
              choice = asset.content.choices.find((o) =>
                question &&
                o.list_name === question.select_from_list_name &&
                (o.name === String(vals[vD][0]) || o.$autoname === String(vals[vD][0]))
              );

              if (choice?.label?.[translationIndex]) {
                vals[vD][2] = choice.label[translationIndex];
              } else {
                vals[vD][2] = vals[vD][0];
              }
            }
          }
        }
      }
    }

    return (
      <div>
        {
          reportData.map((rowContent, i) => {
            if (!rowContent.data.provided) {
              return null;
            }

            const label = getReportRowTranslatedLabel(
              rowContent,
              this.props.asset.content?.survey,
              translationIndex
            );

            return (
              <bem.ReportView__item key={i}>
                <ReportViewItem
                  {...rowContent}
                  label={label}
                  triggerQuestionSettings={this.props.triggerQuestionSettings.bind(this)}
                />
              </bem.ReportView__item>
            );
          })
        }
      </div>
    );
  }
}

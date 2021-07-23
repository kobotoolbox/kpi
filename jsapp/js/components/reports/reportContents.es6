import React from 'react';
import _ from 'underscore';
import {bem} from 'js/bem';
import {QUESTION_TYPES} from 'js/constants';
import ReportViewItem from './reportViewItem';

export default class ReportContents extends React.Component {
  constructor(props) {
    super(props);
  }

  shouldComponentUpdate(nextProps) {
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
    var tnslIndex = 0;
    let customReport = this.props.parentState.currentCustomReport;
    let defaultRS = this.props.parentState.reportStyles;
    let asset = this.props.parentState.asset;
    let groupBy = this.props.parentState.groupBy;

    if (customReport) {
      if (customReport.reportStyle && customReport.reportStyle.translationIndex) {
        tnslIndex = parseInt(customReport.reportStyle.translationIndex);
      }
    } else {
      tnslIndex = defaultRS.default.translationIndex || 0;
    }

    // reset to first language if trnslt index cannot be found
    if (asset.content.translations && !asset.content.translations[tnslIndex]) {
      tnslIndex = 0;
    }

    var reportData = this.props.reportData;

    for (var i = reportData.length - 1; i > -1; i--) {
      const currentReport = reportData[i];
      const reportRowName = currentReport.name;
      const reportRowType = currentReport.row.type || null;
      let _defSpec = null;

      if (customReport) {
        if (customReport.specified && customReport.specified[reportRowName]) {
          _defSpec = customReport.specified[reportRowName];
        }
      } else {
        _defSpec = defaultRS.specified[reportRowName];
      }

      if (_defSpec && Object.keys(_defSpec).length) {
        currentReport.style = _defSpec;
      } else if (customReport && customReport.reportStyle) {
        currentReport.style = customReport.reportStyle;
      } else {
        currentReport.style = defaultRS.default;
      }

      if (
        (
          reportRowType === QUESTION_TYPES.select_one.id ||
          reportRowType === QUESTION_TYPES.select_multiple.id
        ) &&
        asset.content.choices
      ) {
        const reportRow = asset.content.survey.find((row) => {
          return row.name === reportRowName || row.$autoname === reportRowName;
        });
        let reportResponses = currentReport.data.responses;
        let choice;

        if (reportResponses) {
          // clear labels first
          currentReport.data.responseLabels = [];
          // loop responses backward
          for (let j = reportResponses.length - 1; j >= 0; j--) {
            const response = reportResponses[j];

            // NOTE: responses we get from backend are actually labels in
            // default language, so we can't be 100% sure which answer was
            // chosen. We try to find it by the label.
            choice = asset.content.choices.find((item) => {
              return (
                reportRow &&
                item.list_name === reportRow.select_from_list_name &&
                (item.label === response || item.label[0] === response)
              );
            });

            // if choice was found and has a label in desired language we
            // display it - otherwise we display the raw response (which is
            // aleady a label, not name value)
            if (choice && choice.label && choice.label[tnslIndex]) {
              currentReport.data.responseLabels.unshift(choice.label[tnslIndex]);
            } else {
              currentReport.data.responseLabels.unshift(response);
            }
          }
        } else {
          const vals = currentReport.data.values;
          if (vals && vals[0] && vals[0][1] && vals[0][1].responses) {
            var respValues = vals[0][1].responses;
            currentReport.data.responseLabels = [];
            let qGB = asset.content.survey.find((z) => {
              return z.name === groupBy || z.$autoname === groupBy;
            });

            respValues.forEach((response, ind) => {
              choice = asset.content.choices.find((item) => {
                return (
                  qGB &&
                  item.list_name === qGB.select_from_list_name &&
                  (item.name === response || item.$autoname === response)
                );
              });

              if (choice && choice.label && choice.label[tnslIndex]) {
                currentReport.data.responseLabels[ind] = choice.label[tnslIndex];
              } else {
                currentReport.data.responseLabels[ind] = response;
              }
            });

            // TODO: use a better way to store translated labels per row
            for (var vD = vals.length - 1; vD >= 0; vD--) {
              choice = asset.content.choices.find((o) => {
                return (
                  reportRow &&
                  o.list_name === reportRow.select_from_list_name &&
                  (o.name === vals[vD][0] || o.$autoname === vals[vD][0])
                );
              });
              if (choice && choice.label && choice.label[tnslIndex]) {
                vals[vD][2] = choice.label[tnslIndex];
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
            let label = t('Unlabeled');
            if (_.isArray(rowContent.row.label)) {
              label = rowContent.row.label[tnslIndex];
            } else if (_.isString(rowContent.row.label)) {
              label = rowContent.row.label;
            }

            if (!rowContent.data.provided) {
              return false;
            }

            return (
              <bem.ReportView__item key={i}>
                <ReportViewItem
                  {...rowContent}
                  label={label}
                  triggerQuestionSettings={this.props.triggerQuestionSettings}
                />
              </bem.ReportView__item>
            );
          })
        }
      </div>
    );
  }
}

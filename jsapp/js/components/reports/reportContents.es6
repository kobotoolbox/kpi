import React from 'react';
import _ from 'underscore';
import bem from 'js/bem';
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
      let _qn = reportData[i].name;
      let _type = reportData[i].row.type || null;
      let _defSpec;

      if (customReport) {
        if (customReport.specified && customReport.specified[_qn]) {
          _defSpec = customReport.specified[_qn];
        }
      } else {
        _defSpec = defaultRS.specified[_qn];
      }

      if (_defSpec && Object.keys(_defSpec).length) {
        reportData[i].style = _defSpec;
      } else if (customReport && customReport.reportStyle) {
        reportData[i].style = customReport.reportStyle;
      } else {
        reportData[i].style = defaultRS.default;
      }

      if (
        asset.content.choices &&
        (
          _type === QUESTION_TYPES.select_one.id ||
          _type === QUESTION_TYPES.select_multiple.id
        )
      ) {
        let question = asset.content.survey.find((z) => {
          return z.name === _qn || z.$autoname === _qn;
        });
        let resps = reportData[i].data.responses;
        let choice;
        if (resps) {
          reportData[i].data.responseLabels = [];
          for (var j = resps.length - 1; j >= 0; j--) {
            choice = asset.content.choices.find((o) => {
              return (
                question &&
                o.list_name === question.select_from_list_name &&
                (o.name === resps[j] || o.$autoname === resps[j])
              );
            });
            if (choice && choice.label && choice.label[tnslIndex]) {
              reportData[i].data.responseLabels.unshift(choice.label[tnslIndex]);
            } else {
              reportData[i].data.responseLabels.unshift(resps[j]);
            }
          }
        } else {
          const vals = reportData[i].data.values;
          if (vals && vals[0] && vals[0][1] && vals[0][1].responses) {
            var respValues = vals[0][1].responses;
            reportData[i].data.responseLabels = [];
            let qGB = asset.content.survey.find((z) => {
              return z.name === groupBy || z.$autoname === groupBy;
            });
            respValues.forEach(function(r, ind){
              choice = asset.content.choices.find((o) => {
                return (
                  qGB &&
                  o.list_name === qGB.select_from_list_name &&
                  (o.name === r || o.$autoname === r)
                );
              });
              if (choice?.label && choice.label[tnslIndex]) {
                reportData[i].data.responseLabels[ind] = choice.label[tnslIndex];
              } else {
                reportData[i].data.responseLabels[ind] = r;
              }
            });

            // TODO: use a better way to store translated labels per row
            for (var vD = vals.length - 1; vD >= 0; vD--) {
              choice = asset.content.choices.find((o) => {
                return (
                  question &&
                  o.list_name === question.select_from_list_name &&
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

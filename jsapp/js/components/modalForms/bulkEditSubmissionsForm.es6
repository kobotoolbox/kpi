import React from 'react';
import autoBind from 'react-autobind';
import {
  getSurveyFlatPaths,
  getFlatQuestionsList
} from 'js/assetUtils';
import {
  QUESTION_TYPES
} from 'js/constants';
import {bem} from 'js/bem';

/**
 * @prop asset
 * @prop data
 * @prop totalSubmissions
 * @prop selectedSubmissions
 */
class BulkEditSubmissionsForm extends React.Component {
  constructor(props) {
    super(props);
    autoBind(this);
  }

  componentDidMount() {
    console.log(this.props);
  }

  getDisplayData() {
    let questions = getFlatQuestionsList(this.props.asset.content.survey);
    let flatPaths = getSurveyFlatPaths(this.props.asset.content.survey);

    questions.forEach((question) => {
      question.selectedData = [];
      const questionPath = flatPaths[question.name];
      this.props.data.forEach((submissionData) => {
        if (this.props.selectedSubmissions.includes(String(submissionData._id))) {
          question.selectedData.push({
            sid: submissionData._id,
            value: submissionData[questionPath]
          });
        }
      });
    });
    return questions;
  }

  renderRow(question, itemIndex) {
    const typeDef = QUESTION_TYPES.get(question.type);
    const modifiers = ['columns', 'padding-small'];
    if (itemIndex !== 0) {
      modifiers.push('bordertop');
    }
    return (
      <bem.FormView__cell m={modifiers} key={itemIndex}>
        <bem.FormView__cell m='column-icon'>
          {/* fix icon for date time */}
          <i className={['fa', 'fa-lg', typeDef.faIcon].join(' ')}/>
        </bem.FormView__cell>

        <bem.FormView__cell m={['column-1', 'asset-content-summary-name']}>
          {question.parents.length > 0 &&
            <small>{question.parents.join(' / ') + ' /'}</small>
          }

          <div>
            {question.isRequired && <strong>*&nbsp;</strong>}
            {question.label}
          </div>
        </bem.FormView__cell>

        <bem.FormView__cell m={['column-1']}>
          {question.selectedData.length > 0 && this.renderDataValues(question.selectedData)}
        </bem.FormView__cell>

        <bem.FormView__cell>
          <button>{t('Edit')}</button>
        </bem.FormView__cell>
      </bem.FormView__cell>
    );
  }

  renderDataValues(rowData) {
    const uniqueValues = new Set();
    rowData.forEach((item) => {
      if (item.value) {
        uniqueValues.add(item.value);
      }
    });
    return Array.from(uniqueValues).join(', ');
  }

  render() {
    const displayData = this.getDisplayData();

    return (
      <bem.FormView__cell m='box'>
        {displayData.map(this.renderRow)}
      </bem.FormView__cell>
    );
  }
}

export default BulkEditSubmissionsForm;

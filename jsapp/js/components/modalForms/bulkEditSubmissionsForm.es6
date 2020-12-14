import React from 'react';
import autoBind from 'react-autobind';
import clonedeep from 'lodash.clonedeep';
import {
  getSurveyFlatPaths,
  getFlatQuestionsList
} from 'js/assetUtils';
import {
  QUESTION_TYPES
} from 'js/constants';
import {bem} from 'js/bem';
import TextBox from 'js/components/textBox'

/**
 * @prop onSetModalTitle
 * @prop asset
 * @prop data
 * @prop totalSubmissions
 * @prop selectedSubmissions
 */
class BulkEditSubmissionsForm extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      isPending: false,
      overrides: {},
      selectedQuestion: null, // or object
      selectedQuestionOverride: null,
    };
    autoBind(this);
  }

  componentDidMount() {
    this.setModalTitleToList();
  }

  setModalTitleToList() {
    this.props.onSetModalTitle(
      t('Displaying multiple submissions (##count## selected of ##total##)')
        .replace('##count##', this.props.selectedSubmissions.length)
        .replace('##total##', this.props.totalSubmissions)
    );
  }

  setModalTitleToQuestion(questionName) {
    this.props.onSetModalTitle(
      t('Editing "##question##" for ##count## submissions')
        .replace('##question##', questionName)
        .replace('##count##', this.props.selectedSubmissions.length)
    );
  }

  onRowOverrideChange(questionName, value) {
    if (questionName === this.state.selectedQuestion.name) {
      this.setState({selectedQuestionOverride: value});
    }
  }

  onSubmit() {
    console.log(this.state.overrides);
  }

  onReset() {
    this.setState({overrides: {}});
  }

  selectQuestion(question) {
    this.setState({
      selectedQuestion: question,
      selectedQuestionOverride: this.state.overrides[question.name],
    });
    this.setModalTitleToQuestion(question.label);
  }

  goBackToList() {
    this.setState({
      selectedQuestion: null,
      selectedQuestionOverride: null,
    });
    this.setModalTitleToList();
  }

  saveOverride() {
    const newOverrides = clonedeep(this.state.overrides);
    if (
      typeof this.state.selectedQuestionOverride === 'string' &&
      this.state.selectedQuestionOverride.length >= 1
    ) {
      newOverrides[this.state.selectedQuestion.name] = this.state.selectedQuestionOverride;
    } else {
      delete newOverrides[this.state.selectedQuestion.name];
    }
    this.setState({overrides: newOverrides});
    this.goBackToList();
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
          {this.state.overrides[question.name] &&
            this.state.overrides[question.name]
          }
          {!this.state.overrides[question.name] && question.selectedData.length > 0 &&
            this.renderDataValues(question.selectedData)
          }
        </bem.FormView__cell>

        <bem.FormView__cell>
          <button onClick={this.selectQuestion.bind(this, question)}>{t('Edit')}</button>
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

  renderList() {
    const displayData = this.getDisplayData();

    return (
      <React.Fragment>
        <bem.FormModal__item m='wrapper'>
          {displayData.map(this.renderRow)}
        </bem.FormModal__item>

        <bem.Modal__footer>
          <bem.KoboButton
            m='red'
            type='button'
            onClick={this.onReset}
            disabled={this.state.isPending || Object.keys(this.state.overrides).length === 0}
          >
            {t('Discard Changes')}
          </bem.KoboButton>

          <bem.KoboButton
            m='blue'
            type='submit'
            onClick={this.onSubmit}
            disabled={this.state.isPending}
          >
            {t('Confirm & close')}
          </bem.KoboButton>
        </bem.Modal__footer>
      </React.Fragment>
    );
  }

  renderSelectedQuestion() {
    return (
      <React.Fragment>
        <bem.FormModal__item m='wrapper'>
          <BulkEditRowForm
            question={this.state.selectedQuestion}
            overrideData={this.state.selectedQuestionOverride}
            originalData={this.state.selectedQuestion.selectedData}
            onChange={this.onRowOverrideChange}
          />
        </bem.FormModal__item>

        <bem.Modal__footer>
          <bem.KoboButton
            m='whitegray'
            type='button'
            onClick={this.goBackToList}
          >
            {t('Back')}
          </bem.KoboButton>

          <bem.KoboButton
            m='blue'
            type='button'
            onClick={this.saveOverride}
          >
            {t('Save')}
          </bem.KoboButton>
        </bem.Modal__footer>
      </React.Fragment>
    );
  }

  render() {
    return (
      <bem.FormModal__form className='bulk-edit-submissions-form'>
        {this.state.selectedQuestion === null && this.renderList() }
        {this.state.selectedQuestion !== null && this.renderSelectedQuestion() }
      </bem.FormModal__form>
    );
  }
}

/**
 * @prop question
 * @prop overrideData
 * @prop originalData
 * @prop onChange
 */
class BulkEditRowForm extends React.Component {
  constructor(props) {
    super(props);
    autoBind(this);
  }

  onChange(newValue) {
    this.props.onChange(this.props.question.name, newValue);

  }

  render() {
    let inputValue = '';
    if (this.props.overrideData) {
      // there is already an override value
      inputValue = this.props.overrideData;
    }

    let placeholderValue = '';
    if (
      this.props.originalData &&
      this.props.originalData.length === 1
    ) {
      // only one value means that all rows have the same value
      placeholderValue = this.props.originalData[0];
    } else if (
      this.props.originalData &&
      this.props.originalData.length >= 2
    ) {
      placeholderValue = t('Multiple values');
    }

    return (
      <React.Fragment>
        <TextBox
          type='text-multiline'
          value={inputValue}
          onChange={this.onChange}
          label={this.props.question.label}
          placeholder={placeholderValue}
        />
      </React.Fragment>
    );
  }
}

export default BulkEditSubmissionsForm;

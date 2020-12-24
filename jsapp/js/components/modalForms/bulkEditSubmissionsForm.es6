import React from 'react';
import autoBind from 'react-autobind';
import clonedeep from 'lodash.clonedeep';
import Fuse from 'fuse.js';
import {
  getSurveyFlatPaths,
  getFlatQuestionsList
} from 'js/assetUtils';
import {
  QUESTION_TYPES
} from 'js/constants';
import {bem} from 'js/bem';
import {actions} from 'js/actions';
import TextBox from 'js/components/textBox';

const FUSE_OPTIONS = {
  includeScore: true,
  minMatchCharLength: 1,
  shouldSort: false,
  ignoreFieldNorm: true,
  threshold: 0.2,
};

// we need a text to display when we need to say "this question has no answer"
const EMPTY_VALUE_LABEL = t('n/a');
// we need an override value that would mean "no answer" and that would be
// different than "no override answer" (de facto `undefined`)
const EMPTY_VALUE = null;
const MULTIPLE_VALUES_LABEL = t('Multiple responses');
const HELP_ARTICLE_URL = 'https://foo.bar';

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
      filterByName: '',
      filterByValue: '',
    };
    this.unlisteners = [];
    autoBind(this);
  }

  componentDidMount() {
    this.unlisteners.push(
      actions.submissions.bulkPatchValues.completed.listen(this.onBulkPatchValuesCompleted),
      actions.submissions.bulkPatchValues.failed.listen(this.onBulkPatchValuesFailed)
    );
    this.setModalTitleToList();
  }

  componentWillUnmount() {
    this.unlisteners.forEach((clb) => {clb();});
  }

  onBulkPatchValuesCompleted() {
    this.setState({isPending: false});
    this.props.onModalClose();
  }

  onBulkPatchValuesFailed() {
    this.setState({isPending: false});
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
      if (value === undefined) {
        this.setState({selectedQuestionOverride: EMPTY_VALUE});
      } else {
        this.setState({selectedQuestionOverride: value});
      }
    }
  }

  onSubmit() {
    this.setState({isPending: true});
    actions.submissions.bulkPatchValues(
      this.props.asset.uid,
      this.props.selectedSubmissions,
      this.state.overrides,
    );
  }

  onReset() {
    this.setState({overrides: {}});
  }

  onFilterByNameChange(newFilter) {
    this.setState({filterByName: newFilter});
  }

  onFilterByValueChange(newFilter) {
    this.setState({filterByValue: newFilter});
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
      this.state.selectedQuestionOverride === EMPTY_VALUE ||
      (
        typeof this.state.selectedQuestionOverride === 'string' &&
        this.state.selectedQuestionOverride.length >= 1
      )
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

  renderRow(questionData, itemIndex) {
    let question = questionData;
    if (typeof questionData.refIndex !== 'undefined') {
      question = questionData.item;
    }

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
          {this.renderDataValues(question.name, question.selectedData)}
        </bem.FormView__cell>

        <bem.FormView__cell>
          <button onClick={this.selectQuestion.bind(this, question)}>{t('Edit')}</button>
        </bem.FormView__cell>
      </bem.FormView__cell>
    );
  }

  renderDataValues(questionName, rowData) {
    const overrideValue = this.state.overrides[questionName];
    if (typeof overrideValue !== 'undefined') {
      if (overrideValue === null) {
        return (<strong>{EMPTY_VALUE_LABEL}</strong>);
      } else {
        return (<strong>{overrideValue}</strong>);
      }
    }

    const uniqueValues = new Set();
    rowData.forEach((item) => {
      if (item.value) {
        uniqueValues.add(item.value);
      } else {
        uniqueValues.add(EMPTY_VALUE_LABEL);
      }
    });
    const uniqueValuesArray = Array.from(uniqueValues);
    if (uniqueValuesArray.length === 1) {
      // if all rows have same value, we display it
      return uniqueValuesArray[0];
    } else {
      return MULTIPLE_VALUES_LABEL;
    }
  }

  renderList() {
    const displayData = this.getDisplayData();

    let finalData = displayData;
    let fuse = null;

    if (this.state.filterByName !== '') {
      fuse = new Fuse(finalData, {...FUSE_OPTIONS, keys: ['label']});
      finalData = fuse.search(this.state.filterByName);
    }
    if (this.state.filterByValue !== '') {
      fuse = new Fuse(finalData, {...FUSE_OPTIONS, keys: ['selectedData.value']});
      finalData = fuse.search(this.state.filterByValue);
    }

    return (
      <React.Fragment>
        <bem.FormModal__item m='wrapper'>
          {t('You are currently seeing multiple submissions at once. You can select specific questions to edit or remove reponses in bulk. If you want to edit only one submission, click on the desired submission on the navigation menu on the top-left corner of this table, or go back to the general table view. You can learn more about bulk actions')} <a href={HELP_ARTICLE_URL}>{t('in the help article')}</a>.
        </bem.FormModal__item>

        <bem.FormModal__item m='wrapper'>
          <bem.FormView__cell m={['columns', 'padding-small']}>
            <bem.FormView__cell m='column-icon'> </bem.FormView__cell>

            <bem.FormView__cell m={['column-1', 'asset-content-summary-name']}>
              <TextBox
                value={this.state.filterByName}
                onChange={this.onFilterByNameChange}
                placeholder={t('Type to filter')}
              />
            </bem.FormView__cell>

            <bem.FormView__cell m='column-1'>
              <TextBox
                value={this.state.filterByValue}
                onChange={this.onFilterByValueChange}
                placeholder={t('Type to filter')}
              />
            </bem.FormView__cell>
          </bem.FormView__cell>

          {finalData.map(this.renderRow)}
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
          {t('You are about to edit responses for one or multiple submissions at once. Use the XML syntax in the text box below. Learn more about how to edit specific responses for one or multiple submissions')} <a href={HELP_ARTICLE_URL} target='_blank'>{t('in the help article')}</a>.
        </bem.FormModal__item>
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

  getPlaceholderValue() {
    let placeholderValue = t('Type to override responses for selected submissions');
    if (this.props.overrideData === EMPTY_VALUE) {
      // user selected a "no answer" as a new override value for submissions
      placeholderValue = EMPTY_VALUE_LABEL;
    }
    return placeholderValue;
  }

  getUniqueResponses() {
    let uniqueResponses = new Map();
    this.props.originalData.forEach((item) => {
      if (uniqueResponses.has(item.value)) {
        uniqueResponses.set(item.value, uniqueResponses.get(item.value) + 1);
      } else {
        uniqueResponses.set(item.value, 1);
      }
    });
    // sort by popularity
    uniqueResponses = new Map([...uniqueResponses.entries()].sort((a, b) => {return b[1] - a[1];}));
    return uniqueResponses;
  }

  renderResponseRow(data) {
    const count = data[1];
    const response = data[0];

    let responseLabel = response;
    let responseValue = response;
    if (response === undefined) {
      responseLabel = EMPTY_VALUE_LABEL;
      responseValue = EMPTY_VALUE;
    }

    return (
      <div key={responseLabel}>
        <a onClick={this.onChange.bind(this, responseValue)}>{responseLabel}</a>: {count}
      </div>
    );
  }

  render() {
    let inputValue = '';
    if (typeof this.props.overrideData === 'string') {
      // there is already a non empty override value
      inputValue = this.props.overrideData;
    }

    return (
      <React.Fragment>
        <TextBox
          type='text-multiline'
          value={inputValue}
          onChange={this.onChange}
          placeholder={this.getPlaceholderValue()}
        />

        {Array.from(this.getUniqueResponses()).map(this.renderResponseRow)}
      </React.Fragment>
    );
  }
}

export default BulkEditSubmissionsForm;

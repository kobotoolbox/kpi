import React from 'react';
import autoBind from 'react-autobind';
import clonedeep from 'lodash.clonedeep';
import alertify from 'alertifyjs';
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

const EMPTY_VALUE_LABEL = t('n/a');
const MULTIPLE_VALUES_LABEL = t('Multiple responses');

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
      expandedRow: null,
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
      this.setState({selectedQuestionOverride: value});
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

  expandRowValues(rowName) {
    this.setState({expandedRow: rowName});
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
          {this.state.overrides[question.name] &&
            this.state.overrides[question.name]
          }
          {!this.state.overrides[question.name] && question.selectedData.length > 0 &&
            this.renderDataValues(question.name, question.selectedData)
          }
        </bem.FormView__cell>

        <bem.FormView__cell>
          <button onClick={this.selectQuestion.bind(this, question)}>{t('Edit')}</button>
        </bem.FormView__cell>
      </bem.FormView__cell>
    );
  }

  renderDataValues(questionName, rowData) {
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
    } else if (this.state.expandedRow === questionName) {
      return uniqueValuesArray.join(', ');
    } else {
      return (
        <React.Fragment>
          {MULTIPLE_VALUES_LABEL}
          <button
            className='mdl-button mdl-button--icon'
            onClick={this.expandRowValues.bind(this, questionName)}
          >
            <i className='k-icon k-icon-help'/>
          </button>
        </React.Fragment>
      );
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
          <bem.FormView__cell>
            <TextBox
              value={this.state.filterByName}
              onChange={this.onFilterByNameChange}
              label={t('Filter by name')}
            />

            <TextBox
              value={this.state.filterByValue}
              onChange={this.onFilterByValueChange}
              label={t('Filter by value')}
            />
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
      placeholderValue = MULTIPLE_VALUES_LABEL;
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

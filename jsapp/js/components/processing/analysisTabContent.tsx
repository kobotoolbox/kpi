import React from 'react';
import clonedeep from 'lodash.clonedeep';
import singleProcessingStore from 'js/components/processing/singleProcessingStore';
import bodyStyles from './processingBody.module.scss';
import AnalysisQuestionsList from './analysis/analysisQuestionsList.component';
import type {AnalysisQuestion} from './analysis/constants';
import Button from 'js/components/common/button';
import {generateUid} from 'jsapp/js/utils';

interface AnalysisTabContentState {
  questions: AnalysisQuestion[];
}

export default class AnalysisTabContent extends React.Component<
  {},
  AnalysisTabContentState
> {
  constructor(props: {}) {
    super(props);

    this.state = {
      questions: [],
    };
  }

  private unlisteners: Function[] = [];

  componentDidMount() {
    this.unlisteners.push(
      singleProcessingStore.listen(this.onSingleProcessingStoreChange, this)
    );
  }

  componentWillUnmount() {
    this.unlisteners.forEach((clb) => {
      clb();
    });
  }

  /**
   * Don't want to store a duplicate of store data here just for the sake of
   * comparison, so we need to make the component re-render itself when the
   * store changes :shrug:.
   */
  onSingleProcessingStoreChange() {
    this.forceUpdate();
  }

  onAddNewQuestion() {
    const newQuestions = clonedeep(this.state.questions);
    // Create an empty question
    newQuestions.push({
      type: 'aq_text',
      label: '',
      uid: generateUid(),
      response: '',
    });
    console.log('onAddNewQuestion', newQuestions);
    this.setState({questions: newQuestions});
  }

  /** Identifies what step should be displayed based on the data itself. */
  render() {
    return (
      <div className={bodyStyles.root}>
        <Button
          type='full'
          color='blue'
          size='m'
          startIcon='plus'
          label={t('Add question')}
          onClick={this.onAddNewQuestion.bind(this)}
        />

        <AnalysisQuestionsList
          questions={this.state.questions}
        />
      </div>
    );
  }
}

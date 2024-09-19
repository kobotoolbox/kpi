import React, {useState, useContext} from 'react';
import clonedeep from 'lodash.clonedeep';
import Icon from 'js/components/common/icon';
import Button from 'js/components/common/button';
import commonStyles from './common.module.scss';
import AnalysisQuestionsContext from 'js/components/processing/analysis/analysisQuestions.context';
import {
  findQuestion,
  getQuestionTypeDefinition,
  getQuestionsFromSchema,
  updateSurveyQuestions,
  hasManagePermissionsToCurrentAsset,
} from 'js/components/processing/analysis/utils';
import KoboPrompt from 'js/components/modals/koboPrompt';
import type {AnalysisQuestionInternal} from '../constants';
import singleProcessingStore from '../../singleProcessingStore';
import type {FailResponse} from 'js/dataInterface';
import {handleApiFail} from 'js/api';

interface ResponseFormHeaderProps {
  uuid: string;
}

/**
 * Displays question type icon, name, and an edit and delete buttons (if user
 * has sufficient permissions). Is being used in multiple other components.
 */
export default function ResponseFormHeader(props: ResponseFormHeaderProps) {
  const analysisQuestions = useContext(AnalysisQuestionsContext);
  if (!analysisQuestions) {
    return null;
  }

  // Get the question data from state (with safety check)
  const question = findQuestion(props.uuid, analysisQuestions.state);
  if (!question) {
    return null;
  }

  // Get the question definition (with safety check)
  const qaDefinition = getQuestionTypeDefinition(question.type);
  if (!qaDefinition) {
    return null;
  }

  const [isDeletePromptOpen, setIsDeletePromptOpen] = useState(false);

  /**
   * Means that user clicked "Edit" button and wants to start modyfing
   * the question definition.
   */
  function openQuestionInEditor() {
    analysisQuestions?.dispatch({
      type: 'startEditingQuestion',
      payload: {uuid: props.uuid},
    });
  }

  async function deleteQuestion() {
    analysisQuestions?.dispatch({
      type: 'deleteQuestion',
      payload: {uuid: props.uuid},
    });

    setIsDeletePromptOpen(false);

    // Step 1: ensure no mutations happen
    const newQuestions: AnalysisQuestionInternal[] =
      clonedeep(analysisQuestions?.state.questions) || [];

    // Step 2: set `deleted` flag on the question
    newQuestions.forEach((item: AnalysisQuestionInternal) => {
      if (item.uuid === props.uuid) {
        if (typeof item.options !== 'object') {
          item.options = {};
        }
        item.options.deleted = true;
      }
    });

    try {
      // Step 3: update asset endpoint with new questions
      const response = await updateSurveyQuestions(
        singleProcessingStore.currentAssetUid,
        newQuestions
      );

      // Step 4: update reducer's state with new list after the call finishes
      analysisQuestions?.dispatch({
        type: 'deleteQuestionCompleted',
        payload: {
          questions: getQuestionsFromSchema(response?.advanced_features),
        },
      });
    } catch (err) {
      handleApiFail(err as FailResponse);
      analysisQuestions?.dispatch({type: 'udpateQuestionFailed'});
    }
  }

  return (
    <header className={commonStyles.header}>
      <KoboPrompt
        isOpen={isDeletePromptOpen}
        onRequestClose={() => setIsDeletePromptOpen(false)}
        title={t('Delete this question?')}
        buttons={[
          {
            type: 'secondary',
            label: t('Cancel'),
            onClick: () => setIsDeletePromptOpen(false),
          },
          {
            type: 'danger',
            label: t('Delete'),
            onClick: deleteQuestion,
          },
        ]}
      >
        <p>
          {t(
            'Are you sure you want to delete this question? This action cannot be undone.'
          )}
        </p>
      </KoboPrompt>

      <div className={commonStyles.headerIcon}>
        <Icon name={qaDefinition.icon} size='xl' />
      </div>

      <label className={commonStyles.headerLabel}>
        {question.labels._default}
      </label>

      <Button
        type='secondary'
        size='s'
        startIcon='edit'
        onClick={openQuestionInEditor}
        // We only allow editing one question at a time, so adding new is not
        // possible until user stops editing
        isDisabled={
          !hasManagePermissionsToCurrentAsset() ||
          analysisQuestions.state.questionsBeingEdited.length !== 0 ||
          analysisQuestions.state.isPending
        }
      />

      <Button
        type='secondary-danger'
        size='s'
        startIcon='trash'
        onClick={() => setIsDeletePromptOpen(true)}
        isDisabled={
          !hasManagePermissionsToCurrentAsset() ||
          analysisQuestions.state.isPending
        }
      />
    </header>
  );
}

import React, {useContext} from 'react';
import AnalysisQuestionsContext from './analysisQuestions.context';
import styles from './analysisHeader.module.scss';
import Button from 'js/components/common/button';
import KoboDropdown from 'js/components/common/koboDropdown';
import {ANALYSIS_QUESTION_TYPES} from './constants';
import type {AnalysisQuestionTypeDefinition} from './constants';
import Icon from 'js/components/common/icon';
import singleProcessingStore from 'js/components/processing/singleProcessingStore';
import classNames from 'classnames';
import {hasManagePermissionsToCurrentAsset} from './utils';

/**
 * This piece of UI is displaying the button/dropdown for adding new questions
 * (definitions). It also has a saving state indicator.
 */
export default function AnalysisHeader() {
  const analysisQuestions = useContext(AnalysisQuestionsContext);
  if (!analysisQuestions) {
    return null;
  }

  const manualTypes = Object.values(ANALYSIS_QUESTION_TYPES).filter(
    (definition) => !definition.isAutomated
  );
  const automatedTypes = Object.values(ANALYSIS_QUESTION_TYPES).filter(
    (definition) => definition.isAutomated
  );

  function renderQuestionTypeButton(
    definition: AnalysisQuestionTypeDefinition
  ) {
    return (
      <li
        className={classNames({
          [styles.addQuestionMenuButton]: true,
          // We want to disable the Keyword Search question type when there is
          // no transcript or translation.
          [styles.addQuestionMenuButtonDisabled]:
            definition.type === 'qual_auto_keyword_count' &&
            singleProcessingStore.getTranscript() === undefined &&
            singleProcessingStore.getTranslations().length === 0,
        })}
        key={definition.type}
        onClick={() => {
          analysisQuestions?.dispatch({
            type: 'addQuestion',
            payload: {
              xpath: singleProcessingStore.currentQuestionXpath,
              type: definition.type,
            },
          });
        }}
        tabIndex={0}
      >
        <Icon name={definition.icon} />
        <label>{definition.label}</label>
      </li>
    );
  }

  return (
    <header className={styles.root}>
      <KoboDropdown
        placement={'down-left'}
        hideOnMenuClick
        triggerContent={
          <Button
            type='primary'
            size='m'
            startIcon='plus'
            label={t('Add question')}
          />
        }
        menuContent={
          <menu className={styles.addQuestionMenu}>
            {manualTypes.map(renderQuestionTypeButton)}
            {automatedTypes.length > 0 && (
              <>
                <li>
                  <h2>{t('Automated analysis')}</h2>
                </li>
                {automatedTypes.map(renderQuestionTypeButton)}
              </>
            )}
          </menu>
        }
        name='qualitative_analysis_add_question'
        // We only allow editing one question at a time, so adding new is not
        // possible until user stops editing
        isDisabled={
          !hasManagePermissionsToCurrentAsset() ||
          analysisQuestions?.state.questionsBeingEdited.length !== 0
        }
      />

      <span>
        {!analysisQuestions.state.isPending &&
          analysisQuestions.state.hasUnsavedWork &&
          t('Unsaved changes')}
        {analysisQuestions.state.isPending && t('Saving…')}
        {!analysisQuestions.state.hasUnsavedWork &&
          !analysisQuestions.state.isPending &&
          t('Saved')}
      </span>
    </header>
  );
}

import React, {useContext} from 'react';
import AnalysisQuestionsContext from './analysisQuestions.context';
import styles from './analysisHeader.module.scss';
import Button from 'js/components/common/button';
import KoboDropdown, {
  KoboDropdownPlacements,
} from 'js/components/common/koboDropdown';
import {ANALYSIS_QUESTION_DEFINITIONS} from './constants';
import type {AnalysisQuestionDefinition} from './constants';
import Icon from 'js/components/common/icon';

export default function AnalysisHeader() {
  const analysisQuestions = useContext(AnalysisQuestionsContext);

  const manualTypes = Object.values(ANALYSIS_QUESTION_DEFINITIONS).filter(
    (definition) => !definition.isAutomated
  );
  const automatedTypes = Object.values(ANALYSIS_QUESTION_DEFINITIONS).filter(
    (definition) => definition.isAutomated
  );

  function renderQuestionTypeButton(definition: AnalysisQuestionDefinition) {
    return (
      <li
        className={styles.addQuestionMenuButton}
        key={definition.type}
        onClick={() => {
          analysisQuestions?.dispatch({
            type: 'addQuestion',
            payload: {type: definition.type},
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
        placement={KoboDropdownPlacements['down-left']}
        hideOnMenuClick
        triggerContent={
          <Button
            type='full'
            color='blue'
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
          analysisQuestions?.state.questionsBeingEdited.length !== 0 ||
          analysisQuestions?.state.isPending
        }
      />

      <span>
        {analysisQuestions?.state.isPending && t('Saving…')}
        {!analysisQuestions?.state.isPending && t('Saved')}
      </span>
    </header>
  );
}

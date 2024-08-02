import React, {useContext} from 'react';
import CommonHeader from './commonHeader.component';
import commonStyles from './common.module.scss';
import styles from './keywordSearchResponseForm.module.scss';
import Button from 'js/components/common/button';
import AnalysisQuestionsContext from 'js/components/processing/analysis/analysisQuestions.context';
import {
  findQuestion,
  getQuestionTypeDefinition,
} from 'js/components/processing/analysis/utils';
import Badge from 'jsapp/js/components/common/badge';

interface KeywordSearchResponseFormProps {
  uuid: string;
}

/**
 * TBD, see https://github.com/kobotoolbox/kpi/issues/4594
 */
export default function KeywordSearchResponseForm(
  props: KeywordSearchResponseFormProps
) {
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

  function startPollingForSearchFinished() {
    // TODO: make this work ;-)

    setTimeout(() => {
      console.log('QA fake API call: poll for search finished DONE');
      analysisQuestions?.dispatch({
        type: 'initialiseSearchCompleted',
        payload: {
          questions: analysisQuestions?.state.questions.map((item) => {
            if (item.uuid === props.uuid) {
              return {
                ...item,
                // fake 0-50 response
                response: String(Math.floor(Math.random() * (50 - 0 + 1))),
                additionalFields: {
                  ...item.additionalFields,
                  isSearching: false,
                },
              };
            } else {
              return item;
            }
          }),
        },
      });
    }, 5000);
  }

  function applySearch() {
    analysisQuestions?.dispatch({type: 'initialiseSearch'});

    // TODO make actual API call here
    // For now we make a fake response
    console.log('QA fake API call: initialise search', props.uuid);
    setTimeout(() => {
      console.log('QA fake API call: initialise search DONE');
      analysisQuestions?.dispatch({
        type: 'initialiseSearchCompleted',
        payload: {
          questions: analysisQuestions?.state.questions.map((item) => {
            if (item.uuid === props.uuid) {
              return {
                ...item,
                additionalFields: {
                  ...item.additionalFields,
                  isSearching: true,
                },
              };
            } else {
              return item;
            }
          }),
        },
      });

      startPollingForSearchFinished();
    }, 1000);
  }

  return (
    <>
      <CommonHeader uuid={props.uuid} />

      <section className={commonStyles.content}>
        {(() => {
          if (question.additionalFields?.isSearching) {
            return (
              <span className={styles.loading}>
                {t('…keyword search in progress')}
              </span>
            );
          } else if (!question.response) {
            return (
              <Button
                type='secondary'
                size='m'
                label={t('Apply search')}
                onClick={applySearch}
                isDisabled={analysisQuestions.state.isPending}
              />
            );
          } else if (question.additionalFields?.keywords) {
            return (
              <div className={styles.foundInstancesRow}>
                <span className={styles.keywordsWrapper}>
                  <Badge
                    color='light-storm'
                    size='s'
                    label={t('##number## instances').replace(
                      '##number##',
                      String(question.response)
                    )}
                  />
                  &nbsp;
                  <span>{t('of the keywords')}</span>
                  &nbsp;
                  <strong className={styles.keywords}>
                    {question.additionalFields.keywords.join(', ')}
                  </strong>
                  &nbsp;
                  <span>{t('from')}</span>
                  &nbsp;
                  <strong>{question.additionalFields.source}</strong>
                </span>

                <time className={styles.date}>last updated time</time>
              </div>
            );
          } else {
            return null;
          }
        })()}
      </section>
    </>
  );
}

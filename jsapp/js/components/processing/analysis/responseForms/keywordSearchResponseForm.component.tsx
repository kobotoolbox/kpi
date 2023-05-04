import React, {useContext, useState} from 'react';
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
  uid: string;
}

export default function KeywordSearchResponseForm(
  props: KeywordSearchResponseFormProps
) {
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const analysisQuestions = useContext(AnalysisQuestionsContext);

  // Get the question data from state (with safety check)
  const question = findQuestion(props.uid, analysisQuestions?.state);
  if (!question) {
    return null;
  }

  // Get the question definition (with safety check)
  const qaDefinition = getQuestionTypeDefinition(question.type);
  if (!qaDefinition) {
    return null;
  }

  function applySearch() {
    setIsSearching(true);

    // fake 0-50 response
    const fakeResponse = String(Math.floor(Math.random() * (50 - 0 + 1)));

    analysisQuestions?.dispatch({
      type: 'updateResponse',
      payload: {uid: props.uid, response: fakeResponse},
    });

    // TODO make actual API call here
    // For now we make a fake response
    console.log('QA fake API call: update response', props.uid, fakeResponse);
    setTimeout(() => {
      console.log('QA fake API call: update response DONE');
      analysisQuestions?.dispatch({
        type: 'updateResponseCompleted',
        payload: {
          questions: analysisQuestions?.state.questions.map((item) => {
            if (item.uid === props.uid) {
              return {
                ...item,
                response: fakeResponse,
              };
            } else {
              return item;
            }
          }),
        },
      });
      setIsSearching(false);
    }, 3000);
  }

  return (
    <>
      <CommonHeader uid={props.uid} />

      <section className={commonStyles.alignedContent}>
        {(() => {
          if (isSearching) {
            return (
              <span className={styles.loading}>
                {t('…keyword search in progress')}
              </span>
            );
          } else if (!question.response) {
            return (
              <Button
                type='frame'
                color='storm'
                size='m'
                label={t('Apply search')}
                onClick={applySearch}
              />
            );
          } else if (question.additionalFields?.keywords) {
            return (
              <div className={styles.foundInstancesRow}>
                <span className={styles.keywordsWrapper}>
                  <Badge
                    color='cloud'
                    size='s'
                    label={t('##number## instances').replace(
                      '##number##',
                      question.response
                    )}
                  />
                  &nbsp;
                  <span>{t('of the keywords')}</span>
                  &nbsp;
                  <span className={styles.keywords}>
                    {question.additionalFields.keywords.join(', ')}
                  </span>
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

import React, {useEffect, useState} from 'react';
import SubmissionDataList from 'js/components/submissions/submissionDataList';
import singleProcessingStore from 'js/components/processing/singleProcessingStore';
import {AssetContent} from 'jsapp/js/dataInterface';
import {
  META_QUESTION_TYPES,
  ADDITIONAL_SUBMISSION_PROPS,
} from 'js/constants';
import styles from './singleProcessingSubmissionDetails.module.scss';

interface SingleProcessingSubmissionDataProps {
  asset: AssetContent | undefined;
}

export default function SingleProcessingSubmissionData(props: SingleProcessingSubmissionDataProps) {
  const [store] = useState(() => singleProcessingStore);

  const submissionData = store.getSubmissionData();

  if (!props.asset) {
    return null;
  }

  // If submission data is not ready yet, just don't render the list.
  if (!submissionData) {
    return null;
  }

  // If there is a source, we don't want to display these submission details,
  // as we want the most space possible for the source text.
  if (singleProcessingStore.getSourceData() !== undefined) {
    return null;
  }
  
  /** We want only the processing related data (the actual form questions) */
  function getQuestionsToHide(): string[] {
    return [
      singleProcessingStore.currentQuestionName || '',
      ...Object.keys(ADDITIONAL_SUBMISSION_PROPS),
      ...Object.keys(META_QUESTION_TYPES),
    ];
  }

  return (
    <section className={styles.dataList} key='data-list'>
      <div className={styles.dataListBody}>
        {submissionData &&
          <SubmissionDataList
            assetContent={props.asset}
            submissionData={submissionData}
            hideQuestions={getQuestionsToHide()}
            hideGroups
          />
        }
      </div>
    </section>
  );
}

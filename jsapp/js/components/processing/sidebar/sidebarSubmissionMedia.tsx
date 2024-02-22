import React, {useState} from 'react';
import AudioPlayer from 'js/components/common/audioPlayer';
import singleProcessingStore from 'js/components/processing/singleProcessingStore';
import type {AssetContent} from 'js/dataInterface';
import {QUESTION_TYPES, META_QUESTION_TYPES} from 'js/constants';
import {
  getQuestionXPath,
  getRowData,
  getMediaAttachment,
} from 'js/components/submissions/submissionUtils';
import styles from './sidebarSubmissionMedia.module.scss';

interface SidebarSubmissionMediaProps {
  asset: AssetContent | undefined;
}

export default function SidebarSubmissionMedia(
  props: SidebarSubmissionMediaProps
) {
  // We need submission data.
  const [store] = useState(() => singleProcessingStore);

  const submissionData = store.getSubmissionData();

  if (!submissionData) {
    return null;
  }

  // We need asset with content.
  if (!props.asset || !props.asset.survey) {
    return null;
  }

  if (!store.currentQuestionName) {
    return null;
  }

  // We need row data.
  const rowData = getRowData(
    store.currentQuestionName,
    props.asset.survey,
    submissionData
  );
  if (rowData === null) {
    return null;
  }

  // NB: XPath work moved here from the now-deleted
  // `singleProcessingSubmissionDetails.tsx` by jnm to resolve a merge
  // conflict. It was originally added in commit
  // b7d110a793d6fd5fcc280502b987c68d4b50aae9 (PR #4811)

  // Attachment needs to be an object with urls.
  const questionXPath = getQuestionXPath(
    props.asset.survey,
    store.currentQuestionName
  );

  const attachment = getMediaAttachment(submissionData, rowData, questionXPath);
  if (typeof attachment === 'string') {
    return null;
  }

  switch (store.currentQuestionType) {
    case QUESTION_TYPES.audio.id:
    case META_QUESTION_TYPES['background-audio']:
      return (
        <section
          className={`
            ${styles.mediaWrapper}
            ${styles.mediaWrapperAudio}
          `}
          key='audio'
        >
          <AudioPlayer
            mediaURL={attachment.download_url}
            filename={attachment.filename}
          />
        </section>
      );
    case QUESTION_TYPES.video.id:
      return (
        <section
          className={`
            ${styles.mediaWrapper}
            ${styles.mediaWrapperVideo}
          `}
          key='video'
        >
          <video
            className={styles.videoPreview}
            src={attachment.download_url}
            controls
          />
        </section>
      );
    default:
      return null;
  }
}

import React, {useState} from 'react';
import AudioPlayer from 'js/components/common/audioPlayer';
import singleProcessingStore from 'js/components/processing/singleProcessingStore';
import type {AssetContent} from 'js/dataInterface';
import {QUESTION_TYPES} from 'js/constants';
import {getAttachmentForProcessing} from 'js/components/processing/transcript/transcript.utils';
import styles from './sidebarSubmissionMedia.module.scss';

interface SidebarSubmissionMediaProps {
  assetContent: AssetContent | undefined;
}

export default function SidebarSubmissionMedia(
  props: SidebarSubmissionMediaProps
) {
  // We need submission data.
  const [store] = useState(() => singleProcessingStore);

  // We need `assetContent` to proceed.
  if (!props.assetContent) {
    return null;
  }

  const attachment = getAttachmentForProcessing(props.assetContent);
  if (typeof attachment === 'string') {
    return null;
  }

  switch (store.currentQuestionType) {
    case QUESTION_TYPES.audio.id:
    case QUESTION_TYPES['background-audio'].id:
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

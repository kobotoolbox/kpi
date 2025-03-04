import React, { useState } from 'react'

import AudioPlayer from '#/components/common/audioPlayer'
import singleProcessingStore from '#/components/processing/singleProcessingStore'
import { getAttachmentForProcessing } from '#/components/processing/transcript/transcript.utils'
import { QUESTION_TYPES } from '#/constants'
import type { AssetContent } from '#/dataInterface'
import styles from './sidebarSubmissionMedia.module.scss'

interface SidebarSubmissionMediaProps {
  assetContent: AssetContent | undefined
}

export default function SidebarSubmissionMedia(props: SidebarSubmissionMediaProps) {
  // We need submission data.
  const [store] = useState(() => singleProcessingStore)

  // We need `assetContent` to proceed.
  if (!props.assetContent) {
    return null
  }

  const attachment = getAttachmentForProcessing(props.assetContent)
  if (typeof attachment === 'string') {
    return null
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
          <AudioPlayer mediaURL={attachment.download_url} filename={attachment.filename} />
        </section>
      )
    case QUESTION_TYPES.video.id:
      return (
        <section
          className={`
            ${styles.mediaWrapper}
            ${styles.mediaWrapperVideo}
          `}
          key='video'
        >
          <video className={styles.videoPreview} src={attachment.download_url} controls />
        </section>
      )
    default:
      return null
  }
}

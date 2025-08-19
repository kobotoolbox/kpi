import React, { useState } from 'react'

import cx from 'classnames'
import AttachmentActionsDropdown from '#/attachments/AttachmentActionsDropdown'
import DeletedAttachment from '#/attachments/deletedAttachment.component'
import AudioPlayer from '#/components/common/audioPlayer'
import singleProcessingStore from '#/components/processing/singleProcessingStore'
import { getAttachmentForProcessing } from '#/components/processing/transcript/transcript.utils'
import { QUESTION_TYPES } from '#/constants'
import type { AssetResponse } from '#/dataInterface'
import styles from './sidebarSubmissionMedia.module.scss'

interface SidebarSubmissionMediaProps {
  asset: AssetResponse | undefined
}

export default function SidebarSubmissionMedia(props: SidebarSubmissionMediaProps) {
  // We need submission data.
  const [store] = useState(() => singleProcessingStore)

  // We need `asset` to proceed.
  if (!props.asset) {
    return null
  }

  const attachment = getAttachmentForProcessing()
  if (typeof attachment === 'string') {
    return null
  }
  if (attachment.is_deleted) {
    return (
      <section className={cx([styles.mediaWrapper, styles.mediaWrapperDeleted])} key='deleted'>
        <DeletedAttachment />
      </section>
    )
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
            rightHeaderSection={
              store.data.submissionData && (
                <AttachmentActionsDropdown
                  asset={props.asset}
                  submissionData={store.data.submissionData}
                  attachmentUid={attachment.uid}
                  onDeleted={() => {
                    // TODO: this might be done with a bit more elegant UX, as calling the function causes a whole page
                    // spinner to appear. I feel like redoing `singleProcessingStore` in a `react-query` way would
                    // be the way to go. Alternatively we could use `markAttachmentAsDeleted` function and simply
                    // override memoized value in store - but given how big and complex the store (and NLP view) is, we
                    // could end up with unexpected bugs.
                    store.fetchSubmissionData()
                  }}
                />
              )
            }
          />
        </section>
      )
    default:
      return null
  }
}

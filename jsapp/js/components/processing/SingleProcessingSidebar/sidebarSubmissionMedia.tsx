import React from 'react'

import cx from 'classnames'
import type { DataResponse } from '#/api/models/dataResponse'
import AttachmentActionsDropdown from '#/attachments/AttachmentActionsDropdown'
import DeletedAttachment from '#/attachments/deletedAttachment.component'
import AudioPlayer from '#/components/common/audioPlayer'
import { inferAttachmentQuestionType } from '#/components/submissions/submissionMediaUtils'
import { QUESTION_TYPES } from '#/constants'
import type { AssetResponse } from '#/dataInterface'
import { getAttachmentForProcessing } from '../SingleProcessingContent/TabTranscript/transcript.utils'
import styles from './sidebarSubmissionMedia.module.scss'

interface SidebarSubmissionMediaProps {
  xpath: string
  asset: AssetResponse | undefined
  submission?: DataResponse
}

export default function SidebarSubmissionMedia({ asset, xpath, submission }: SidebarSubmissionMediaProps) {
  if (!asset) {
    return null
  }

  const attachment = getAttachmentForProcessing(xpath, submission)
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

  // The file in hand decides how to show it; a question the form no longer has would
  // otherwise get no player at all.
  const questionType = inferAttachmentQuestionType(attachment)

  switch (questionType) {
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
              submission && (
                <AttachmentActionsDropdown asset={asset} submission={submission} attachmentUid={attachment.uid} />
              )
            }
          />
        </section>
      )
    default:
      return null
  }
}

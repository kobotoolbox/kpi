import React from 'react'

import cx from 'classnames'
import type { DataResponse } from '#/api/models/dataResponse'
import { queryClient } from '#/api/queryClient'
import { getAssetsDataListQueryKey } from '#/api/react-query/survey-data'
import { findRowByXpath } from '#/assetUtils'
import AttachmentActionsDropdown from '#/attachments/AttachmentActionsDropdown'
import DeletedAttachment from '#/attachments/deletedAttachment.component'
import AudioPlayer from '#/components/common/audioPlayer'
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
  // We need `asset` to proceed.
  if (!asset) {
    return null
  }

  const attachment = getAttachmentForProcessing(asset, xpath, submission)
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

  switch (findRowByXpath(asset?.content!, xpath)?.type) {
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
                <AttachmentActionsDropdown
                  asset={asset}
                  submission={submission}
                  attachmentUid={attachment.uid}
                  onDeleted={() => {
                    const deletionParams = {
                      query: JSON.stringify({
                        $or: [{ 'meta/rootUuid': submission._uuid }, { _uuid: submission._uuid }],
                      }),
                    } as any
                    queryClient.invalidateQueries({ queryKey: getAssetsDataListQueryKey(asset!.uid, deletionParams) })
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

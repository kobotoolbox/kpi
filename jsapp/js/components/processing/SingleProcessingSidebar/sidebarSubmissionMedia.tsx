import React from 'react'

import cx from 'classnames'
import { queryClient } from '#/api/queryClient'
import { getAssetsDataListQueryKey, useAssetsDataList } from '#/api/react-query/survey-data'
import { findRowByXpath } from '#/assetUtils'
import AttachmentActionsDropdown from '#/attachments/AttachmentActionsDropdown'
import DeletedAttachment from '#/attachments/deletedAttachment.component'
import AudioPlayer from '#/components/common/audioPlayer'
import { QUESTION_TYPES } from '#/constants'
import type { AssetResponse } from '#/dataInterface'
import { addDefaultUuidPrefix } from '#/utils'
import { getAttachmentForProcessing } from '../SingleProcessingContent/TabTranscript/transcript.utils'
import styles from './sidebarSubmissionMedia.module.scss'

interface SidebarSubmissionMediaProps {
  xpath: string
  submissionId: string
  asset: AssetResponse | undefined
}

export default function SidebarSubmissionMedia({ asset, submissionId, xpath }: SidebarSubmissionMediaProps) {
  const params = {
    query: JSON.stringify({
      $or: [{ 'meta/rootUuid': addDefaultUuidPrefix(submissionId!) }, { _uuid: submissionId }],
    }),
  } as any
  const querySubmission = useAssetsDataList(asset!.uid, params, {
    query: {
      queryKey: getAssetsDataListQueryKey(asset!.uid, params),
      enabled: !!asset!.uid,
    },
  })
  const submissionData = querySubmission.data?.status === 200 ? querySubmission.data.data.results[0] : undefined

  // We need `asset` to proceed.
  if (!asset) {
    return null
  }

  const attachment = getAttachmentForProcessing(asset, xpath, submissionData)
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
              submissionData && (
                <AttachmentActionsDropdown
                  asset={asset}
                  submissionData={submissionData}
                  attachmentUid={attachment.uid}
                  onDeleted={() => {
                    queryClient.invalidateQueries({ queryKey: getAssetsDataListQueryKey(asset!.uid, params) })
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

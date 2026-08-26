import './AudioCell.scss'

import { Group, Text } from '@mantine/core'
import { IconArrowsDiagonal, IconPencilStar, IconVolume } from '@tabler/icons-react'
import React, { useState } from 'react'
import DeletedAttachment from '#/attachments/deletedAttachment.component'
import bem, { makeBem } from '#/bem'
import ActionIcon from '#/components/common/ActionIcon'
import KoboIcon from '#/components/common/KoboIcon'
import ProcessingPromptModal from '#/components/common/ProcessingPromptModal'
import AudioPlayer from '#/components/common/audioPlayer'
import Icon from '#/components/common/icon'
import MiniAudioPlayer from '#/components/common/miniAudioPlayer'
import { goToProcessing } from '#/components/processing/routes.utils'
import type { SubmissionAttachment, SubmissionResponse } from '#/dataInterface'
import { getSubmissionRootUuid } from '#/utils'
import { useAttachmentDuration } from '../AudioDurationsContext'
import { shouldProcessingBeAccessible } from '../submissionUtils'

bem.AudioCell = makeBem(null, 'audio-cell')

interface AudioCellProps {
  assetUid: string
  xpath: string
  submissionData: SubmissionResponse
  /** Required by the mini player. String passed is an error message */
  mediaAttachment: SubmissionAttachment | string
  /** The question label, as displayed in the column header. */
  questionLabel: string
}

/**
 * An alternative component to MediaCell for audio columns. It's a transitional
 * component created with Processing View in mind. It omits the modal.
 */
export default function AudioCell(props: AudioCellProps) {
  const submissionEditId = getSubmissionRootUuid(props.submissionData)

  const attachmentUid = typeof props.mediaAttachment === 'string' ? undefined : props.mediaAttachment?.uid
  const durationSeconds = useAttachmentDuration(attachmentUid)

  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false)
  const downloadUrl = typeof props.mediaAttachment === 'string' ? undefined : props.mediaAttachment?.download_url

  return (
    <bem.AudioCell>
      {typeof props.mediaAttachment === 'string' ? (
        <span data-tip={props.mediaAttachment}>
          <Icon name='alert' color='mid-red' size='s' />
        </span>
      ) : props.mediaAttachment?.is_deleted ? (
        <DeletedAttachment />
      ) : props.mediaAttachment?.download_url ? (
        <MiniAudioPlayer mediaURL={props.mediaAttachment?.download_url} durationSeconds={durationSeconds} />
      ) : null}

      {typeof props.mediaAttachment !== 'string' &&
        shouldProcessingBeAccessible(props.submissionData, props.mediaAttachment) && (
          <Group ml='auto' gap={0} wrap='nowrap'>
            {/* No audio to show if the attachment was deleted. */}
            {!props.mediaAttachment.is_deleted && (
              <ActionIcon
                variant='transparent'
                tooltip={t('View details')}
                icon={IconArrowsDiagonal}
                size='sm'
                onClick={() => setIsDetailsDialogOpen(true)}
              />
            )}
            <ActionIcon
              variant='transparent'
              tooltip={t('Open')}
              icon={IconPencilStar}
              size='sm'
              onClick={() => {
                goToProcessing(props.assetUid, props.xpath, submissionEditId)
              }}
            />
          </Group>
        )}

      {downloadUrl && (
        <ProcessingPromptModal
          opened={isDetailsDialogOpen}
          onClose={() => setIsDetailsDialogOpen(false)}
          title={
            <Group gap='xs'>
              <KoboIcon icon={IconVolume} size='sm' color='storm' />
              <Text fw={600}>{props.questionLabel}</Text>
            </Group>
          }
          onAction={() => {
            setIsDetailsDialogOpen(false)
            goToProcessing(props.assetUid, props.xpath, submissionEditId)
          }}
        >
          <AudioPlayer mediaURL={downloadUrl} />
        </ProcessingPromptModal>
      )}
    </bem.AudioCell>
  )
}

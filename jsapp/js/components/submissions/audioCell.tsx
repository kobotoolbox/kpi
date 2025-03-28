import './audioCell.scss'

import React from 'react'

import DeletedAttachment from '#/attachments/deletedAttachment.component'
import bem, { makeBem } from '#/bem'
import Button from '#/components/common/button'
import Icon from '#/components/common/icon'
import MiniAudioPlayer from '#/components/common/miniAudioPlayer'
import { goToProcessing } from '#/components/processing/routes.utils'
import type { SubmissionAttachment } from '#/dataInterface'

bem.AudioCell = makeBem(null, 'audio-cell')

interface AudioCellProps {
  assetUid: string
  xpath: string
  /* submissionEditId is meta/rootUuid || _uuid */
  submissionEditId: string
  /** Required by the mini player. String passed is an error message */
  mediaAttachment: SubmissionAttachment | string
}

/**
 * An alternative component to MediaCell for audio columns. It's a transitional
 * component created with Processing View in mind. It omits the modal.
 */
export default function AudioCell(props: AudioCellProps) {
  return (
    <bem.AudioCell>
      {typeof props.mediaAttachment === 'string' ? (
        <span data-tip={props.mediaAttachment}>
          <Icon name='alert' color='mid-red' size='s' />
        </span>
      ) : props.mediaAttachment?.is_deleted ? (
        <DeletedAttachment />
      ) : props.mediaAttachment?.download_url ? (
        <MiniAudioPlayer mediaURL={props.mediaAttachment?.download_url} />
      ) : null}

      <Button
        type='primary'
        size='s'
        endIcon='arrow-up-right'
        label={t('Open')}
        isDisabled={typeof props.mediaAttachment === 'string'}
        onClick={() => {
          goToProcessing(props.assetUid, props.xpath, props.submissionEditId)
        }}
      />
    </bem.AudioCell>
  )
}

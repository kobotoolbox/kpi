import './audioCell.scss'

import React from 'react'

import DeletedAttachment from '#/attachments/deletedAttachment.component'
import bem, { makeBem } from '#/bem'
import Button from '#/components/common/button'
import Icon from '#/components/common/icon'
import MiniAudioPlayer from '#/components/common/miniAudioPlayer'
import { goToProcessing } from '#/components/processing/routes.utils'
import type { SubmissionAttachment, SubmissionResponse } from '#/dataInterface'
import { removeDefaultUuidPrefix } from '#/utils'
import { removeEmptyFromSupplementalDetails } from './submissionUtils'

bem.AudioCell = makeBem(null, 'audio-cell')

interface AudioCellProps {
  assetUid: string
  xpath: string
  submissionData: SubmissionResponse
  /** Required by the mini player. String passed is an error message */
  mediaAttachment: SubmissionAttachment | string
}

/**
 * An alternative component to MediaCell for audio columns. It's a transitional
 * component created with Processing View in mind. It omits the modal.
 */
export default function AudioCell(props: AudioCellProps) {
  const submissionEditId = removeDefaultUuidPrefix(props.submissionData['meta/rootUuid']) || props.submissionData._uuid

  // If attachment for this submission response is deleted, and there is no NLP related features (transcript,
  // translations or qualitative analysis questions) being used with it, we don't want to show the button, as it doesn't
  // make sense to open the processing view for it.
  // We use `removeEmptyFromSupplementalDetails`, because submission has some leftover "empty" data after removing
  // features and we want to avoid acting on false positives here (e.g. used added transcript, then deleted it = we
  // don't want to display the button).
  const isProcessingAvailable =
    Object.keys(removeEmptyFromSupplementalDetails(props.submissionData._supplementalDetails)).length > 0 &&
    typeof props.mediaAttachment !== 'string'

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

      {isProcessingAvailable && (
        <Button
          type='primary'
          size='s'
          endIcon='arrow-up-right'
          label={t('Open')}
          isDisabled={typeof props.mediaAttachment === 'string'}
          onClick={() => {
            goToProcessing(props.assetUid, props.xpath, submissionEditId)
          }}
        />
      )}
    </bem.AudioCell>
  )
}

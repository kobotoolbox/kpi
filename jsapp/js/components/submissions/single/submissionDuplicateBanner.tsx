import { Group } from '@mantine/core'
import React from 'react'
import Button from '#/components/common/button'
import { userCan, userHasPermForSubmission } from '#/components/permissions/utils'
import type { AssetResponse, SubmissionResponse } from '#/dataInterface'

interface SubmissionDuplicateBannerProps {
  asset: AssetResponse
  submission: SubmissionResponse
  /** Root UUID of the record this duplicate was made from. */
  duplicatedFromUuid: string
  isEditable: boolean
  isEditPending: boolean
  onEdit: () => void
  onDiscard: () => void
}

/**
 * Explains the duplicate the user has just created, and offers to edit or drop
 * it. Shown until they pick one, and it carries the only actions on offer in
 * that state.
 */
export default function SubmissionDuplicateBanner({
  asset,
  submission,
  duplicatedFromUuid,
  isEditable,
  isEditPending,
  onEdit,
  onDiscard,
}: SubmissionDuplicateBannerProps) {
  const canDelete =
    userCan('delete_submissions', asset) || userHasPermForSubmission('delete_submissions', asset, submission)

  return (
    <section className='submission-modal-message-box duplicated-submission-subheader'>
      <h1 className='submission-duplicate__header'>{t('Duplicate created')}</h1>

      <p className='submission-duplicate__text'>
        {t(
          'A duplicate of the submission record was successfully created. You can view the new instance below and make changes using the action buttons below.',
        )}
      </p>

      <p className='submission-duplicate__text'>
        {t('Source submission uuid:' + ' ')}
        <code>{duplicatedFromUuid}</code>
      </p>

      {/* Labelled buttons, unlike the icons in the actions row: this is a prompt,
      and the user has to pick one of the two to leave it behind. */}
      <Group gap='xs' justify='center'>
        <Button
          onClick={onEdit}
          type='primary'
          size='l'
          isDisabled={!isEditable}
          isPending={isEditPending}
          label={t('Edit')}
        />

        {canDelete && (
          <Button
            onClick={onDiscard}
            type='danger'
            size='l'
            isDisabled={!isEditable}
            label={t('Discard')}
            tooltip={t('Discard duplicated submission')}
          />
        )}
      </Group>
    </section>
  )
}

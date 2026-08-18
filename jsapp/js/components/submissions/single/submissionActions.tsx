import { Group } from '@mantine/core'
import React from 'react'
import Button from '#/components/common/button'
import Checkbox from '#/components/common/checkbox'
import { userCan, userHasPermForSubmission } from '#/components/permissions/utils'
import type { ValidationStatusOptionName } from '#/components/submissions/validationStatus.constants'
import type { AssetResponse, SubmissionResponse } from '#/dataInterface'
import { launchPrinting } from '#/utils'
import SubmissionEditButton from './submissionEditButton'
import SubmissionValidationStatusSelect from './submissionValidationStatusSelect'

interface SubmissionActionsProps {
  asset: AssetResponse
  submission: SubmissionResponse
  /**
   * Set while the user is looking at a duplicate they have not accepted yet, in
   * which case SubmissionDuplicateBanner carries the actions instead.
   *
   * TODO: displaying these might be a better UX, we just need to check if
   * everything works, or if it requires some work to make it usable.
   */
  isInDuplicateFlow: boolean
  /** Whether the record can be changed at all, by this user, right now. */
  isEditable: boolean
  isEditPending: boolean
  isViewPending: boolean
  isValidationStatusPending: boolean
  showXMLNames: boolean
  onShowXMLNamesChange: (showXMLNames: boolean) => void
  onValidationStatusChange: (newValidationStatus: ValidationStatusOptionName) => void
  onEdit: () => void
  onView: () => void
  onDuplicate: () => void
  onDelete: () => void
  /** Owned by the route, which renders the element that expands. */
  isFullscreen: boolean
  onToggleFullscreen: () => void
}

/** Everything that can be done to the record on display, on one row. */
export default function SubmissionActions({
  asset,
  submission,
  isInDuplicateFlow,
  isEditable,
  isEditPending,
  isViewPending,
  isValidationStatusPending,
  showXMLNames,
  onShowXMLNamesChange,
  onValidationStatusChange,
  onEdit,
  onView,
  onDuplicate,
  onDelete,
  isFullscreen,
  onToggleFullscreen,
}: SubmissionActionsProps) {
  // Nothing to put in the row: the banner has the only actions on offer, and an
  // archived form has no validation status to set either.
  if (isInDuplicateFlow && !asset.deployment__active) {
    return null
  }

  const canView = userCan('view_submissions', asset) || userHasPermForSubmission('view_submissions', asset, submission)

  const canDelete =
    userCan('delete_submissions', asset) || userHasPermForSubmission('delete_submissions', asset, submission)

  return (
    // The class name is only here for the print stylesheet.
    <Group className='submission-modal-buttons' align='flex-end' gap='lg' mb='lg'>
      <SubmissionValidationStatusSelect
        asset={asset}
        submission={submission}
        isPending={isValidationStatusPending}
        onChange={onValidationStatusChange}
      />

      {!isInDuplicateFlow && (
        // Pushed to the end, so the row keeps its shape when there is no
        // validation status dropdown to sit opposite it.
        <Group gap='xs' ml='auto'>
          <Checkbox checked={showXMLNames} onChange={onShowXMLNamesChange} label={t('Display XML names')} />

          <SubmissionEditButton isDisabled={!isEditable} isPending={isEditPending} onClick={onEdit} />

          <Button
            onClick={onView}
            type='primary'
            size='l'
            isDisabled={!canView}
            isPending={isViewPending}
            label={t('View')}
          />

          <Button onClick={onDuplicate} type='primary' size='l' isDisabled={!isEditable} label={t('Duplicate')} />

          <Button
            onClick={onToggleFullscreen}
            type='secondary'
            size='l'
            startIcon='expand'
            tooltip={isFullscreen ? t('Exit fullscreen') : t('Toggle fullscreen')}
            tooltipPosition='right'
          />

          <Button
            onClick={launchPrinting}
            type='secondary'
            size='l'
            startIcon='print'
            className='report-button__print'
            tooltip={t('Print')}
            tooltipPosition='right'
          />

          <Button
            onClick={onDelete}
            type='secondary-danger'
            size='l'
            startIcon='trash'
            tooltip={t('Delete submission')}
            tooltipPosition='right'
            isDisabled={!canDelete}
          />
        </Group>
      )}
    </Group>
  )
}

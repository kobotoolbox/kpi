import { Group } from '@mantine/core'
import {
  IconEyeFilled,
  IconFilesFilled,
  IconPencilFilled,
  IconPrinter,
  IconShare,
  IconTrash,
} from '@tabler/icons-react'
import React from 'react'
import ActionIcon from '#/components/common/ActionIcon'
import Checkbox from '#/components/common/checkbox'
import { userCan, userHasPermForSubmission } from '#/components/permissions/utils'
import type { ValidationStatusOptionName } from '#/components/submissions/validationStatus.constants'
import { ROOT_URL } from '#/constants'
import type { AssetResponse, SubmissionResponse } from '#/dataInterface'
import { copyToClipboard, getSubmissionRootUuid, launchPrinting, notify } from '#/utils'
import { getSubmissionPath } from './submissionRouting'
import SubmissionValidationStatusSelect from './submissionValidationStatusSelect'

interface SubmissionActionsProps {
  asset: AssetResponse
  submission: SubmissionResponse
  /**
   * Set while the user is looking at a duplicate they have not accepted yet, in
   * which case the banner above carries the actions instead.
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
}: SubmissionActionsProps) {
  // Built rather than read off the address bar, so what gets shared is always the
  // durable form of the link, whatever the route was originally opened with.
  const shareRecord = async () => {
    const recordUrl = `${ROOT_URL}/#${getSubmissionPath(asset.uid, getSubmissionRootUuid(submission))}`

    if (await copyToClipboard(recordUrl)) {
      // Same wording as the other copy buttons in the app.
      notify.success(t('Copied to clipboard'))
    } else {
      notify.error(t('Could not copy the link, please copy it from the address bar'))
    }
  }

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

          <ActionIcon
            onClick={onEdit}
            variant='light'
            size='md'
            icon={IconPencilFilled}
            tooltip={t('Edit submission')}
            disabled={!isEditable}
            loading={isEditPending}
          />

          <ActionIcon
            onClick={onView}
            variant='light'
            size='md'
            icon={IconEyeFilled}
            tooltip={t('View submission in form')}
            disabled={!canView}
            loading={isViewPending}
          />

          <ActionIcon
            onClick={onDuplicate}
            variant='light'
            size='md'
            icon={IconFilesFilled}
            tooltip={t('Duplicate submission')}
            disabled={!isEditable}
          />

          <ActionIcon
            onClick={shareRecord}
            variant='light'
            size='md'
            icon={IconShare}
            tooltip={t('Copy link to this submission')}
          />

          <ActionIcon
            onClick={launchPrinting}
            variant='light-gray'
            size='md'
            icon={IconPrinter}
            className='report-button__print'
            tooltip={t('Print')}
          />

          <ActionIcon
            onClick={onDelete}
            variant='danger-secondary'
            size='md'
            icon={IconTrash}
            tooltip={t('Delete submission')}
            disabled={!canDelete}
          />
        </Group>
      )}
    </Group>
  )
}

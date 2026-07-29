import { modals } from '@mantine/modals'
import React from 'react'
import { actions } from '#/actions'
import AttachmentActionsDropdown from '#/attachments/AttachmentActionsDropdown'
import { QUESTION_TYPES } from '#/constants'
import type { AnyRowTypeName } from '#/constants'
import type { AssetResponse, SubmissionAttachment, SubmissionResponse } from '#/dataInterface'
import type { IconName } from '#/k-icons'
import { truncateString } from '#/utils'
import TableMediaPreview from './TableMediaPreview'
import TableMediaPreviewModalTitle from './TableMediaPreviewModalTitle'
import { getSubmissionPositionLabel } from './tableMediaPreview.utils'

interface OpenTableMediaPreviewModalAttachmentArgs {
  questionType: AnyRowTypeName
  questionIcon: IconName
  mediaAttachment: SubmissionAttachment
  displayValue: string
  submissionIndex: number
  submissionTotal: number
  submission: SubmissionResponse
  asset: AssetResponse
}

interface OpenTableMediaPreviewModalTextArgs {
  questionType: typeof QUESTION_TYPES.text.id
  displayValue: string
  columnName: string
  submissionIndex: number
  submissionTotal: number
  modalContent?: React.ReactNode
}

type OpenTableMediaPreviewModalArgs = OpenTableMediaPreviewModalAttachmentArgs | OpenTableMediaPreviewModalTextArgs

export function openTableMediaPreviewModal(args: OpenTableMediaPreviewModalArgs) {
  let modalId = ''

  if ('mediaAttachment' in args) {
    // If attachment URLs are unavailable (e.g. stale/deleted attachment metadata),
    // use submission position text instead of a file-name-based title.
    const titleText = args.mediaAttachment.download_url
      ? truncateString(args.displayValue, 30)
      : getSubmissionPositionLabel(args.submissionIndex, args.submissionTotal)

    modalId = modals.open({
      title: (
        <TableMediaPreviewModalTitle
          questionIcon={args.questionIcon}
          submissionIndex={args.submissionIndex}
          submissionTotal={args.submissionTotal}
          titleText={titleText}
          titleTextTooltip={args.displayValue}
          actions={
            <AttachmentActionsDropdown
              asset={args.asset}
              submission={args.submission}
              attachmentUid={args.mediaAttachment.uid}
              onDeleted={() => {
                actions.resources.refreshTableSubmissions()
                modals.close(modalId)
              }}
            />
          }
        />
      ),
      size: 'xl',
      children: (
        <TableMediaPreview
          questionType={args.questionType}
          mediaAttachment={args.mediaAttachment}
          displayValue={args.displayValue}
        />
      ),
    })
  } else {
    modalId = modals.open({
      size: 'xl',
      title: (
        <TableMediaPreviewModalTitle
          submissionIndex={args.submissionIndex}
          submissionTotal={args.submissionTotal}
          titleText={args.columnName}
          titleTextTooltip={args.columnName}
          showSubmissionContext
        />
      ),
      children: args.modalContent ?? (
        <TableMediaPreview questionType={QUESTION_TYPES.text.id} displayValue={args.displayValue} />
      ),
    })
  }

  return {
    modalId,
    close: () => modals.close(modalId),
  }
}

import { Group, Stack } from '@mantine/core'
import { modals } from '@mantine/modals'
import React from 'react'
import { actions } from '#/actions'
import AttachmentActionButtons from '#/attachments/AttachmentActionButtons'
import ProcessingActionButton from '#/components/common/ProcessingActionButton'
import { getProcessingActionLabel } from '#/components/processing/common/utils'
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
  /** Adds a button (e.g. "Analyze image") that closes the dialog and calls this to open Processing. Omit to leave it out. */
  onOpenProcessing?: () => void
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
    const onOpenProcessing = args.onOpenProcessing
    const onDeleted = () => {
      actions.resources.refreshTableSubmissions()
      modals.close(modalId)
    }

    modalId = modals.open({
      title: (
        <TableMediaPreviewModalTitle
          questionIcon={args.questionIcon}
          submissionIndex={args.submissionIndex}
          submissionTotal={args.submissionTotal}
          titleText={titleText}
          titleTextTooltip={args.displayValue}
        />
      ),
      size: 'xl',
      children: (
        <Stack>
          <TableMediaPreview
            questionType={args.questionType}
            mediaAttachment={args.mediaAttachment}
            displayValue={args.displayValue}
          />

          <Group justify='space-between'>
            <AttachmentActionButtons
              asset={args.asset}
              submission={args.submission}
              attachmentUid={args.mediaAttachment.uid}
              onDeleted={onDeleted}
            />

            {onOpenProcessing && (
              <ProcessingActionButton
                label={getProcessingActionLabel(args.questionType)}
                onClick={() => {
                  modals.close(modalId)
                  onOpenProcessing()
                }}
              />
            )}
          </Group>
        </Stack>
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

import { useState } from 'react'
import type { _DataResponseAttachmentsItem } from '#/api/models/_dataResponseAttachmentsItem'
import type { DataResponse } from '#/api/models/dataResponse'
import { userHasPermForSubmission } from '#/components/permissions/utils'
import { stripRepeatIndices } from '#/components/submissions/submissionUtils'
import type { AssetResponse, SubmissionResponse } from '#/dataInterface'

/**
 * What the attachment action components (`AttachmentActionsDropdown`, `AttachmentActionButtons`) need for one
 * attachment: the attachment itself, its question, whether the user can delete it, and the delete modal's state.
 * The attachment is `undefined` when it isn't in the submission or was deleted, so there's nothing to act on.
 */
export function useAttachmentActions(
  asset: AssetResponse,
  submission: SubmissionResponse | DataResponse,
  attachmentUid: string,
) {
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState<boolean>(false)

  const found = (submission._attachments as any as _DataResponseAttachmentsItem[]).find(
    (item) => item.uid === attachmentUid,
  )
  const attachment = found && !found.is_deleted ? found : undefined

  // Strip any repeat-instance index so this matches the survey row's static xpath.
  const questionXpath = attachment ? stripRepeatIndices(attachment.question_xpath) : undefined
  const questionType = questionXpath
    ? asset.content?.survey?.find((row) => row.$xpath === questionXpath)?.type
    : undefined

  return {
    attachment,
    questionXpath,
    questionType,
    userCanChangeSubmission: userHasPermForSubmission('change_submissions', asset, submission),
    isDeleteModalOpen,
    openDeleteModal: () => setIsDeleteModalOpen(true),
    closeDeleteModal: () => setIsDeleteModalOpen(false),
  }
}

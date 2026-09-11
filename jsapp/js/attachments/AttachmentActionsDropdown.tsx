import { FocusTrap, Group, Menu, Modal, Stack } from '@mantine/core'
import { useState } from 'react'
import type { _DataResponseAttachmentsItem } from '#/api/models/_dataResponseAttachmentsItem'
import type { DataResponse } from '#/api/models/dataResponse'
import { useAssetsAttachmentsDestroy } from '#/api/react-query/survey-data'
import Button from '#/components/common/ButtonNew'
import MoreActionsMenu from '#/components/common/MoreActionsMenu'
import Icon from '#/components/common/icon'
import { userHasPermForSubmission } from '#/components/permissions/utils'
import { isNlpSupported } from '#/components/processing/common/utils'
import { QuestionTypeName } from '#/constants'
import type { AssetResponse, SubmissionResponse } from '#/dataInterface'
import { getSubmissionRootUuid, notify } from '#/utils'
import styles from './AttachmentActionsDropdown.module.scss'

interface AttachmentActionsDropdownProps {
  asset: AssetResponse
  submission: SubmissionResponse | DataResponse
  attachmentUid: string
  /**
   * Being called after attachment was deleted succesfully. Is meant to be used
   * by parent component to reflect this change in the data it holds, and
   * possibly in other places in UI.
   */
  onDeleted?: () => void
  /**
   * Also offer a "Translate & analyze" entry that opens Processing for this
   * response's question, when NLP processing supports its type.
   * Off by default.
   */
  showProcessingAction?: boolean
}

/**
 * Displays a "…" button that opens a dropdown with some actions available for
 * provided attachment. Delete option would display a safety check modal.
 */
export default function AttachmentActionsDropdown(props: AttachmentActionsDropdownProps) {
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState<boolean>(false)
  const [isDeletePending, setIsDeletePending] = useState<boolean>(false)
  const removeAttachmentMutation = useAssetsAttachmentsDestroy()

  const attachment = (props.submission._attachments as any as _DataResponseAttachmentsItem[]).find(
    (item) => item.uid === props.attachmentUid,
  )
  if (!attachment) {
    return null
  }

  // Safety check, ideally parent component should not render this component if attachment is deleted.
  if (attachment.is_deleted) {
    return null
  }

  const handleConfirmDelete = async () => {
    setIsDeletePending(true)

    try {
      await removeAttachmentMutation.mutateAsync({ uidAsset: props.asset.uid, id: attachment.uid as any }) // TODO: number or string?
      setIsDeleteModalOpen(false)
      notify(t('##Attachment_type## deleted').replace('##Attachment_type##', attachmentTypeName))
      props.onDeleted?.()
    } finally {
      setIsDeletePending(false)
    }
  }

  // We find the question that the attachment belongs to, to determine the text to display in the modal.
  const questionType = props.asset.content?.survey?.find((row) => row.$xpath === attachment.question_xpath)?.type
  let attachmentTypeName = t('attachment')
  if (questionType === QuestionTypeName.audio) {
    attachmentTypeName = t('audio recording')
  } else if (questionType === QuestionTypeName.video) {
    attachmentTypeName = t('video recording')
  } else if (questionType === QuestionTypeName.image) {
    attachmentTypeName = t('image')
  } else if (questionType === QuestionTypeName['background-audio']) {
    attachmentTypeName = t('background audio recording')
  }

  const userCanChangeSubmission = userHasPermForSubmission('change_submissions', props.asset, props.submission)
  const isProcessingActionShown = props.showProcessingAction && isNlpSupported(questionType)

  return (
    <span className={styles.attachmentActionsDropdown}>
      {/* We don't use portal here, as opening this inside SubmissionModal causes the menu to open in weird place */}
      <MoreActionsMenu
        processingAction={
          isProcessingActionShown
            ? {
                assetUid: props.asset.uid,
                xpath: attachment.question_xpath,
                submissionEditId: getSubmissionRootUuid(props.submission),
              }
            : undefined
        }
      >
        <Menu.Item component='a' href={attachment!.download_url} leftSection={<Icon name='download' />}>
          {t('Download')}
        </Menu.Item>
        {userCanChangeSubmission && (
          <>
            <Menu.Divider />
            <Menu.Item variant='danger' onClick={() => setIsDeleteModalOpen(true)} leftSection={<Icon name='trash' />}>
              {t('Delete')}
            </Menu.Item>
          </>
        )}
      </MoreActionsMenu>

      <Modal
        opened={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false)
        }}
        title={t('Delete ##attachment_type##').replace('##attachment_type##', attachmentTypeName)}
      >
        {/* We don't want "x" button to get focus (see https://mantine.dev/core/modal/#initial-focus) */}
        <FocusTrap.InitialFocus />

        <Stack>
          <p>
            {t('Are you sure you want to delete this ##attachment_type##?').replace(
              '##attachment_type##',
              attachmentTypeName,
            )}
          </p>

          <Group justify='flex-end'>
            <Button variant='light' size='lg' onClick={() => setIsDeleteModalOpen(false)} disabled={isDeletePending}>
              {t('Cancel')}
            </Button>

            <Button
              variant='danger'
              size='lg'
              onClick={handleConfirmDelete}
              loading={isDeletePending}
              disabled={!userCanChangeSubmission}
            >
              {t('Delete')}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </span>
  )
}

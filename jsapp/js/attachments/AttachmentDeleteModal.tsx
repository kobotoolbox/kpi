import { FocusTrap, Group, Stack } from '@mantine/core'
import { useState } from 'react'
import type { _DataResponseAttachmentsItem } from '#/api/models/_dataResponseAttachmentsItem'
import { useAssetsAttachmentsDestroy } from '#/api/react-query/survey-data'
import Button from '#/components/common/ButtonNew'
import ModalNew from '#/components/common/ModalNew'
import { type AnyRowTypeName, QuestionTypeName } from '#/constants'
import { notify } from '#/utils'

interface AttachmentDeleteModalProps {
  assetUid: string
  attachment: _DataResponseAttachmentsItem
  /** The attachment's question type, naming what gets deleted (e.g. "image"). */
  questionType: AnyRowTypeName | undefined
  opened: boolean
  onClose: () => void
  /**
   * Called after the attachment was deleted successfully. Is meant to be used by parent component to reflect this
   * change in the data it holds, and possibly in other places in UI.
   */
  onDeleted?: () => void
}

/**
 * Safety check before deleting a submission attachment, and the deletion itself. Callers only offer it to users who
 * can change the submission.
 */
export default function AttachmentDeleteModal(props: AttachmentDeleteModalProps) {
  const [isDeletePending, setIsDeletePending] = useState<boolean>(false)
  const removeAttachmentMutation = useAssetsAttachmentsDestroy()

  const { questionType } = props
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

  const handleConfirmDelete = async () => {
    setIsDeletePending(true)

    try {
      await removeAttachmentMutation.mutateAsync({ uidAsset: props.assetUid, id: props.attachment.uid as any }) // TODO: number or string?
      props.onClose()
      notify(t('##Attachment_type## deleted').replace('##Attachment_type##', attachmentTypeName))
      props.onDeleted?.()
    } finally {
      setIsDeletePending(false)
    }
  }

  return (
    <ModalNew
      opened={props.opened}
      onClose={props.onClose}
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
          <Button variant='light' size='lg' onClick={props.onClose} disabled={isDeletePending}>
            {t('Cancel')}
          </Button>

          <Button variant='danger' size='lg' onClick={handleConfirmDelete} loading={isDeletePending}>
            {t('Delete')}
          </Button>
        </Group>
      </Stack>
    </ModalNew>
  )
}

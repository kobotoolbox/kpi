import { FocusTrap, Group, Menu, Modal, Stack } from '@mantine/core'
import { useState } from 'react'
import type { _DataResponseAttachmentsItem } from '#/api/models/_dataResponseAttachmentsItem'
import type { DataResponse } from '#/api/models/dataResponse'
import { useAssetsAttachmentsDestroy } from '#/api/react-query/survey-data'
import ActionIcon from '#/components/common/ActionIcon'
import Button from '#/components/common/ButtonNew'
import Icon from '#/components/common/icon'
import { userHasPermForSubmission } from '#/components/permissions/utils'
import { QuestionTypeName } from '#/constants'
import type { AssetResponse, SubmissionResponse } from '#/dataInterface'
import { notify } from '#/utils'
import styles from './AttachmentActionsDropdown.module.scss'

function getDeletedNotification(questionType: string | undefined): string {
  if (questionType === QuestionTypeName.audio) {
    return t('Audio recording deleted')
  } else if (questionType === QuestionTypeName.video) {
    return t('Video recording deleted')
  } else if (questionType === QuestionTypeName.image) {
    return t('Image deleted')
  } else if (questionType === QuestionTypeName['background-audio']) {
    return t('Background audio recording deleted')
  }
  return t('Attachment deleted')
}

function getDeleteModalTitle(questionType: string | undefined): string {
  if (questionType === QuestionTypeName.audio) {
    return t('Delete audio recording')
  } else if (questionType === QuestionTypeName.video) {
    return t('Delete video recording')
  } else if (questionType === QuestionTypeName.image) {
    return t('Delete image')
  } else if (questionType === QuestionTypeName['background-audio']) {
    return t('Delete background audio recording')
  }
  return t('Delete attachment')
}

function getDeleteConfirmMessage(questionType: string | undefined): string {
  if (questionType === QuestionTypeName.audio) {
    return t('Are you sure you want to delete this audio recording?')
  } else if (questionType === QuestionTypeName.video) {
    return t('Are you sure you want to delete this video recording?')
  } else if (questionType === QuestionTypeName.image) {
    return t('Are you sure you want to delete this image?')
  } else if (questionType === QuestionTypeName['background-audio']) {
    return t('Are you sure you want to delete this background audio recording?')
  }
  return t('Are you sure you want to delete this attachment?')
}

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

  // We find the question that the attachment belongs to, to determine the text to display in the modal.
  const questionType = props.asset.content?.survey?.find((row) => row.$xpath === attachment.question_xpath)?.type

  const handleConfirmDelete = async () => {
    setIsDeletePending(true)

    try {
      await removeAttachmentMutation.mutateAsync({ uidAsset: props.asset.uid, id: attachment.uid as any }) // TODO: number or string?
      setIsDeleteModalOpen(false)
      notify(getDeletedNotification(questionType))
      props.onDeleted?.()
    } finally {
      setIsDeletePending(false)
    }
  }

  const userCanChangeSubmission = userHasPermForSubmission('change_submissions', props.asset, props.submission)

  return (
    <span className={styles.attachmentActionsDropdown}>
      {/* We don't use portal here, as opening this inside SubmissionModal causes the menu to open in weird place */}
      <Menu withinPortal={false} closeOnClickOutside closeOnItemClick position='bottom-end'>
        <Menu.Target>
          <span style={{ position: 'relative' }}>
            <ActionIcon size='md' variant='transparent' iconName='more' />
          </span>
        </Menu.Target>

        <Menu.Dropdown>
          <Menu.Item component='a' href={attachment!.download_url} leftSection={<Icon name='download' />}>
            {t('Download')}
          </Menu.Item>
          {userCanChangeSubmission && (
            <>
              <Menu.Divider />
              <Menu.Item
                variant='danger'
                onClick={() => setIsDeleteModalOpen(true)}
                leftSection={<Icon name='trash' />}
              >
                {t('Delete')}
              </Menu.Item>
            </>
          )}
        </Menu.Dropdown>
      </Menu>

      <Modal
        opened={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false)
        }}
        title={getDeleteModalTitle(questionType)}
      >
        {/* We don't want "x" button to get focus (see https://mantine.dev/core/modal/#initial-focus) */}
        <FocusTrap.InitialFocus />

        <Stack>
          <p>
            {getDeleteConfirmMessage(questionType)}
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

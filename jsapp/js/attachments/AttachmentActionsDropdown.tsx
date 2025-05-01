import { FocusTrap, Group, Menu, Modal, Stack } from '@mantine/core'
import { useState } from 'react'
import ActionIcon from '#/components/common/ActionIcon'
import Button from '#/components/common/ButtonNew'
import Icon from '#/components/common/icon'
import { userHasPermForSubmission } from '#/components/permissions/utils'
import { QuestionTypeName } from '#/constants'
import type { AssetResponse, SubmissionResponse } from '#/dataInterface'
import { FeatureFlag, useFeatureFlag } from '#/featureFlags'
import { notify } from '#/utils'
import styles from './AttachmentActionsDropdown.module.scss'
import { useRemoveAttachment } from './attachmentsQuery'

interface AttachmentActionsDropdownProps {
  asset: AssetResponse
  submissionData: SubmissionResponse
  attachmentUid: string
  /**
   * Being called after attachment was deleted succesfully. Is meant to be used
   * by parent component to reflect this change in the data it holds, and
   * possibly in other places in UI.
   */
  onDeleted: () => void
}

/**
 * Displays a "…" button that opens a dropdown with some actions available for
 * provided attachment. Delete option would display a safety check modal.
 */
export default function AttachmentActionsDropdown(props: AttachmentActionsDropdownProps) {
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState<boolean>(false)
  const [isDeletePending, setIsDeletePending] = useState<boolean>(false)
  const removeAttachmentMutation = useRemoveAttachment(props.asset.uid, props.submissionData['meta/rootUuid'])
  const isFeatureEnabled = useFeatureFlag(FeatureFlag.removingAttachmentsEnabled)

  const attachment = props.submissionData._attachments.find((item) => item.uid === props.attachmentUid)
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
      await removeAttachmentMutation.mutateAsync(String(attachment.uid))
      setIsDeleteModalOpen(false)
      notify(t('##Attachment_type## deleted').replace('##Attachment_type##', attachmentTypeName))
      props.onDeleted()
    } catch (e) {
      notify(t('An error occurred while removing the attachment'), 'error')
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

  const userCanChangeSubmission = userHasPermForSubmission('change_submissions', props.asset, props.submissionData)

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
          {isFeatureEnabled && userCanChangeSubmission && (
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

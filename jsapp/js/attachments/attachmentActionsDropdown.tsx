import { FocusTrap, Group, Menu, Modal, Stack } from '@mantine/core'
import { useState } from 'react'
import ActionIcon from '#/components/common/ActionIcon'
import Button from '#/components/common/ButtonNew'
import Icon from '#/components/common/icon'
import { userHasPermForSubmission } from '#/components/permissions/utils'
import { QuestionTypeName } from '#/constants'
import type { AnyRowTypeName } from '#/constants'
import type { AssetResponse, SubmissionAttachment, SubmissionResponse } from '#/dataInterface'
import { getFeatureFlags } from '#/featureFlags'
import { downloadUrl, notify } from '#/utils'
import { useRemoveAttachment } from './attachmentsQuery'

interface AttachmentActionsDropdownProps {
  asset: AssetResponse
  questionType: AnyRowTypeName
  attachment: SubmissionAttachment
  submissionData: SubmissionResponse
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

  // Safety check, ideally parent component should not render this component if attachment is deleted.
  if (props.attachment.is_deleted) {
    return null
  }

  // TODO: remove this when feature is ready. For now we hide the whole thing by not rendering anything.
  const { removingAttachmentsEnabled } = getFeatureFlags()
  if (removingAttachmentsEnabled === false) {
    return null
  }

  async function handleConfirmDelete() {
    setIsDeletePending(true)

    try {
      await removeAttachmentMutation.mutateAsync(String(props.attachment.id))

      // TODO: Upon finishing we need to have the submission data being updated
      // both in Submission Modal and in Data Table.
      // Validation status changing in Submission Modal works like this:
      // 1. Does the call (both Submission Modal and Data Table listens to same call)
      // 2. Call finishes and returns a fresh SubmissionResponse
      // 3. Upon finishing, Submission Modal updates the submission from props
      // 4. Upon finishing, Data Table updates the submission in the list
      // We would need to do something similar here.

      setIsDeleteModalOpen(false)
      notify(t('##Attachment_type## deleted').replace('##Attachment_type##', attachmentTypeName))
      props.onDeleted()
    } catch (e) {
      notify(t('An error occurred while removing the attachment'), 'error')
    } finally {
      setIsDeletePending(false)
    }
  }

  function requestDownloadFile() {
    downloadUrl(props.attachment.download_url)
  }

  let attachmentTypeName = t('attachment')
  if (props.questionType === QuestionTypeName.audio) {
    attachmentTypeName = t('audio recording')
  } else if (props.questionType === QuestionTypeName.video) {
    attachmentTypeName = t('video recording')
  } else if (props.questionType === QuestionTypeName.image) {
    attachmentTypeName = t('image')
  } else if (props.questionType === QuestionTypeName['background-audio']) {
    attachmentTypeName = t('background audio recording')
  }

  const userCanChangeSubmission = userHasPermForSubmission('change_submissions', props.asset, props.submissionData)

  return (
    <>
      {/* We don't use portal here, as opening this inside SubmissionModal causes the menu to open in weird place */}
      <Menu withinPortal={false} closeOnClickOutside closeOnItemClick position='bottom-end'>
        <Menu.Target>
          <span style={{ position: 'relative' }}>
            <ActionIcon size='md' variant='transparent' iconName='more' />
          </span>
        </Menu.Target>

        <Menu.Dropdown>
          <Menu.Item onClick={requestDownloadFile}>
            <Icon name='download' /> {t('Download')}
          </Menu.Item>
          <Menu.Item variant='danger' onClick={() => setIsDeleteModalOpen(true)} disabled={!userCanChangeSubmission}>
            <Icon name='trash' /> {t('Delete')}
          </Menu.Item>
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
            <Button variant='light' size='lg' onClick={() => setIsDeleteModalOpen(false)}>
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
    </>
  )
}

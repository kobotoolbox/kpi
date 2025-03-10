import React, { useState } from 'react'
import bem from '#/bem'
import Button from '#/components/common/button'
import Icon from '#/components/common/icon'
import KoboDropdown from '#/components/common/koboDropdown'
import KoboModal from '#/components/modals/koboModal'
import KoboModalContent from '#/components/modals/koboModalContent'
import KoboModalFooter from '#/components/modals/koboModalFooter'
import KoboModalHeader from '#/components/modals/koboModalHeader'
import { userHasPermForSubmission } from '#/components/permissions/utils'
import { QuestionTypeName } from '#/constants'
import type { AnyRowTypeName } from '#/constants'
import type { AssetResponse, SubmissionResponse } from '#/dataInterface'
import { downloadUrl, generateUuid, notify } from '#/utils'
import { useRemoveAttachment } from './attachmentsQuery'

interface AttachmentActionsDropdownProps {
  asset: AssetResponse
  questionType: AnyRowTypeName
  attachmentUrl: string
  attachmentUid: string
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

  const toggleDeleteModal = () => {
    setIsDeleteModalOpen(!isDeleteModalOpen)
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

  async function confirmDelete() {
    setIsDeletePending(true)

    try {
      await removeAttachmentMutation.mutateAsync(props.attachmentUid)

      // TODO: Upon finishing we need to have the submission data being updated
      // both in Submission Modal and in Data Table.
      // Validation status changing in Submission Modal works like this:
      // 1. Does the call (both Submission Modal and Data Table listens to same call)
      // 2. Call finishes and returns a fresh SubmissionResponse
      // 3. Upon finishing, Submission Modal updates the submission from props
      // 4. Upon finishing, Data Table updates the submission in the list
      // We would need to do something similar here.

      setIsDeletePending(false)
      toggleDeleteModal()
      notify(t('##Attachment_type## deleted').replace('##Attachment_type##', attachmentTypeName))
      props.onDeleted()
    } catch (e) {
      notify(t('An error occurred while removing the attachment'), 'error')
    }
  }

  function requestDownloadFile() {
    downloadUrl(props.attachmentUrl)
  }

  const userCanChange = userHasPermForSubmission('change_submissions', props.asset, props.submissionData)

  const uniqueDropdownName = `attachment-actions-${generateUuid()}`

  // TODO: use mantine dropdown and mantine modal

  return (
    <>
      <KoboDropdown
        name={uniqueDropdownName}
        placement='down-right'
        hideOnMenuClick
        triggerContent={<Button type='text' size='s' startIcon='more' />}
        menuContent={
          <bem.KoboSelect__menu>
            <bem.KoboSelect__option onClick={requestDownloadFile}>
              <Icon name='download' />
              <label>{t('Download')}</label>
            </bem.KoboSelect__option>

            <bem.KoboSelect__option onClick={toggleDeleteModal} disabled={!userCanChange}>
              <Icon name='trash' />
              <label>{t('Delete')}</label>
            </bem.KoboSelect__option>
          </bem.KoboSelect__menu>
        }
      />

      <KoboModal isOpen={isDeleteModalOpen} onRequestClose={toggleDeleteModal} size='medium'>
        <KoboModalHeader onRequestCloseByX={toggleDeleteModal}>
          {t('Delete ##attachment_type##').replace('##attachment_type##', attachmentTypeName)}
        </KoboModalHeader>

        <KoboModalContent>
          <p>
            {t('Are you sure you want to delete this ##attachment_type##?').replace(
              '##attachment_type##',
              attachmentTypeName,
            )}
          </p>
        </KoboModalContent>

        <KoboModalFooter>
          <Button type='secondary' size='l' onClick={toggleDeleteModal} label={t('Cancel')} />

          <Button
            type='danger'
            size='l'
            onClick={confirmDelete}
            label={t('Delete')}
            isDisabled={!userCanChange}
            isPending={isDeletePending}
          />
        </KoboModalFooter>
      </KoboModal>
    </>
  )
}

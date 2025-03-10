import React, { useState } from 'react'
import Icon from '#/components/common/icon'
import Button from '#/components/common/button'
import KoboDropdown from '#/components/common/koboDropdown'
import KoboModal from '#/components/modals/koboModal'
import KoboModalHeader from '#/components/modals/koboModalHeader'
import KoboModalContent from '#/components/modals/koboModalContent'
import KoboModalFooter from '#/components/modals/koboModalFooter'
import bem from '#/bem'
import { QuestionTypeName, MetaQuestionTypeName } from '#/constants'
import * as utils from '#/utils'
import { userHasPermForSubmission } from '#/components/permissions/utils'
import type { AnyRowTypeName } from '#/constants'
import type { AssetResponse, SubmissionResponse } from '#/dataInterface'

interface AttachmentActionsDropdownProps {
  asset: AssetResponse
  questionType: AnyRowTypeName
  attachmentUrl: string
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

  function confirmDelete() {
    setIsDeletePending(true)

    // TODO: replace the timeout with actual API call that will delete
    // the attachment.
    console.log('confirmDelete')
    setTimeout(() => {
      // TODO: Upon finishing we need to have the submission data being updated
      // both here in Submission Modal and in Data Table.
      // Validation status changing in Submission Modal works like this:
      // 1. Does the call (both Submission Modal and Data Table listens to same call)
      // 2. Call finishes and returns a fresh SubmissionResponse
      // 3. Upon finishing, Submission Modal updates the submission from props
      // 4. Upon finishing, Data Table updates the submission in the list
      // We would need to do something similar here.

      // TODO: We would need to confirm from Back-end how would the deleted
      // attachment be marked
      onAttachmentDeleted()
    }, 2000)
  }

  /**
   * Stops pending animation, closes confirmation prompt and displays
   * a notification. Also let the parent know through prop callback.
   */
  function onAttachmentDeleted() {
    setIsDeletePending(false)
    toggleDeleteModal()
    utils.notify(t('##Attachment_type## deleted').replace('##Attachment_type##', attachmentTypeName))
    props.onDeleted()
  }

  function requestDownloadFile() {
    utils.downloadUrl(props.attachmentUrl)
  }

  const userCanChange = userHasPermForSubmission('change_submissions', props.asset, props.submissionData)

  const uniqueDropdownName = `attachment-actions-${utils.generateUuid()}`

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
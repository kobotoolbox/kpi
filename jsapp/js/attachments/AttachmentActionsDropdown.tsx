import type { DataResponse } from '#/api/models/dataResponse'
import Menu from '#/components/common/Menu'
import MenuItemProcessing from '#/components/common/MenuItemProcessing'
import MoreActionsMenu from '#/components/common/MoreActionsMenu'
import Icon from '#/components/common/icon'
import {
  getRepeatGroupProcessingUnavailableMessage,
  isInRepeatGroup,
} from '#/components/processing/common/questionType'
import { isNlpSupported } from '#/components/processing/common/utils'
import { QuestionTypeName } from '#/constants'
import type { AssetResponse, SubmissionResponse } from '#/dataInterface'
import { FeatureFlag, useFeatureFlag } from '#/featureFlags'
import { getSubmissionRootUuid } from '#/utils'
import styles from './AttachmentActionsDropdown.module.scss'
import AttachmentDeleteModal from './AttachmentDeleteModal'
import { useAttachmentActions } from './useAttachmentActions'

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
   * Also offer an entry (e.g. "Translate & analyze") that opens Processing for this
   * response's question, when NLP processing supports its type.
   * Off by default.
   */
  showProcessingAction?: boolean
  /** Leaves out the "Delete" entry. Off by default. */
  hideDeleteAction?: boolean
}

/**
 * Displays a "…" button that opens a dropdown with some actions available for
 * provided attachment. Delete option would display a safety check modal.
 */
export default function AttachmentActionsDropdown(props: AttachmentActionsDropdownProps) {
  const { attachment, questionXpath, questionType, userCanChangeSubmission, ...deleteModal } = useAttachmentActions(
    props.asset,
    props.submission,
    props.attachmentUid,
  )
  const isNlpImageActionsEnabled = useFeatureFlag(FeatureFlag.nlpImageActionsEnabled)

  // Safety check, ideally parent component should not render this component if attachment is deleted.
  if (!attachment || !questionXpath) {
    return null
  }

  // TODO: drop the image check along with `FeatureFlag.nlpImageActionsEnabled` once NLP for images is complete.
  const isProcessingActionShown =
    props.showProcessingAction &&
    isNlpSupported(questionType) &&
    (questionType !== QuestionTypeName.image || isNlpImageActionsEnabled)

  return (
    <span className={styles.attachmentActionsDropdown}>
      {/* We don't use portal here, as opening this inside SubmissionModal causes the menu to open in weird place */}
      <MoreActionsMenu>
        {isProcessingActionShown && (
          <>
            <MenuItemProcessing
              assetUid={props.asset.uid}
              xpath={questionXpath}
              submissionEditId={getSubmissionRootUuid(props.submission)}
              questionType={questionType}
              disabledReason={
                isInRepeatGroup(props.asset, attachment.question_xpath, props.submission)
                  ? getRepeatGroupProcessingUnavailableMessage()
                  : undefined
              }
            />
            <Menu.Divider />
          </>
        )}
        <Menu.Item component='a' href={attachment!.download_url} leftSection={<Icon name='download' />}>
          {t('Download')}
        </Menu.Item>
        {userCanChangeSubmission && !props.hideDeleteAction && (
          <>
            <Menu.Divider />
            <Menu.Item variant='danger' onClick={deleteModal.openDeleteModal} leftSection={<Icon name='trash' />}>
              {t('Delete')}
            </Menu.Item>
          </>
        )}
      </MoreActionsMenu>

      <AttachmentDeleteModal
        assetUid={props.asset.uid}
        attachment={attachment}
        questionType={questionType}
        opened={deleteModal.isDeleteModalOpen}
        onClose={deleteModal.closeDeleteModal}
        onDeleted={props.onDeleted}
      />
    </span>
  )
}

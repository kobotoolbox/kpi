import { Group } from '@mantine/core'
import { IconDownload, IconTrash } from '@tabler/icons-react'
import type { DataResponse } from '#/api/models/dataResponse'
import ActionIcon from '#/components/common/ActionIcon'
import type { AssetResponse, SubmissionResponse } from '#/dataInterface'
import AttachmentDeleteModal from './AttachmentDeleteModal'
import { useAttachmentActions } from './useAttachmentActions'

interface AttachmentActionButtonsProps {
  asset: AssetResponse
  submission: SubmissionResponse | DataResponse
  attachmentUid: string
  /** Called after the attachment was deleted successfully, see `AttachmentDeleteModal`. */
  onDeleted?: () => void
}

/**
 * The "Delete" and "Download" actions of `AttachmentActionsDropdown`, as icon
 * buttons, for places with room to show them (e.g. a media preview dialog).
 */
export default function AttachmentActionButtons(props: AttachmentActionButtonsProps) {
  const { attachment, questionType, userCanChangeSubmission, ...deleteModal } = useAttachmentActions(
    props.asset,
    props.submission,
    props.attachmentUid,
  )
  if (!attachment) {
    return null
  }

  return (
    <Group gap='xs'>
      {userCanChangeSubmission && (
        <ActionIcon
          variant='transparent'
          size='md'
          icon={IconTrash}
          tooltip={t('Delete')}
          aria-label={t('Delete')}
          onClick={deleteModal.openDeleteModal}
        />
      )}
      <ActionIcon
        component='a'
        href={attachment.download_url}
        variant='transparent'
        size='md'
        icon={IconDownload}
        tooltip={t('Download')}
        aria-label={t('Download')}
      />

      <AttachmentDeleteModal
        assetUid={props.asset.uid}
        attachment={attachment}
        questionType={questionType}
        opened={deleteModal.isDeleteModalOpen}
        onClose={deleteModal.closeDeleteModal}
        onDeleted={props.onDeleted}
      />
    </Group>
  )
}

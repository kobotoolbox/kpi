import { Loader, Pill } from '@mantine/core'
import { useQueryClient } from '@tanstack/react-query'
import { BulkActionPatchRequestStatusEnum } from '#/api/models/bulkActionPatchRequestStatusEnum'
import { useAssetsAdvancedFeaturesBulkActionsPartialUpdate } from '#/api/react-query/survey-data'
import { QueryKeys } from '#/query/queryKeys'
import ButtonNew from '../common/ButtonNew'
import Avatar from '../common/avatar'
import { type ActivityLogsItem, BULK_PROCESSING_ACTION_IDS } from './activity.constants'
import styles from './activityMessage.module.scss'

interface BulkProcessingActivityMessageProps {
  data: ActivityLogsItem
  assetUid: string
}

export function BulkProcessingActivityMessage({ data, assetUid }: BulkProcessingActivityMessageProps) {
  const queryClient = useQueryClient()
  const bulkAction = data.metadata.bulk_action

  const cancelMutation = useAssetsAdvancedFeaturesBulkActionsPartialUpdate({
    mutation: {
      onSuccess: () => {
        // Invalidate activity logs query to refresh the list and show updated status
        queryClient.invalidateQueries({ queryKey: [QueryKeys.activityLogs, assetUid] })
      },
    },
  })

  if (!bulkAction) {
    return null
  }

  const { action_id, uid, processed_count = 0, total_count = 0 } = bulkAction

  // Determine the action type
  let actionType = ''
  if (action_id === BULK_PROCESSING_ACTION_IDS.automaticGoogleTranscription) {
    actionType = t('bulk transcribed audio files')
  } else if (action_id === BULK_PROCESSING_ACTION_IDS.automaticGoogleTranslation) {
    actionType = t('bulk translated transcriptions')
  }

  const handleCancel = () => {
    if (uid) {
      cancelMutation.mutate({
        uidAsset: assetUid,
        actionUid: uid,
        data: { status: BulkActionPatchRequestStatusEnum.cancelled },
      })
    }
  }

  const isLoading = cancelMutation.isPending

  return (
    <div className={styles.activityMessage}>
      <Avatar size='s' username={data.username} />
      <span>
        <strong>{data.username}</strong> {actionType}{' '}
      </span>
      <span>{t('in progress')} </span>
      <Pill size='xs' variant='amber-light'>
        <Loader type='oval' size='xxs' color='var(--mantine-color-amber-1)' /> {processed_count}/{total_count}
      </Pill>
      {uid && (
        <ButtonNew
          variant='danger-transparent'
          size='sm'
          onClick={handleCancel}
          loading={isLoading}
          disabled={isLoading}
          p={0}
        >
          {t('Cancel process')}
        </ButtonNew>
      )}
    </div>
  )
}

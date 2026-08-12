import React from 'react'
import { ActionIdEnum } from '#/api/models/actionIdEnum'
import type { BulkActionResponse } from '#/api/models/bulkActionResponse'
import { BulkActionResponseStatusEnum } from '#/api/models/bulkActionResponseStatusEnum'
import {
  getAssetsAdvancedFeaturesBulkActionsListQueryKey,
  useAssetsAdvancedFeaturesBulkActionsList,
} from '#/api/react-query/survey-data'
import envStore from '#/envStore'
import { FeatureFlag, useFeatureFlag } from '#/featureFlags'
import { useSession } from '#/stores/useSession'
import { getEstimatedTranscriptionDurationSeconds } from '#/utils'

interface UseDataTableBulkActionsResult {
  activeBulkActions: BulkActionResponse[]
  hasActiveBulkActionsCreatedByCurrentUser: boolean
  currentUsername: string | undefined
}

const MIN_POLL_INTERVAL_SECONDS = 5
const MAX_POLL_INTERVAL_SECONDS = 30
// We currently do not have backend duration estimates per bulk item, so we use
// simple defaults to keep polling predictable and inexpensive.
const DEFAULT_TRANSCRIPTION_SOURCE_SECONDS = 60
const DEFAULT_TRANSLATION_PER_SUBMISSION_SECONDS = 8

function getActiveBulkActions(bulkActions: BulkActionResponse[], isBulkProcessingFeatureEnabled: boolean) {
  if (!isBulkProcessingFeatureEnabled) {
    return []
  }

  return bulkActions.filter(
    (bulkAction) =>
      bulkAction.status === BulkActionResponseStatusEnum.pending ||
      bulkAction.status === BulkActionResponseStatusEnum.in_progress,
  )
}

function constrainPollSeconds(seconds: number) {
  return Math.max(MIN_POLL_INTERVAL_SECONDS, Math.min(MAX_POLL_INTERVAL_SECONDS, seconds))
}

function getEstimatedSecondsPerSubmission(bulkAction: BulkActionResponse) {
  // Reuse the existing single-transcription estimate formula to avoid having
  // two separate timing heuristics in the codebase.
  if (bulkAction.action_id === ActionIdEnum.automatic_google_transcription) {
    return getEstimatedTranscriptionDurationSeconds(DEFAULT_TRANSCRIPTION_SOURCE_SECONDS)
  }

  if (bulkAction.action_id === ActionIdEnum.automatic_google_translation) {
    return DEFAULT_TRANSLATION_PER_SUBMISSION_SECONDS
  }

  return MAX_POLL_INTERVAL_SECONDS
}

export function getBulkActionsPollingIntervalMs(activeBulkActions: BulkActionResponse[]) {
  if (activeBulkActions.length === 0) {
    return false
  }

  const totalSubmissions = activeBulkActions.reduce(
    (count, bulkAction) => count + bulkAction.submission_uuids.length,
    0,
  )

  if (totalSubmissions === 0) {
    return MIN_POLL_INTERVAL_SECONDS * 1000
  }

  const totalEstimatedSeconds = activeBulkActions.reduce(
    (count, bulkAction) => count + bulkAction.submission_uuids.length * getEstimatedSecondsPerSubmission(bulkAction),
    0,
  )

  // A fixed interval derived from total estimate / total submissions
  const averageSecondsPerSubmission = totalEstimatedSeconds / totalSubmissions
  return constrainPollSeconds(averageSecondsPerSubmission) * 1000
}

/**
 * Returns active data-table bulk actions and whether the currently logged-in
 * user has created any active bulk actions.
 */
export function useDataTableBulkActions(assetUid: string): UseDataTableBulkActionsResult {
  // Feature flag keeps all bulk-processing logic disabled unless explicitly enabled.
  const isBulkProcessingFeatureEnabled = useFeatureFlag(FeatureFlag.bulkProcessingEnabled)
  const isAsrMtFeaturesEnabled = envStore.data.asr_mt_features_enabled
  const isBulkProcessingEnabled = isBulkProcessingFeatureEnabled && isAsrMtFeaturesEnabled
  const session = useSession()
  // While session is loading we avoid making user-specific decisions.
  const currentUsername = session.isPending ? undefined : session.currentLoggedAccount?.username
  const effectiveAssetUid = isBulkProcessingEnabled ? assetUid : ''

  // Empty uid disables the query in Orval/react-query options.
  const bulkActionsListQuery = useAssetsAdvancedFeaturesBulkActionsList(effectiveAssetUid, undefined, {
    query: {
      // The generated query options in this codebase require explicit queryKey.
      queryKey: getAssetsAdvancedFeaturesBulkActionsListQueryKey(effectiveAssetUid, undefined),
      refetchInterval: (query) => {
        if (!isBulkProcessingEnabled) {
          return false
        }

        const bulkActions = query.state.data?.status === 200 ? query.state.data.data.results : []
        const activeBulkActions = getActiveBulkActions(bulkActions, isBulkProcessingEnabled)
        return getBulkActionsPollingIntervalMs(activeBulkActions)
      },
      // We only poll while the tab is foregrounded.
      refetchIntervalInBackground: false,
    },
  })

  const activeBulkActions = React.useMemo(() => {
    const bulkActions = bulkActionsListQuery.data?.status === 200 ? bulkActionsListQuery.data.data.results : []

    // Only non-terminal jobs should affect the table state and banner visibility.
    return getActiveBulkActions(bulkActions, isBulkProcessingEnabled)
  }, [bulkActionsListQuery.data, isBulkProcessingEnabled])

  const hasActiveBulkActionsCreatedByCurrentUser = React.useMemo(() => {
    if (!currentUsername) {
      return false
    }

    // Check if current user has created any active bulk actions.
    return activeBulkActions.some((bulkAction) => bulkAction.created_by.username === currentUsername)
  }, [activeBulkActions, currentUsername])

  return {
    activeBulkActions,
    hasActiveBulkActionsCreatedByCurrentUser,
    currentUsername,
  }
}

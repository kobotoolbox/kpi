import React from 'react'
import type { BulkActionResponse } from '#/api/models/bulkActionResponse'
import { BulkActionResponseStatusEnum } from '#/api/models/bulkActionResponseStatusEnum'
import { useAssetsAdvancedFeaturesBulkActionsList } from '#/api/react-query/survey-data'
import envStore from '#/envStore'
import { FeatureFlag, useFeatureFlag } from '#/featureFlags'
import { useSession } from '#/stores/useSession'

interface UseDataTableBulkActionsResult {
  activeBulkActions: BulkActionResponse[]
  hasActiveBulkActionsCreatedByAnotherUser: boolean
  hasActiveBulkActionsCreatedByCurrentUser: boolean
  currentUsername: string | undefined
}

/**
 * Returns active data-table bulk actions and whether any active action was
 * created by a user other than the currently logged-in user.
 */
export function useDataTableBulkActions(assetUid: string): UseDataTableBulkActionsResult {
  // Feature flag keeps all bulk-processing logic disabled unless explicitly enabled.
  const isBulkProcessingFeatureEnabled = useFeatureFlag(FeatureFlag.bulkProcessingEnabled)
  const isAsrMtFeaturesEnabled = envStore.data.asr_mt_features_enabled
  const isBulkProcessingEnabled = isBulkProcessingFeatureEnabled && isAsrMtFeaturesEnabled
  const session = useSession()
  // While session is loading we avoid making user-specific decisions.
  const currentUsername = session.isPending ? undefined : session.currentLoggedAccount?.username

  // Empty uid disables the query in Orval/react-query options.
  const bulkActionsListQuery = useAssetsAdvancedFeaturesBulkActionsList(isBulkProcessingEnabled ? assetUid : '')

  const activeBulkActions = React.useMemo(() => {
    if (!isBulkProcessingEnabled) {
      return []
    }

    const bulkActions = bulkActionsListQuery.data?.status === 200 ? bulkActionsListQuery.data.data.results : []

    // Only non-terminal jobs should affect the table state and banner visibility.
    return bulkActions.filter(
      (bulkAction: BulkActionResponse) =>
        bulkAction.status === BulkActionResponseStatusEnum.pending ||
        bulkAction.status === BulkActionResponseStatusEnum.in_progress,
    )
  }, [bulkActionsListQuery.data, isBulkProcessingEnabled])

  const hasActiveBulkActionsCreatedByAnotherUser = React.useMemo(() => {
    if (!currentUsername) {
      return false
    }

    // Banner is only for "someone else started processing" scenario.
    return activeBulkActions.some((bulkAction) => bulkAction.created_by.username !== currentUsername)
  }, [activeBulkActions, currentUsername])

  const hasActiveBulkActionsCreatedByCurrentUser = React.useMemo(() => {
    if (!currentUsername) {
      return false
    }

    // Check if current user has created any active bulk actions.
    return activeBulkActions.some((bulkAction) => bulkAction.created_by.username === currentUsername)
  }, [activeBulkActions, currentUsername])

  return {
    activeBulkActions,
    hasActiveBulkActionsCreatedByAnotherUser,
    hasActiveBulkActionsCreatedByCurrentUser,
    currentUsername,
  }
}

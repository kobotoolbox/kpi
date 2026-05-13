import React from 'react'
import type { BulkActionResponse } from '#/api/models/bulkActionResponse'
import { BulkActionResponseStatusEnum } from '#/api/models/bulkActionResponseStatusEnum'
import { useAssetsAdvancedFeaturesBulkActionsList } from '#/api/react-query/survey-data'
import type { AssetResponse } from '#/dataInterface'
import { FeatureFlag, useFeatureFlag } from '#/featureFlags'
import { DataTable } from './table'

interface DataTableWrapperProps {
  asset: AssetResponse
}

/**
 * Wrapper around DataTable used to inject hook-derived data.
 *
 * DataTable is a class component, so hooks cannot be used directly inside it.
 * This wrapper is the place for hook-based concerns, such as feature-flagged
 * bulk processing state.
 */
export default function DataTableWrapper(props: DataTableWrapperProps) {
  const isBulkProcessingFeatureEnabled = useFeatureFlag(FeatureFlag.bulkProcessingEnabled)
  const bulkActionsListQuery = useAssetsAdvancedFeaturesBulkActionsList(
    isBulkProcessingFeatureEnabled ? props.asset.uid : '',
  )

  const activeBulkActions = React.useMemo(() => {
    if (!isBulkProcessingFeatureEnabled) {
      return []
    }

    const bulkActions = bulkActionsListQuery.data?.status === 200 ? bulkActionsListQuery.data.data.results : []

    return bulkActions.filter(
      (bulkAction: BulkActionResponse) =>
        bulkAction.status === BulkActionResponseStatusEnum.pending ||
        bulkAction.status === BulkActionResponseStatusEnum.in_progress,
    )
  }, [bulkActionsListQuery.data, isBulkProcessingFeatureEnabled])

  return <DataTable asset={props.asset} activeBulkActions={activeBulkActions} />
}

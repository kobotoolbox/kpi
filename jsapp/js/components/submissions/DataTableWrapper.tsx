import type { AssetResponse } from '#/dataInterface'
import { DataTable } from './table'
import { useDataTableBulkActions } from './useDataTableBulkActions'

interface DataTableWrapperProps {
  asset: AssetResponse
}

/**
 * Wrapper around DataTable (class component) used to inject hook-derived data.
 */
export default function DataTableWrapper(props: DataTableWrapperProps) {
  // Hook gathers all bulk-action derived state in one place.
  const { activeBulkActions, hasActiveBulkActionsCreatedByAnotherUser, currentUsername } = useDataTableBulkActions(
    props.asset.uid,
  )

  return (
    <DataTable
      asset={props.asset}
      activeBulkActions={activeBulkActions}
      hasActiveBulkActionsCreatedByAnotherUser={hasActiveBulkActionsCreatedByAnotherUser}
      currentUsername={currentUsername}
    />
  )
}

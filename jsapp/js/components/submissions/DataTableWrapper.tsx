import DocumentTitle from 'react-document-title'
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
  const { activeBulkActions, hasActiveBulkActionsCreatedByCurrentUser, currentUsername } = useDataTableBulkActions(
    props.asset.uid,
  )

  const docTitle = props.asset.name || t('Untitled')

  return (
    <DocumentTitle title={`${docTitle} | KoboToolbox`}>
      <DataTable
        asset={props.asset}
        activeBulkActions={activeBulkActions}
        hasActiveBulkActionsCreatedByCurrentUser={hasActiveBulkActionsCreatedByCurrentUser}
        currentUsername={currentUsername}
      />
    </DocumentTitle>
  )
}

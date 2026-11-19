import { useEffect, useState } from 'react'
import { useAssetsRetrieve } from '#/api/react-query/manage-projects-and-library-content'
import LoadingSpinner from '#/components/common/loadingSpinner'
import tableStore, { TABLE_SETTINGS_STORAGE_KEY_PREFIX, useTableSettings } from '#/components/submissions/tableStore'
import type { AssetResponse } from '#/dataInterface'
import { useSafeUsernameStorageKey } from '#/hooks/useSafeUsernameStorageKey'
import { DataTable } from './table'
import { useDataTableBulkActions } from './useDataTableBulkActions'

interface DataTableWrapperProps {
  asset: AssetResponse
}

/**
 * Wrapper around DataTable (class component) used to inject hook-derived data.
 */
export default function DataTableWrapper(props: DataTableWrapperProps) {
  const assetQuery = useAssetsRetrieve(props.asset.uid)

  // Hook gathers all bulk-action derived state in one place.
  const { activeBulkActions, hasActiveBulkActionsCreatedByCurrentUser, currentUsername } = useDataTableBulkActions(
    props.asset.uid,
  )

  // We use the asset that we got via react query here because changes to the analysis questions invalidate the query
  // and updates the asset that we pass down to the table
  const tableAsset =
    // We can probably use the asset from react query hook entirely here, but we have the reflux store asset as a backup
    assetQuery.data?.status === 200 ? (assetQuery.data.data as unknown as AssetResponse) : props.asset

  // `tableStore` is used by class components, so we derive its key here.
  const storageKey = useSafeUsernameStorageKey(
    currentUsername ? TABLE_SETTINGS_STORAGE_KEY_PREFIX : undefined,
    currentUsername || '',
  )
  const [loadedStorageKey, setLoadedStorageKey] = useState<string>()
  useEffect(() => {
    if (storageKey) {
      tableStore.setStorageKey(storageKey)
      setLoadedStorageKey(storageKey)
    }
  }, [storageKey])
  const tableSettings = useTableSettings()

  // Wait for stored settings, so the table doesn't load with defaults first
  // and then fetch submissions again with the stored sorting.
  if (!loadedStorageKey) {
    return <LoadingSpinner />
  }

  return (
    <DataTable
      asset={tableAsset}
      activeBulkActions={activeBulkActions}
      hasActiveBulkActionsCreatedByCurrentUser={hasActiveBulkActionsCreatedByCurrentUser}
      currentUsername={currentUsername}
      tableSettings={tableSettings}
    />
  )
}

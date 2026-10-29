import { useEffect, useState } from 'react'
import LoadingSpinner from '#/components/common/loadingSpinner'
import tableStore, { TABLE_SETTINGS_STORAGE_KEY_PREFIX } from '#/components/submissions/tableStore'
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
  // Hook gathers all bulk-action derived state in one place.
  const { activeBulkActions, hasActiveBulkActionsCreatedByCurrentUser, currentUsername } = useDataTableBulkActions(
    props.asset.uid,
  )

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

  // Wait for stored settings, so the table doesn't load with defaults first
  // and then fetch submissions again with the stored sorting.
  if (!loadedStorageKey) {
    return <LoadingSpinner />
  }

  return (
    <DataTable
      asset={props.asset}
      activeBulkActions={activeBulkActions}
      hasActiveBulkActionsCreatedByCurrentUser={hasActiveBulkActionsCreatedByCurrentUser}
      currentUsername={currentUsername}
    />
  )
}

import { useEffect, useState } from 'react'
import { useAssetsRetrieve } from '#/api/react-query/manage-projects-and-library-content'
import LoadingSpinner from '#/components/common/loadingSpinner'
import tableStore, { TABLE_SETTINGS_STORAGE_KEY_PREFIX } from '#/components/submissions/tableStore'
import type { AnalysisFormJsonField, AssetResponse } from '#/dataInterface'
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

  const refreshedAnalysisFormJson =
    assetQuery.data?.status === 200
      ? {
          additional_fields: assetQuery.data.data.analysis_form_json.additional_fields.map((field) => {
            const { choices, ...fieldWithoutChoices } = field
            return {
              ...fieldWithoutChoices,
              ...(choices && {
                choices: choices.map((choice) => ({
                  uuid: choice.uuid,
                  labels: Object.entries(choice.labels).reduce<
                    NonNullable<AnalysisFormJsonField['choices']>[number]['labels']
                  >(
                    (labels, [language, value]) => {
                      if (typeof value === 'string') {
                        labels[language] = value
                      }
                      return labels
                    },
                    { _default: choice.labels._default },
                  ),
                })),
              }),
            }
          }),
        }
      : undefined

  const tableAsset = refreshedAnalysisFormJson
    ? { ...props.asset, analysis_form_json: refreshedAnalysisFormJson }
    : props.asset

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
      asset={tableAsset}
      activeBulkActions={activeBulkActions}
      hasActiveBulkActionsCreatedByCurrentUser={hasActiveBulkActionsCreatedByCurrentUser}
      currentUsername={currentUsername}
    />
  )
}

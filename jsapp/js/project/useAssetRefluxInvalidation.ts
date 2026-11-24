import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { actions } from '#/actions'
import { invalidateItem } from '#/api/mutation-defaults/common'
import { getAssetsRetrieveQueryKey } from '#/api/react-query/manage-projects-and-library-content'

interface AssetRefluxInvalidationOptions {
  /** Also refetch after `updateAsset`, e.g. a rename. Off by default, as it fires on every settings save. */
  withUpdateAsset?: boolean
}

/**
 * Refetches the asset after Reflux mutations that change it, as nothing else invalidates the query for them.
 * Orval mutations fire the same actions through `#/api/reflux-bridge`, so they're covered too.
 *
 * TODO: when switching these to Orval, move the invalidation to `jsapp/js/api/mutation-defaults`.
 */
export function useAssetRefluxInvalidation(assetUid: string | undefined, options: AssetRefluxInvalidationOptions = {}) {
  const queryClient = useQueryClient()
  const { withUpdateAsset = false } = options

  useEffect(() => {
    if (!assetUid) {
      return
    }
    // Cancels a refetch in flight, as it may have started before this change
    const invalidateAsset = () => invalidateItem(getAssetsRetrieveQueryKey(assetUid), queryClient)
    const unlisteners = [
      actions.resources.deployAsset.completed.listen(invalidateAsset),
      actions.resources.setDeploymentActive.completed.listen(invalidateAsset),
      actions.permissions.assignAssetPermission.completed.listen(invalidateAsset),
      actions.permissions.removeAssetPermission.completed.listen(invalidateAsset),
      actions.permissions.bulkSetAssetPermissions.completed.listen(invalidateAsset),
      actions.permissions.copyPermissionsFrom.completed.listen(invalidateAsset),
    ]
    if (withUpdateAsset) {
      unlisteners.push(actions.resources.updateAsset.completed.listen(invalidateAsset))
    }
    return () => {
      unlisteners.forEach((clb) => clb())
    }
  }, [assetUid, queryClient, withUpdateAsset])
}

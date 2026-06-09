import type { QueryClient } from '@tanstack/react-query'
import {
  getAssetsListQueryKey,
  getAssetsPartialUpdateMutationOptions,
  getAssetsRetrieveQueryKey,
} from '#/api/react-query/manage-projects-and-library-content'
import { invalidateInfiniteList, invalidateItem, invalidatePaginatedList } from './common'

/**
 * Applies manage-projects-and-library-content mutation defaults to a QueryClient instance.
 * Call this on both the global queryClient and test/story queryClients
 * to ensure consistent invalidation behavior.
 */
export function applyManageProjectsMutationDefaults(client: QueryClient): void {
  client.setMutationDefaults(
    getAssetsPartialUpdateMutationOptions().mutationKey!,
    getAssetsPartialUpdateMutationOptions({
      mutation: {
        onSettled: (_data, _error, { uidAsset }) => {
          const assetsListQueryKey = getAssetsListQueryKey()

          invalidatePaginatedList(assetsListQueryKey, client)
          invalidateInfiniteList(assetsListQueryKey, client)
          invalidateItem(getAssetsRetrieveQueryKey(uidAsset), client)
        },
      },
    }),
  )
}

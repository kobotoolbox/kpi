import {
  getAssetsListQueryKey,
  getAssetsPartialUpdateMutationOptions,
  getAssetsRetrieveQueryKey,
} from '#/api/react-query/manage-projects-and-library-content'
import { queryClient } from '../queryClient'
import { invalidateItem, invalidatePaginatedList } from './common'

queryClient.setMutationDefaults(
  getAssetsPartialUpdateMutationOptions().mutationKey!,
  getAssetsPartialUpdateMutationOptions({
    mutation: {
      onSettled: (_data, _error, { uidAsset }) => {
        const assetsListQueryKey = getAssetsListQueryKey()

        invalidatePaginatedList(assetsListQueryKey)
        queryClient.invalidateQueries({
          predicate: ({ queryKey }) =>
            queryKey.length > assetsListQueryKey.length &&
            assetsListQueryKey.every((keyPart, index) => queryKey[index] === keyPart) &&
            queryKey[queryKey.length - 1] === 'infinite',
        })
        invalidateItem(getAssetsRetrieveQueryKey(uidAsset))
      },
    },
  }),
)

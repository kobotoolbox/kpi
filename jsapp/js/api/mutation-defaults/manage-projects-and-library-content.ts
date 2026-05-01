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
        invalidatePaginatedList(getAssetsListQueryKey())
        invalidateItem(getAssetsRetrieveQueryKey(uidAsset))
      },
    },
  }),
)

import { useEffect } from 'react'
import type { DataResponse } from '#/api/models/dataResponse'
import { queryClient } from '#/api/queryClient'
import {
  getAssetsAdvancedFeaturesCreateMutationOptions,
  getAssetsDataSupplementPartialUpdateMutationOptions,
  getAssetsDataSupplementRetrieveQueryKey,
  getAssetsPairedDataPartialUpdateMutationOptions,
  useAssetsDataSupplementRetrieve,
} from '#/api/react-query/survey-data'
import type { AssetResponse } from '#/dataInterface'
import { removeDefaultUuidPrefix } from '#/utils'

const POLL_INTERVAL = 3000

interface Options {
  firstPollDelayMs?: number
}

/**
 * Shared polling loop for async supplement writes. Transcript and translation screens
 * both use it so they stay in sync with the backend without duplicating the same timer code.
 */
export function useSupplementStatusPolling(asset: AssetResponse, submission: DataResponse, options: Options = {}) {
  const rootUuid = removeDefaultUuidPrefix(submission['meta/rootUuid'])
  const firstPollDelayMs = Math.max(0, options.firstPollDelayMs ?? POLL_INTERVAL)

  const mutationPending =
    queryClient.isMutating({ mutationKey: getAssetsAdvancedFeaturesCreateMutationOptions().mutationKey! }) > 0 ||
    queryClient.isMutating({ mutationKey: getAssetsPairedDataPartialUpdateMutationOptions().mutationKey! }) > 0 ||
    queryClient.isMutating({ mutationKey: getAssetsDataSupplementPartialUpdateMutationOptions().mutationKey! }) > 0

  // Don't race mutations; mutation response will directly update this.
  const querySupplement = useAssetsDataSupplementRetrieve(asset.uid, rootUuid, {
    query: {
      queryKey: getAssetsDataSupplementRetrieveQueryKey(asset.uid, rootUuid),
      staleTime: Number.POSITIVE_INFINITY,
      enabled: !mutationPending,
    },
  })
  // Keep the effect tied to the stable refetch function. The query result object changes
  // on every update, and that would restart the timer from scratch.
  const { refetch } = querySupplement

  useEffect(() => {
    if (mutationPending) return // Start polling only after the initial mutation(s) are done.
    let timeoutId: NodeJS.Timeout

    const pollStatus = () => {
      refetch()
      timeoutId = setTimeout(pollStatus, POLL_INTERVAL)
    }

    timeoutId = setTimeout(pollStatus, firstPollDelayMs)

    return () => {
      clearTimeout(timeoutId)
    }
  }, [refetch, mutationPending, firstPollDelayMs])
}

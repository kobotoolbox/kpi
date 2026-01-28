import { useCallback } from 'react'
import type { _DataSupplementResponseOneOfManualQualVersionsItem } from '#/api/models/_dataSupplementResponseOneOfManualQualVersionsItem'
import { ActionEnum } from '#/api/models/actionEnum'
import type { DataResponse } from '#/api/models/dataResponse'
import type { PatchedDataSupplementPayloadOneOfManualQual } from '#/api/models/patchedDataSupplementPayloadOneOfManualQual'
import type { ResponseQualActionParams } from '#/api/models/responseQualActionParams'
import { queryClient } from '#/api/queryClient'
import {
  type assetsDataSupplementRetrieveResponse,
  getAssetsAdvancedFeaturesListQueryKey,
  getAssetsDataSupplementRetrieveQueryKey,
  useAssetsAdvancedFeaturesCreate,
  useAssetsAdvancedFeaturesPartialUpdate,
  useAssetsDataSupplementPartialUpdate,
  useAssetsDataSupplementRetrieve,
} from '#/api/react-query/survey-data'
import { SUBSEQUENCES_SCHEMA_VERSION } from '#/components/processing/common/constants'
import type { AssetResponse } from '#/dataInterface'
import { removeDefaultUuidPrefix } from '#/utils'
import type { AdvancedFeatureResponseManualQual } from '../../../common/utils'

export const useAssetsDataSupplementRetrieveQaHelper = (
  asset: AssetResponse,
  questionXpath: string,
  submission: DataResponse,
  qaQuestion: ResponseQualActionParams,
  options: Parameters<typeof useAssetsDataSupplementRetrieve>[2] = {},
) => {
  const queryQaAnswer = useAssetsDataSupplementRetrieve(
    asset.uid,
    removeDefaultUuidPrefix(submission['meta/rootUuid']),
    {
      query: {
        ...options?.query, // Note: can't and shouldn't override props below.
        staleTime: Number.POSITIVE_INFINITY,
        queryKey: getAssetsDataSupplementRetrieveQueryKey(
          asset.uid,
          removeDefaultUuidPrefix(submission['meta/rootUuid']),
        ),
        select: useCallback(
          (
            data: assetsDataSupplementRetrieveResponse,
          ): _DataSupplementResponseOneOfManualQualVersionsItem | undefined => {
            if (data.status !== 200) return // typeguard, should never happen
            return data.data[questionXpath].manual_qual?.[qaQuestion.uuid]?._versions[0]
          },
          [questionXpath, qaQuestion.uuid],
        ),
      },
      request: options?.request,
    },
  )

  return queryQaAnswer
}

export const useAssetsDataSupplementPartialUpdateQaHelper = (
  asset: AssetResponse,
  questionXpath: string,
  submission: DataResponse,
  qaQuestion: ResponseQualActionParams,
  options: Parameters<typeof useAssetsDataSupplementPartialUpdate>[0] = {},
) => {
  const mutationSave = useAssetsDataSupplementPartialUpdate({
    mutation: {
      onSuccess: (data) => {
        // Update the cache directly instead of invalidating to prevent flickering
        queryClient.setQueryData(
          getAssetsDataSupplementRetrieveQueryKey(asset.uid, removeDefaultUuidPrefix(submission['meta/rootUuid'])),
          data,
        )
      },
      onError: () => {
        // On error, invalidate to refetch and ensure we have the correct server state
        queryClient.invalidateQueries({
          queryKey: getAssetsDataSupplementRetrieveQueryKey(
            asset.uid,
            removeDefaultUuidPrefix(submission['meta/rootUuid']),
          ),
        })
      },
      ...options?.mutation,
    },
    request: options?.request,
  })

  const handleSave = (value: PatchedDataSupplementPayloadOneOfManualQual['value']) => {
    return mutationSave.mutateAsync({
      uidAsset: asset.uid,
      rootUuid: removeDefaultUuidPrefix(submission['meta/rootUuid']),
      data: {
        _version: SUBSEQUENCES_SCHEMA_VERSION,
        [questionXpath]: {
          [ActionEnum.manual_qual]: {
            uuid: qaQuestion.uuid,
            value,
          },
        },
      },
    })
  }

  return [mutationSave, handleSave] as const
}

export const useAssetsDataSupplementUpsertQaHelper = (
  asset: AssetResponse,
  advancedFeature: AdvancedFeatureResponseManualQual,
  options: Parameters<typeof useAssetsAdvancedFeaturesCreate | typeof useAssetsAdvancedFeaturesPartialUpdate>[0] = {},
) => {
  const isCreate = advancedFeature.uid === 'placeholder' // TODO: extract, type & document

  const mutationCreate = useAssetsAdvancedFeaturesCreate({
    mutation: {
      onSettled: () => {
        queryClient.invalidateQueries({
          queryKey: getAssetsAdvancedFeaturesListQueryKey(asset.uid),
        })
      },
      ...(options as Parameters<typeof useAssetsAdvancedFeaturesCreate>[0])?.mutation,
    },
    request: options?.request,
  })
  const mutationPatch = useAssetsAdvancedFeaturesPartialUpdate({
    mutation: {
      onSettled: () => {
        queryClient.invalidateQueries({
          queryKey: getAssetsAdvancedFeaturesListQueryKey(asset.uid),
        })
      },
      ...(options as Parameters<typeof useAssetsAdvancedFeaturesPartialUpdate>[0])?.mutation,
    },
    request: options?.request,
  })

  const handleUpsert = (params: ResponseQualActionParams[]) => {
    if (isCreate) {
      return mutationCreate.mutateAsync({
        uidAsset: asset.uid,
        data: {
          action: ActionEnum.manual_qual,
          question_xpath: advancedFeature.question_xpath,
          params: params,
        },
      })
    } else {
      return mutationPatch.mutateAsync({
        uidAsset: asset.uid,
        uidAdvancedFeature: advancedFeature.uid,
        data: {
          params: params,
        },
      })
    }
  }

  return [isCreate ? mutationCreate : mutationPatch, handleUpsert] as const
}

export const useAssetsDataSupplementDeleteQaHelper = (
  asset: AssetResponse,
  advancedFeature: AdvancedFeatureResponseManualQual,
  options: Parameters<typeof useAssetsAdvancedFeaturesPartialUpdate>[0] = {},
) => {
  const mutationPatch = useAssetsAdvancedFeaturesPartialUpdate({
    mutation: {
      onSettled: () => {
        queryClient.invalidateQueries({
          queryKey: getAssetsAdvancedFeaturesListQueryKey(asset.uid),
        })
      },
      ...(options as Parameters<typeof useAssetsAdvancedFeaturesPartialUpdate>[0])?.mutation,
    },
    request: options?.request,
  })

  const handleDelete = (qaQuestionToDelete: ResponseQualActionParams) => {
    // Mark the question as deleted by setting options.deleted to true
    const updatedParams = advancedFeature.params.map((param) =>
      param.uuid === qaQuestionToDelete.uuid ? { ...param, options: { ...param.options, deleted: true } } : param,
    )

    return mutationPatch.mutateAsync({
      uidAsset: asset.uid,
      uidAdvancedFeature: advancedFeature.uid,
      data: {
        params: updatedParams,
      },
    })
  }

  return [mutationPatch, handleDelete] as const
}

export const useAssetsDataSupplementReorderQaHelper = (
  asset: AssetResponse,
  advancedFeature: AdvancedFeatureResponseManualQual,
  options: Parameters<typeof useAssetsAdvancedFeaturesPartialUpdate>[0] = {},
) => {
  const mutationPatch = useAssetsAdvancedFeaturesPartialUpdate({
    mutation: {
      onSettled: () => {
        queryClient.invalidateQueries({
          queryKey: getAssetsAdvancedFeaturesListQueryKey(asset.uid),
        })
      },
      ...(options as Parameters<typeof useAssetsAdvancedFeaturesPartialUpdate>[0])?.mutation,
    },
    request: options?.request,
  })

  const handleReorder = (reorderedParams: ResponseQualActionParams[]) => {
    return mutationPatch.mutateAsync({
      uidAsset: asset.uid,
      uidAdvancedFeature: advancedFeature.uid,
      data: {
        params: reorderedParams,
      },
    })
  }

  return [mutationPatch, handleReorder] as const
}

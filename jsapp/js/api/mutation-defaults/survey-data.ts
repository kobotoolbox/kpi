import {
  type assetsDataSupplementRetrieveResponse,
  getAssetsAdvancedFeaturesCreateMutationOptions,
  getAssetsAdvancedFeaturesListQueryKey,
  getAssetsAdvancedFeaturesPartialUpdateMutationOptions,
  getAssetsAdvancedFeaturesRetrieveQueryKey,
  getAssetsAttachmentsBulkDestroyMutationOptions,
  getAssetsAttachmentsDestroyMutationOptions,
  getAssetsDataListQueryKey,
  getAssetsDataSupplementPartialUpdateMutationOptions,
  getAssetsDataSupplementRetrieveQueryKey,
} from '#/api/react-query/survey-data'
import type { ManualQualValue } from '#/components/processing/common/types'
import { TransxVersionSortFunction } from '#/components/processing/common/utils'
import { recordEntries, recordKeys } from '#/utils'
import { ActionEnum } from '../models/actionEnum'
import type { PatchedDataSupplementPayloadOneOf } from '../models/patchedDataSupplementPayloadOneOf'
import type { PatchedDataSupplementPayloadOneOfAutomaticGoogleTranscription } from '../models/patchedDataSupplementPayloadOneOfAutomaticGoogleTranscription'
import type { PatchedDataSupplementPayloadOneOfAutomaticGoogleTranslation } from '../models/patchedDataSupplementPayloadOneOfAutomaticGoogleTranslation'
import type { PatchedDataSupplementPayloadOneOfManualQual } from '../models/patchedDataSupplementPayloadOneOfManualQual'
import type { PatchedDataSupplementPayloadOneOfManualTranscription } from '../models/patchedDataSupplementPayloadOneOfManualTranscription'
import type { PatchedDataSupplementPayloadOneOfManualTranslation } from '../models/patchedDataSupplementPayloadOneOfManualTranslation'
import type { SupplementalDataAutomaticTranscription } from '../models/supplementalDataAutomaticTranscription'
import type { SupplementalDataAutomaticTranslation } from '../models/supplementalDataAutomaticTranslation'
import type { SupplementalDataManualQual } from '../models/supplementalDataManualQual'
import type { SupplementalDataManualTranscription } from '../models/supplementalDataManualTranscription'
import type { SupplementalDataManualTranslation } from '../models/supplementalDataManualTranslation'
import { queryClient } from '../queryClient'
import { invalidateItem, invalidatePaginatedList, optimisticallyUpdateItem } from './common'

queryClient.setMutationDefaults(
  getAssetsAdvancedFeaturesCreateMutationOptions().mutationKey!,
  getAssetsAdvancedFeaturesCreateMutationOptions({
    mutation: {
      onSettled: (_data, _error, { uidAsset }) => {
        invalidateItem(getAssetsAdvancedFeaturesListQueryKey(uidAsset))
      },
    },
  }),
)

queryClient.setMutationDefaults(
  getAssetsAdvancedFeaturesPartialUpdateMutationOptions().mutationKey!,
  getAssetsAdvancedFeaturesPartialUpdateMutationOptions({
    mutation: {
      onSettled: (_data, _error, { uidAsset, uidAdvancedFeature }) => {
        invalidateItem(getAssetsAdvancedFeaturesListQueryKey(uidAsset))
        invalidateItem(getAssetsAdvancedFeaturesRetrieveQueryKey(uidAsset, uidAdvancedFeature))
      },
    },
  }),
)

queryClient.setMutationDefaults(
  getAssetsAttachmentsDestroyMutationOptions().mutationKey!,
  getAssetsAttachmentsDestroyMutationOptions({
    mutation: {
      // TODO: this could be easily upgraded to an optimistic update.
      onSettled: (_data, _error, { uidAsset }) => {
        // Note: we could target the query that gets the specific submission, but that's not enough.
        // There could be any other queries that accidentally include the mutated submission.
        // Thus, invalidate them all.
        // TODO: add a new helper that could interate through a list and invalidate only caches that contain the item.
        invalidatePaginatedList(getAssetsDataListQueryKey(uidAsset))
      },
    },
  }),
)

queryClient.setMutationDefaults(
  getAssetsAttachmentsBulkDestroyMutationOptions().mutationKey!,
  getAssetsAttachmentsBulkDestroyMutationOptions({
    mutation: {
      // TODO: this could be easily upgraded to an optimistic update.
      onSettled: (_data, _error, { uidAsset }) => {
        // Note: we could target the query that gets the specific submission, but that's not enough.
        // There could be any other queries that accidentally include the mutated submission.
        // Thus, invalidate them all.
        // TODO: add a new helper that could interate through a list and invalidate only caches that contain the item.
        invalidatePaginatedList(getAssetsDataListQueryKey(uidAsset))
      },
    },
  }),
)

queryClient.setMutationDefaults(
  getAssetsDataSupplementPartialUpdateMutationOptions().mutationKey!,
  getAssetsDataSupplementPartialUpdateMutationOptions({
    mutation: {
      onMutate: async ({ uidAsset, rootUuid, data: _data }) => {
        const data = _data as Record<string, PatchedDataSupplementPayloadOneOf> // Note: workaround for Orval types.

        const questionXpath = recordKeys(data).find((key) => key !== '_version')
        if (!questionXpath) throw new Error('Question XPATH not found in the payload.')

        const [action, datum] = recordEntries(data[questionXpath] as PatchedDataSupplementPayloadOneOf)[0]
        if (!action) throw new Error('Action not found in the payload.')

        switch (action) {
          case ActionEnum.manual_qual: {
            const { uuid } = datum as PatchedDataSupplementPayloadOneOfManualQual
            const value: ManualQualValue | undefined = 'value' in datum! ? datum.value : undefined
            const itemSnapshot = await optimisticallyUpdateItem<assetsDataSupplementRetrieveResponse>(
              getAssetsDataSupplementRetrieveQueryKey(uidAsset, rootUuid),
              (response) =>
                ({
                  ...response,
                  data: {
                    ...response?.data,
                    ...(response?.status === 200
                      ? {
                          [questionXpath]: {
                            ...response?.data?.[questionXpath],
                            [action]: {
                              ...response?.data?.[questionXpath]?.[action],
                              [uuid]: {
                                ...response?.data?.[questionXpath]?.[action]?.[uuid],
                                _versions: [
                                  {
                                    _uuid: '<mock-uuid-not-used>',
                                    _data: {
                                      uuid,
                                      value,
                                    },
                                    _dateCreated: new Date().toISOString(),
                                  }, // Note: this is the actual optimistally added object.
                                  ...(response?.data?.[questionXpath]?.[action]?.[uuid]?._versions ?? []),
                                ],
                              },
                            } as SupplementalDataManualQual,
                          },
                        }
                      : {}),
                  },
                }) as assetsDataSupplementRetrieveResponse,
            )

            return {
              snapshots: [itemSnapshot],
            }
          }
          case ActionEnum.manual_transcription: {
            const itemSnapshot = await optimisticallyUpdateItem<assetsDataSupplementRetrieveResponse>(
              getAssetsDataSupplementRetrieveQueryKey(uidAsset, rootUuid),
              (response) => {
                if (response?.status !== 200) return response // just a typeguard, UI shouldn't allow to mutate if error.
                const _versions = response?.data?.[questionXpath]?.[action]?._versions ?? []

                return {
                  ...response,
                  data: {
                    ...response?.data,
                    [questionXpath]: {
                      ...response?.data?.[questionXpath],
                      [action]: {
                        ...response?.data?.[questionXpath]?.[action],
                        _versions: [
                          {
                            _uuid: '<mock-uuid-not-used>',
                            _data: datum as PatchedDataSupplementPayloadOneOfManualTranscription,
                            _dateCreated: new Date().toISOString(),
                          }, // Note: this is the actual optimistally added object.
                          ..._versions,
                        ],
                      } as SupplementalDataManualTranscription,
                    },
                  },
                } as assetsDataSupplementRetrieveResponse
              },
            )

            return {
              snapshots: [itemSnapshot],
            }
          }
          case ActionEnum.manual_translation: {
            const { language } = datum as PatchedDataSupplementPayloadOneOfManualTranslation
            const itemSnapshot = await optimisticallyUpdateItem<assetsDataSupplementRetrieveResponse>(
              getAssetsDataSupplementRetrieveQueryKey(uidAsset, rootUuid),
              (response) => {
                if (response?.status !== 200) return response // just a typeguard, UI shouldn't allow to mutate if error.
                const _versions = response?.data?.[questionXpath]?.[action]?.[language]?._versions ?? []

                return {
                  ...response,
                  data: {
                    ...response?.data,
                    [questionXpath]: {
                      ...response?.data?.[questionXpath],
                      [action]: {
                        ...response?.data?.[questionXpath]?.[action],
                        [language]: {
                          ...response?.data?.[questionXpath]?.[action]?.[language],
                          _versions: [
                            {
                              _uuid: '<mock-uuid-not-used>',
                              _data: datum as PatchedDataSupplementPayloadOneOfManualTranslation,
                              _dateCreated: new Date().toISOString(),
                            }, // Note: this is the actual optimistally added object.
                            ..._versions,
                          ],
                        },
                      } as SupplementalDataManualTranslation,
                    },
                  },
                } as assetsDataSupplementRetrieveResponse
              },
            )

            return {
              snapshots: [itemSnapshot],
            }
          }
          case ActionEnum.automatic_google_transcription: {
            const datumTyped = datum as PatchedDataSupplementPayloadOneOfAutomaticGoogleTranscription
            const itemSnapshot = await optimisticallyUpdateItem<assetsDataSupplementRetrieveResponse>(
              getAssetsDataSupplementRetrieveQueryKey(uidAsset, rootUuid),
              (response) => {
                if (response?.status !== 200) return response // just a typeguard, UI shouldn't allow to mutate if error.
                let _versions = response?.data?.[questionXpath]?.[action]?._versions ?? []

                // TODO OpenAPI: see DEV-1722
                if ((datumTyped as any).value === null) {
                  // If discarding/deleting (value: null), clear all versions for this language
                  _versions = []
                } else if (datumTyped.accepted === true) {
                  // If accepting, update the latest version's status to accepted
                  const latest = _versions.sort(TransxVersionSortFunction)[0]
                  if (latest) {
                    latest._dateAccepted = new Date().toISOString()
                    latest._data.status = 'complete'
                  }
                } else {
                  // Otherwise, add new version to the beginning
                  _versions = [
                    {
                      _uuid: '<mock-uuid-not-used>',
                      _data: {
                        ...datumTyped,
                        status: 'in_progress',
                      },
                      _dateCreated: new Date().toISOString(),
                    },
                    ..._versions,
                  ]
                }

                return {
                  ...response,
                  data: {
                    ...response?.data,
                    [questionXpath]: {
                      ...response?.data?.[questionXpath],
                      [action]: {
                        ...response?.data?.[questionXpath]?.[action],
                        _versions,
                      } as SupplementalDataAutomaticTranscription,
                    },
                  },
                } as assetsDataSupplementRetrieveResponse
              },
            )

            return {
              snapshots: [itemSnapshot],
            }
          }
          case ActionEnum.automatic_google_translation: {
            const datumTyped = datum as PatchedDataSupplementPayloadOneOfAutomaticGoogleTranslation
            const { language } = datumTyped
            const itemSnapshot = await optimisticallyUpdateItem<assetsDataSupplementRetrieveResponse>(
              getAssetsDataSupplementRetrieveQueryKey(uidAsset, rootUuid),
              (response) => {
                if (response?.status !== 200) return response // just a typeguard, UI shouldn't allow to mutate if error.
                let _versions = response?.data?.[questionXpath]?.[action]?.[language]?._versions ?? []

                // TODO OpenAPI: see DEV-1722
                if ((datumTyped as any).value === null) {
                  // If discarding/deleting (value: null), clear all versions for this language
                  _versions = []
                } else if (datumTyped.accepted === true) {
                  // If accepting, update the latest version's status to accepted
                  const latest = _versions.sort(TransxVersionSortFunction)[0]
                  if (latest) {
                    latest._dateAccepted = new Date().toISOString()
                    latest._data.status = 'complete'
                  }
                } else {
                  // Otherwise, add new version to the beginning
                  _versions = [
                    {
                      _uuid: '<mock-uuid-not-used>',
                      _data: {
                        ...datumTyped,
                        status: 'in_progress',
                      },
                      _dateCreated: new Date().toISOString(),
                      ...({} as { _dependency: { _actionId: ''; _uuid: '' } }), // TODO OpenAPI: see DEV-1721
                    },
                    ..._versions,
                  ]
                }

                return {
                  ...response,
                  data: {
                    ...response?.data,
                    [questionXpath]: {
                      ...response?.data?.[questionXpath],
                      [action]: {
                        ...response?.data?.[questionXpath]?.[action],
                        [language]: {
                          ...response?.data?.[questionXpath]?.[action]?.[language],
                          _versions,
                        },
                      } as SupplementalDataAutomaticTranslation,
                    },
                  },
                } as assetsDataSupplementRetrieveResponse
              },
            )

            return {
              snapshots: [itemSnapshot],
            }
          }
          case ActionEnum.automatic_bedrock_qual: {
            // No optimistic update for automatic_bedrock_qual since
            // it only supports 'complete' or 'failed' status (no 'in_progress')
            return {
              snapshots: [],
            }
          }
          default:
            throw new Error(`Unknown action "${action}" is not handled.`)
        }
      },
      /**
       * Good example of a Direct Update, for cases when mutation returns the whole response.
       *
       * Note: use `onSettled` instead of `onSuccess` to be executed AFTER global invalidation logic
       * in order to cancel it. See more `onSettledInvalidateSnapshots`.
       *
       * Note: in case of **both** Optimistic Update and Direct Update, check for parallel mutations.
       * Do not Direcly Update an old value over a newer value already set by newer mutation's Optimistic Update.
       *
       * See more at https://tkdodo.eu/blog/mastering-mutations-in-react-query#direct-updates
       */
      onSettled: async (response, error, { rootUuid, uidAsset }, _context) => {
        if (error) return
        const queryKey = getAssetsDataSupplementRetrieveQueryKey(uidAsset, rootUuid)
        queryClient.cancelQueries({ queryKey, exact: true })

        const mutationKey = getAssetsDataSupplementPartialUpdateMutationOptions().mutationKey!
        if (queryClient.isMutating({ mutationKey }) > 1) return

        queryClient.setQueryData(queryKey, response)
      },
    },
  }),
)

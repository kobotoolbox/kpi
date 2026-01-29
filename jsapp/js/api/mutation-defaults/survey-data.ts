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
import { recordEntries, recordKeys } from '#/utils'
import { ActionEnum } from '../models/actionEnum'
import type { DataSupplementResponseOneOfAutomaticGoogleTranscription } from '../models/dataSupplementResponseOneOfAutomaticGoogleTranscription'
import type { DataSupplementResponseOneOfAutomaticGoogleTranslation } from '../models/dataSupplementResponseOneOfAutomaticGoogleTranslation'
import type { DataSupplementResponseOneOfManualQual } from '../models/dataSupplementResponseOneOfManualQual'
import type { DataSupplementResponseOneOfManualTranscription } from '../models/dataSupplementResponseOneOfManualTranscription'
import type { DataSupplementResponseOneOfManualTranslation } from '../models/dataSupplementResponseOneOfManualTranslation'
import type { PatchedDataSupplementPayloadOneOf } from '../models/patchedDataSupplementPayloadOneOf'
import type { PatchedDataSupplementPayloadOneOfAutomaticGoogleTranscription } from '../models/patchedDataSupplementPayloadOneOfAutomaticGoogleTranscription'
import type { PatchedDataSupplementPayloadOneOfAutomaticGoogleTranslation } from '../models/patchedDataSupplementPayloadOneOfAutomaticGoogleTranslation'
import type { PatchedDataSupplementPayloadOneOfManualQual } from '../models/patchedDataSupplementPayloadOneOfManualQual'
import type { PatchedDataSupplementPayloadOneOfManualTranscription } from '../models/patchedDataSupplementPayloadOneOfManualTranscription'
import type { PatchedDataSupplementPayloadOneOfManualTranslation } from '../models/patchedDataSupplementPayloadOneOfManualTranslation'
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
            const { uuid, value } = datum as PatchedDataSupplementPayloadOneOfManualQual
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
                                    _uuid: '<server-generated-not-used>',
                                    _data: {
                                      uuid,
                                      value,
                                    },
                                    _dateCreated: new Date().toISOString(),
                                  }, // Note: this is the actual optimistally added object.
                                  ...(response?.data?.[questionXpath]?.[action]?.[uuid]?._versions ?? []),
                                ],
                              },
                            } as DataSupplementResponseOneOfManualQual,
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
                              _versions: [
                                {
                                  _uuid: '<server-generated-not-used>',
                                  _data: datum as PatchedDataSupplementPayloadOneOfManualTranscription,
                                  _dateCreated: new Date().toISOString(),
                                }, // Note: this is the actual optimistally added object.
                                ...(response?.data?.[questionXpath]?.[action]?._versions ?? []),
                              ],
                            } as DataSupplementResponseOneOfManualTranscription,
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
          case ActionEnum.manual_translation: {
            const { language } = datum as PatchedDataSupplementPayloadOneOfManualTranslation
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
                              [language]: {
                                ...response?.data?.[questionXpath]?.[action]?.[language],
                                _versions: [
                                  {
                                    _uuid: '<server-generated-not-used>',
                                    _data: datum as PatchedDataSupplementPayloadOneOfManualTranslation,
                                    _dateCreated: new Date().toISOString(),
                                  }, // Note: this is the actual optimistally added object.
                                  ...(response?.data?.[questionXpath]?.[action]?.[language]?._versions ?? []),
                                ],
                              },
                            } as DataSupplementResponseOneOfManualTranslation,
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
          case ActionEnum.automatic_google_transcription: {
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
                              _versions: [
                                {
                                  _uuid: '<server-generated-not-used>',
                                  _data: {
                                    ...(datum as PatchedDataSupplementPayloadOneOfAutomaticGoogleTranscription),
                                    status: 'in_progress',
                                  },
                                  _dateCreated: new Date().toISOString(),
                                }, // Note: this is the actual optimistally added object.
                                ...(response?.data?.[questionXpath]?.[action]?._versions ?? []),
                              ],
                            } as DataSupplementResponseOneOfAutomaticGoogleTranscription,
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
          case ActionEnum.automatic_google_translation: {
            const { language } = datum as PatchedDataSupplementPayloadOneOfAutomaticGoogleTranslation
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
                              [language]: {
                                ...response?.data?.[questionXpath]?.[action]?.[language],
                                _versions: [
                                  {
                                    _uuid: '<server-generated-not-used>',
                                    _data: {
                                      ...(datum as PatchedDataSupplementPayloadOneOfAutomaticGoogleTranslation),
                                      status: 'in_progress',
                                    },
                                    _dateCreated: new Date().toISOString(),
                                  }, // Note: this is the actual optimistally added object.
                                  ...(response?.data?.[questionXpath]?.[action]?.[language]?._versions ?? []),
                                ],
                              },
                            } as DataSupplementResponseOneOfAutomaticGoogleTranslation,
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
          default: {
            // TODO: optimistic updates for all.
            const itemSnapshot = await optimisticallyUpdateItem<assetsDataSupplementRetrieveResponse>(
              getAssetsDataSupplementRetrieveQueryKey(uidAsset, rootUuid),
              (response) => response,
            )

            return {
              snapshots: [itemSnapshot],
            }
          }
        }
      },
    },
  }),
)

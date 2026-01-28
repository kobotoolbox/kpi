import {
  type assetsDataSupplementRetrieveResponse,
  getAssetsAdvancedFeaturesCreateMutationOptions,
  getAssetsAdvancedFeaturesListQueryKey,
  getAssetsAdvancedFeaturesPartialUpdateMutationOptions,
  getAssetsAdvancedFeaturesRetrieveQueryKey,
  getAssetsDataSupplementPartialUpdateMutationOptions,
  getAssetsDataSupplementRetrieveQueryKey,
} from '#/api/react-query/survey-data'
import { recordEntries, recordKeys } from '#/utils'
import { ActionEnum } from '../models/actionEnum'
import type { DataSupplementResponseOneOfManualQual } from '../models/dataSupplementResponseOneOfManualQual'
import type { DataSupplementResponseOneOfManualTranscription } from '../models/dataSupplementResponseOneOfManualTranscription'
import type { DataSupplementResponseOneOfManualTranslation } from '../models/dataSupplementResponseOneOfManualTranslation'
import type { PatchedDataSupplementPayloadOneOf } from '../models/patchedDataSupplementPayloadOneOf'
import type { PatchedDataSupplementPayloadOneOfManualQual } from '../models/patchedDataSupplementPayloadOneOfManualQual'
import type { PatchedDataSupplementPayloadOneOfManualTranscription } from '../models/patchedDataSupplementPayloadOneOfManualTranscription'
import type { PatchedDataSupplementPayloadOneOfManualTranslation } from '../models/patchedDataSupplementPayloadOneOfManualTranslation'
import { queryClient } from '../queryClient'
import { invalidateItem, optimisticallyUpdateItem } from './common'

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
          case ActionEnum.automatic_google_translation:
          case ActionEnum.automatic_google_transcription:
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

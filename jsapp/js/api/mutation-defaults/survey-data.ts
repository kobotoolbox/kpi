import type { QueryClient } from '@tanstack/react-query'
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
  getAssetsExportSettingsCreateMutationOptions,
  getAssetsExportSettingsDestroyMutationOptions,
  getAssetsExportSettingsListQueryKey,
  getAssetsExportSettingsPartialUpdateMutationOptions,
  getAssetsExportSettingsRetrieveQueryKey,
  getAssetsExportsCreateMutationOptions,
  getAssetsExportsDestroyMutationOptions,
  getAssetsExportsListQueryKey,
  getAssetsExportsRetrieveQueryKey,
  getAssetsFilesCreateMutationOptions,
  getAssetsFilesDestroyMutationOptions,
  getAssetsFilesListQueryKey,
  getAssetsPairedDataDestroyMutationOptions,
  getAssetsPairedDataListQueryKey,
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
import { invalidateItem, invalidatePaginatedList, optimisticallyUpdateItem } from './common'

/**
 * Applies survey-data mutation defaults to a QueryClient instance.
 * Call this on both the global queryClient and test/story queryClients
 * to ensure consistent invalidation behavior.
 */
export function applySurveyDataMutationDefaults(client: QueryClient): void {
  // Note: No reflux bridge routes needed for assets files endpoints - all
  // actions.media.* consumers have been migrated to React Query.
  client.setMutationDefaults(
    getAssetsFilesCreateMutationOptions().mutationKey!,
    getAssetsFilesCreateMutationOptions({
      mutation: {
        onSettled: (_data, _error, { uidAsset }) => {
          invalidateItem(getAssetsFilesListQueryKey(uidAsset), client)
        },
      },
    }),
  )

  client.setMutationDefaults(
    getAssetsExportsCreateMutationOptions().mutationKey!,
    getAssetsExportsCreateMutationOptions({
      mutation: {
        onSettled: (_data, _error, { uidAsset }) => {
          // Exports list can be cached both with and without params.
          client.invalidateQueries({ queryKey: getAssetsExportsListQueryKey(uidAsset), exact: true })
          invalidatePaginatedList(getAssetsExportsListQueryKey(uidAsset), client)
        },
      },
    }),
  )

  client.setMutationDefaults(
    getAssetsExportsDestroyMutationOptions().mutationKey!,
    getAssetsExportsDestroyMutationOptions({
      mutation: {
        onSettled: (_data, _error, { uidAsset, uidExport }) => {
          client.invalidateQueries({ queryKey: getAssetsExportsListQueryKey(uidAsset), exact: true })
          invalidatePaginatedList(getAssetsExportsListQueryKey(uidAsset), client)
          invalidateItem(getAssetsExportsRetrieveQueryKey(uidAsset, uidExport), client)
        },
      },
    }),
  )

  client.setMutationDefaults(
    getAssetsExportSettingsCreateMutationOptions().mutationKey!,
    getAssetsExportSettingsCreateMutationOptions({
      mutation: {
        onSettled: (_data, _error, { uidAsset }) => {
          client.invalidateQueries({ queryKey: getAssetsExportSettingsListQueryKey(uidAsset), exact: true })
          invalidatePaginatedList(getAssetsExportSettingsListQueryKey(uidAsset), client)
        },
      },
    }),
  )

  client.setMutationDefaults(
    getAssetsExportSettingsPartialUpdateMutationOptions().mutationKey!,
    getAssetsExportSettingsPartialUpdateMutationOptions({
      mutation: {
        onSettled: (_data, _error, { uidAsset, uidExportSetting }) => {
          client.invalidateQueries({ queryKey: getAssetsExportSettingsListQueryKey(uidAsset), exact: true })
          invalidatePaginatedList(getAssetsExportSettingsListQueryKey(uidAsset), client)
          invalidateItem(getAssetsExportSettingsRetrieveQueryKey(uidAsset, uidExportSetting), client)
        },
      },
    }),
  )

  client.setMutationDefaults(
    getAssetsExportSettingsDestroyMutationOptions().mutationKey!,
    getAssetsExportSettingsDestroyMutationOptions({
      mutation: {
        onSettled: (_data, _error, { uidAsset, uidExportSetting }) => {
          client.invalidateQueries({ queryKey: getAssetsExportSettingsListQueryKey(uidAsset), exact: true })
          invalidatePaginatedList(getAssetsExportSettingsListQueryKey(uidAsset), client)
          invalidateItem(getAssetsExportSettingsRetrieveQueryKey(uidAsset, uidExportSetting), client)
        },
      },
    }),
  )

  client.setMutationDefaults(
    getAssetsFilesDestroyMutationOptions().mutationKey!,
    getAssetsFilesDestroyMutationOptions({
      mutation: {
        onSettled: (_data, _error, { uidAsset }) => {
          invalidateItem(getAssetsFilesListQueryKey(uidAsset), client)
        },
      },
    }),
  )

  client.setMutationDefaults(
    getAssetsAdvancedFeaturesCreateMutationOptions().mutationKey!,
    getAssetsAdvancedFeaturesCreateMutationOptions({
      mutation: {
        onSettled: (_data, _error, { uidAsset }) => {
          invalidateItem(getAssetsAdvancedFeaturesListQueryKey(uidAsset), client)
        },
      },
    }),
  )

  client.setMutationDefaults(
    getAssetsAdvancedFeaturesPartialUpdateMutationOptions().mutationKey!,
    getAssetsAdvancedFeaturesPartialUpdateMutationOptions({
      mutation: {
        onSettled: (_data, _error, { uidAsset, uidAdvancedFeature }) => {
          invalidateItem(getAssetsAdvancedFeaturesListQueryKey(uidAsset), client)
          invalidateItem(getAssetsAdvancedFeaturesRetrieveQueryKey(uidAsset, uidAdvancedFeature), client)
        },
      },
    }),
  )

  client.setMutationDefaults(
    getAssetsAttachmentsDestroyMutationOptions().mutationKey!,
    getAssetsAttachmentsDestroyMutationOptions({
      mutation: {
        // TODO: this could be easily upgraded to an optimistic update.
        onSettled: (_data, _error, { uidAsset }) => {
          // Note: we could target the query that gets the specific submission, but that's not enough.
          // There could be any other queries that accidentally include the mutated submission.
          // Thus, invalidate them all.
          // TODO: add a new helper that could interate through a list and invalidate only caches that contain the item.
          invalidatePaginatedList(getAssetsDataListQueryKey(uidAsset), client)
        },
      },
    }),
  )

  client.setMutationDefaults(
    getAssetsAttachmentsBulkDestroyMutationOptions().mutationKey!,
    getAssetsAttachmentsBulkDestroyMutationOptions({
      mutation: {
        // TODO: this could be easily upgraded to an optimistic update.
        onSettled: (_data, _error, { uidAsset }) => {
          // Note: we could target the query that gets the specific submission, but that's not enough.
          // There could be any other queries that accidentally include the mutated submission.
          // Thus, invalidate them all.
          // TODO: add a new helper that could interate through a list and invalidate only caches that contain the item.
          invalidatePaginatedList(getAssetsDataListQueryKey(uidAsset), client)
        },
      },
    }),
  )

  client.setMutationDefaults(
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
              const verified: boolean | undefined = 'verified' in datum! ? (datum as any).verified : undefined
              const itemSnapshot = await optimisticallyUpdateItem<assetsDataSupplementRetrieveResponse>(
                getAssetsDataSupplementRetrieveQueryKey(uidAsset, rootUuid),
                (response) => {
                  if (response?.status !== 200) return response
                  const existingVersions = response?.data?.[questionXpath]?.[action]?.[uuid]?._versions ?? []

                  // For verification-only updates, update `verified` on the most recent existing
                  // version rather than prepending a new one (which would have value: undefined
                  // and corrupt the answer in optimistic UI)
                  const newVersions =
                    value !== undefined
                      ? [
                          {
                            _uuid: '<mock-uuid-not-used>',
                            _data: { uuid, value },
                            _dateCreated: new Date().toISOString(),
                            ...(verified !== undefined ? { verified } : {}),
                          }, // Note: this is the actual optimistically added object.
                          ...existingVersions,
                        ]
                      : existingVersions.length > 0 && verified !== undefined
                        ? [{ ...existingVersions[0], verified }, ...existingVersions.slice(1)]
                        : existingVersions

                  return {
                    ...response,
                    data: {
                      ...response?.data,
                      [questionXpath]: {
                        ...response?.data?.[questionXpath],
                        [action]: {
                          ...response?.data?.[questionXpath]?.[action],
                          [uuid]: {
                            ...response?.data?.[questionXpath]?.[action]?.[uuid],
                            _versions: newVersions,
                          },
                        } as SupplementalDataManualQual,
                      },
                    },
                  } as assetsDataSupplementRetrieveResponse
                },
                client,
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
                client,
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
                client,
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

                  if (datumTyped.value === null) {
                    // If discarding/deleting (value: null), clear all versions for this language
                    _versions = []
                  } else if (datumTyped.accepted === true) {
                    // If accepting, update the latest version's status to accepted
                    const [versionLatest, ...versionsRest] = [..._versions].sort(TransxVersionSortFunction)
                    if (versionLatest) {
                      _versions = [
                        {
                          ...versionLatest,
                          _dateAccepted: new Date().toISOString(),
                        },
                        ...versionsRest,
                      ]
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
                client,
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

                  if (datumTyped.value === null) {
                    // If discarding/deleting (value: null), clear all versions for this language
                    _versions = []
                  } else if (datumTyped.accepted === true) {
                    // If accepting, update the latest version's status to accepted
                    const [versionLatest, ...versionsRest] = [..._versions].sort(TransxVersionSortFunction)
                    if (versionLatest) {
                      _versions = [
                        {
                          ...versionLatest,
                          _dateAccepted: new Date().toISOString(),
                        },
                        ...versionsRest,
                      ]
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
                client,
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
          client.cancelQueries({ queryKey, exact: true })

          const mutationKey = getAssetsDataSupplementPartialUpdateMutationOptions().mutationKey!
          if (client.isMutating({ mutationKey }) > 1) return

          client.setQueryData(queryKey, response)
        },
      },
    }),
  )

  client.setMutationDefaults(
    getAssetsPairedDataDestroyMutationOptions().mutationKey!,
    getAssetsPairedDataDestroyMutationOptions({
      mutation: {
        onSettled: (_data, _error, { uidAsset }) => {
          const queryKey = getAssetsPairedDataListQueryKey(uidAsset)
          invalidateItem(queryKey, client)
        },
      },
    }),
  )
}

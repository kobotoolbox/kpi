import {
  type assetsDataSupplementRetrieveResponse,
  getAssetsDataSupplementPartialUpdateMutationOptions,
  getAssetsDataSupplementRetrieveQueryKey,
} from '#/api/react-query/survey-data'
import { recordEntries, recordKeys } from '#/utils'
import { ActionEnum } from '../models/actionEnum'
import type { DataSupplementResponseOneOfManualQual } from '../models/dataSupplementResponseOneOfManualQual'
import type { PatchedDataSupplementPayloadOneOf } from '../models/patchedDataSupplementPayloadOneOf'
import type { PatchedDataSupplementPayloadOneOfManualQual } from '../models/patchedDataSupplementPayloadOneOfManualQual'
import { queryClient } from '../queryClient'
import { optimisticallyUpdateItem } from './common'

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
          case ActionEnum.automatic_google_transcription:
          case ActionEnum.automatic_google_translation:
          case ActionEnum.manual_transcription:
          case ActionEnum.manual_translation:
          default: {
            // TODO: optimistic updates for all.
            return
          }
        }
      },
    },
  }),
)

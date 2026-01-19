import React, { useState } from 'react'
import type { _DataSupplementResponseOneOfAutomaticGoogleTranscriptionVersionsItem } from '#/api/models/_dataSupplementResponseOneOfAutomaticGoogleTranscriptionVersionsItem'
import type { _DataSupplementResponseOneOfManualTranscriptionVersionsItem } from '#/api/models/_dataSupplementResponseOneOfManualTranscriptionVersionsItem'
import type { DataResponse } from '#/api/models/dataResponse'
import type { NLPActionParamsItem } from '#/api/models/nLPActionParamsItem'
import { queryClient } from '#/api/queryClient'
import {
  getAssetsAdvancedFeaturesListQueryKey,
  getAssetsDataSupplementRetrieveQueryKey,
  useAssetsAdvancedFeaturesCreate,
  useAssetsAdvancedFeaturesList,
  useAssetsAdvancedFeaturesPartialUpdate,
  useAssetsDataSupplementPartialUpdate,
} from '#/api/react-query/survey-data'
import Button from '#/components/common/button'
import type { LanguageCode } from '#/components/languages/languagesStore'
import { userCan } from '#/components/permissions/utils'
import { SUBSEQUENCES_SCHEMA_VERSION } from '#/components/processing/common/constants'
import type { AssetResponse } from '#/dataInterface'
import { removeDefaultUuidPrefix } from '#/utils'
import bodyStyles from '../../../common/processingBody.module.scss'
import { ADVANCED_FEATURES_ACTION, isTranscriptVersionAutomatic } from '../common/utils'
import HeaderLanguageAndDate from './headerLanguageAndDate'

interface Props {
  asset: AssetResponse
  questionXpath: string
  submission: DataResponse
  transcriptVersion:
    | _DataSupplementResponseOneOfManualTranscriptionVersionsItem
    | _DataSupplementResponseOneOfAutomaticGoogleTranscriptionVersionsItem
  onBack: () => void
}

export default function Editor({ asset, questionXpath, submission, transcriptVersion, onBack }: Props) {
  const initialValue = 'value' in transcriptVersion._data ? transcriptVersion._data.value : null
  const unacceptedAutomaticTranscript =
    isTranscriptVersionAutomatic(transcriptVersion) && !transcriptVersion._dateAccepted
  const [value, setValue] = useState(initialValue)

  const queryAF = useAssetsAdvancedFeaturesList(asset.uid)
  const advancedFeature =
    queryAF.data?.status === 200
      ? queryAF.data?.data.find(
          (af) => af.action === ADVANCED_FEATURES_ACTION.manual_transcription && af.question_xpath === questionXpath,
        )
      : undefined
  console.log(advancedFeature)

  const patch = useAssetsDataSupplementPartialUpdate({
    mutation: {
      onSettled: () => {
        queryClient.invalidateQueries({
          queryKey: getAssetsDataSupplementRetrieveQueryKey(
            asset.uid,
            removeDefaultUuidPrefix(submission['meta/rootUuid']),
          ),
        })
      },
    },
  })

  const mutationCreateAF = useAssetsAdvancedFeaturesCreate({
    mutation: {
      onSettled: () => queryClient.invalidateQueries({ queryKey: getAssetsAdvancedFeaturesListQueryKey(asset.uid) }),
    },
  })
  const mutationPatchAF = useAssetsAdvancedFeaturesPartialUpdate({
    mutation: {
      onSettled: () => queryClient.invalidateQueries({ queryKey: getAssetsAdvancedFeaturesListQueryKey(asset.uid) }),
    },
  })
  const assertManualAdvancedFeature = async (languageCode: LanguageCode) => {
    // Silently under the hook enable advanced features if needed.
    if (!advancedFeature) {
      await mutationCreateAF.mutateAsync({
        uidAsset: asset.uid,
        data: {
          question_xpath: questionXpath,
          action: ADVANCED_FEATURES_ACTION.manual_transcription,
          // TODO: OpenAPI shouldn't be double-arrayed.
          params: [
            {
              language: languageCode,
            } as any,
          ],
        },
      })
      // TODO: should I check for locales too or not?
      // TODO: OpenAPI shouldn't be double-arrayed.
    } else if (
      !advancedFeature?.params.find((param) => (param as any as NLPActionParamsItem).language === languageCode)
    ) {
      await mutationPatchAF.mutateAsync({
        uidAsset: asset.uid,
        uidAdvancedFeature: advancedFeature.uid,
        data: {
          action: ADVANCED_FEATURES_ACTION.manual_transcription, // TODO: OpenAPI PatchedAdvancedFeaturePatchRequest doesn't have this prop typed.
          question_xpath: questionXpath, // TODO: OpenAPI PatchedAdvancedFeaturePatchRequest doesn't have this prop typed.
          params: advancedFeature.params.concat({
            // TODO: OpenAPI shouldn't be double-arrayed.
            language: languageCode,
          } as any),
        } as any,
      })
    }
  }

  const handleSave = async () => {
    if (!value) return // Just a typeguard, button is disabled.
    if (value === initialValue && isTranscriptVersionAutomatic(transcriptVersion)) {
      await patch.mutateAsync({
        uidAsset: asset.uid,
        rootUuid: removeDefaultUuidPrefix(submission['meta/rootUuid']),
        data: {
          _version: SUBSEQUENCES_SCHEMA_VERSION,
          [questionXpath]: {
            [ADVANCED_FEATURES_ACTION.automatic_google_transcription]: {
              language: transcriptVersion._data.language,
              accepted: true,
            } as any, // TODO OpenAPI: PatchedDataSupplementPayloadOneOfOneOfAutomaticGoogleTranscription for PATCH shouldn't have `language` prop.
          },
        },
      })
    } else {
      await assertManualAdvancedFeature(transcriptVersion._data.language)
      await patch.mutateAsync({
        uidAsset: asset.uid,
        rootUuid: removeDefaultUuidPrefix(submission['meta/rootUuid']),
        data: {
          _version: SUBSEQUENCES_SCHEMA_VERSION,
          [questionXpath]: {
            [ADVANCED_FEATURES_ACTION.manual_transcription]: {
              language: transcriptVersion._data.language,
              value: value,
            },
          },
        },
      })
    }

    onBack()
  }

  const handleDiscard = async () => {
    if (unacceptedAutomaticTranscript) {
      await assertManualAdvancedFeature(transcriptVersion._data.language)
      await patch.mutateAsync({
        uidAsset: asset.uid,
        rootUuid: removeDefaultUuidPrefix(submission['meta/rootUuid']),
        data: {
          _version: SUBSEQUENCES_SCHEMA_VERSION,
          [questionXpath]: {
            [ADVANCED_FEATURES_ACTION.automatic_google_transcription]: {
              language: transcriptVersion._data.language, // TODO OpenAPI & API: why this prop is required at all?
              value: null, // TODO OpenAPI: is that `null` or `''` to "discard" automatic transcription?
            },
          },
        },
      })
      // TODO: add some spinner while this loads.
    }

    onBack()
  }

  return (
    <>
      <header className={bodyStyles.transxHeader}>
        <HeaderLanguageAndDate transcriptVersion={transcriptVersion} />

        <nav className={bodyStyles.transxHeaderButtons}>
          <Button
            type='secondary'
            size='s'
            label={value === initialValue ? t('Back') : t('Discard')}
            onClick={handleDiscard}
            isDisabled={patch.isPending || !userCan('change_submissions', asset)}
          />

          <Button
            type='primary'
            size='s'
            label={t('Save')}
            onClick={handleSave}
            isPending={patch.isPending}
            isDisabled={
              !value ||
              (value === initialValue && !unacceptedAutomaticTranscript) ||
              !userCan('change_submissions', asset)
            }
          />
        </nav>
      </header>

      <textarea
        className={bodyStyles.textarea}
        value={value || ''}
        onChange={(evt: React.ChangeEvent<HTMLTextAreaElement>) => setValue(evt.target.value)}
        disabled={false}
        dir='auto'
      />
    </>
  )
}

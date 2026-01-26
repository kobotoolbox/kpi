import React, { useEffect, useState } from 'react'
import type { _DataSupplementResponseOneOfAutomaticGoogleTranscriptionVersionsItem } from '#/api/models/_dataSupplementResponseOneOfAutomaticGoogleTranscriptionVersionsItem'
import type { _DataSupplementResponseOneOfManualTranscriptionVersionsItem } from '#/api/models/_dataSupplementResponseOneOfManualTranscriptionVersionsItem'
import { ActionEnum } from '#/api/models/actionEnum'
import type { AdvancedFeatureResponse } from '#/api/models/advancedFeatureResponse'
import type { DataResponse } from '#/api/models/dataResponse'
import { queryClient } from '#/api/queryClient'
import {
  getAssetsAdvancedFeaturesListQueryKey,
  getAssetsDataSupplementRetrieveQueryKey,
  useAssetsAdvancedFeaturesCreate,
  useAssetsAdvancedFeaturesPartialUpdate,
  useAssetsDataSupplementPartialUpdate,
} from '#/api/react-query/survey-data'
import Button from '#/components/common/button'
import type { LanguageCode } from '#/components/languages/languagesStore'
import { userCan } from '#/components/permissions/utils'
import { isSupplementVersionAutomatic } from '#/components/processing/common/utils'
import type { AssetResponse } from '#/dataInterface'
import { removeDefaultUuidPrefix } from '#/utils'
import { SUBSEQUENCES_SCHEMA_VERSION } from '../../../common/constants'
import bodyStyles from '../../../common/processingBody.module.scss'
import HeaderLanguageAndDate from './headerLanguageAndDate'

interface Props {
  asset: AssetResponse
  questionXpath: string
  submission: DataResponse
  transcriptVersion:
    | _DataSupplementResponseOneOfManualTranscriptionVersionsItem
    | _DataSupplementResponseOneOfAutomaticGoogleTranscriptionVersionsItem
  onBack: () => void
  onSave?: () => void
  onUnsavedWorkChange: (hasUnsavedWork: boolean) => void
  advancedFeatures: AdvancedFeatureResponse[]
}

export default function Editor({
  asset,
  questionXpath,
  submission,
  transcriptVersion,
  onBack,
  onSave,
  onUnsavedWorkChange,
  advancedFeatures,
}: Props) {
  const initialValue = 'value' in transcriptVersion._data ? transcriptVersion._data.value : null
  const unacceptedAutomaticTranscript =
    isSupplementVersionAutomatic(transcriptVersion) && !transcriptVersion._dateAccepted
  const [value, setValue] = useState(initialValue)

  // Track unsaved work when value changes from initial
  useEffect(() => {
    onUnsavedWorkChange(value !== initialValue)
  }, [value, initialValue, onUnsavedWorkChange])

  const advancedFeature = advancedFeatures.find(
    (af) => af.action === ActionEnum.manual_transcription && af.question_xpath === questionXpath,
  )

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
          action: ActionEnum.manual_transcription,
          params: [
            {
              language: languageCode,
            },
          ],
        },
      })
      // TODO: should I check for locales too or not?
    } else if (!advancedFeature?.params.find((param) => 'language' in param && param.language === languageCode)) {
      await mutationPatchAF.mutateAsync({
        uidAsset: asset.uid,
        uidAdvancedFeature: advancedFeature.uid,
        data: {
          action: ActionEnum.manual_transcription, // TODO: OpenAPI PatchedAdvancedFeaturePatchRequest doesn't have this prop typed. https://linear.app/kobotoolbox/issue/DEV-1627
          question_xpath: questionXpath, // TODO: OpenAPI PatchedAdvancedFeaturePatchRequest doesn't have this prop typed. https://linear.app/kobotoolbox/issue/DEV-1627
          params: advancedFeature.params.concat({
            language: languageCode,
          }),
        } as any,
      })
    }
  }

  const handleSave = async () => {
    if (!value) return // Just a typeguard, button is disabled.
    if (value === initialValue && isSupplementVersionAutomatic(transcriptVersion)) {
      await patch.mutateAsync({
        uidAsset: asset.uid,
        rootUuid: removeDefaultUuidPrefix(submission['meta/rootUuid']),
        data: {
          _version: SUBSEQUENCES_SCHEMA_VERSION,
          [questionXpath]: {
            [ActionEnum.automatic_google_transcription]: {
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
            [ActionEnum.manual_transcription]: {
              language: transcriptVersion._data.language,
              value: value,
            },
          },
        },
      })
    }

    // Clear unsaved work status after successful save
    onUnsavedWorkChange(false)
    if (onSave) {
      onSave()
    }
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
            [ActionEnum.automatic_google_transcription]: {
              language: transcriptVersion._data.language, // TODO OpenAPI & API: why this prop is required at all?
              value: null, // TODO OpenAPI: is that `null` or `''` to "discard" automatic transcription?
            },
          },
        },
      })
      // TODO: add some spinner while this loads.
    }

    // Reset value to initial to clear unsaved work status
    setValue(initialValue)
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

import React, { useState } from 'react'

import cx from 'classnames'
import { ActionEnum } from '#/api/models/actionEnum'
import type { AdvancedFeatureResponse } from '#/api/models/advancedFeatureResponse'
import type { DataResponse } from '#/api/models/dataResponse'
import {
  useAssetsAdvancedFeaturesCreate,
  useAssetsAdvancedFeaturesPartialUpdate,
  useAssetsDataSupplementPartialUpdate,
} from '#/api/react-query/survey-data'
import Button from '#/components/common/button'
import type { LanguageCode, LocaleCode } from '#/components/languages/languagesStore'
import RegionSelector from '#/components/languages/regionSelector'
import type { AssetResponse } from '#/dataInterface'
import { removeDefaultUuidPrefix } from '#/utils'
import { SUBSEQUENCES_SCHEMA_VERSION } from '../../../common/constants'
import bodyStyles from '../../../common/processingBody.module.scss'

interface Props {
  asset: AssetResponse
  questionXpath: string
  languageCode: LanguageCode
  submission: DataResponse
  onBack: () => void
  advancedFeatures: AdvancedFeatureResponse[]
  setIsTranscribing: (isTranscribing: boolean) => void
}

export default function StepCreateAutomated({
  asset,
  questionXpath,
  languageCode,
  submission,
  onBack,
  advancedFeatures,
  setIsTranscribing,
}: Props) {
  const [locale, setLocale] = useState<null | string>(null)

  const advancedFeature = advancedFeatures.find(
    (af) => af.action === ActionEnum.automatic_google_transcription && af.question_xpath === questionXpath,
  )

  const mutationCreateAF = useAssetsAdvancedFeaturesCreate()
  const mutationPatchAF = useAssetsAdvancedFeaturesPartialUpdate()

  const mutationCreateAutomaticTranscript = useAssetsDataSupplementPartialUpdate()

  const anyPending =
    mutationCreateAF.isPending || mutationPatchAF.isPending || mutationCreateAutomaticTranscript.isPending

  function handleChangeLocale(newVal: LocaleCode | null) {
    setLocale(newVal)
  }

  function handleClickBack() {
    onBack()
  }

  async function handleCreateTranscript() {
    // Set transcribing flag immediately for instant UI feedback
    setIsTranscribing(true)

    // TODO: Check for mutation errors to handle and setIsTranscribing to false again

    // Silently under the hook enable advanced features if needed.
    if (!advancedFeature) {
      await mutationCreateAF.mutateAsync({
        uidAsset: asset.uid,
        data: {
          question_xpath: questionXpath,
          action: ActionEnum.automatic_google_transcription,
          params: [
            {
              language: languageCode,
            },
          ],
        },
      })
    } else if (!advancedFeature?.params.find((param) => 'language' in param && param.language === languageCode)) {
      await mutationPatchAF.mutateAsync({
        uidAsset: asset.uid,
        uidAdvancedFeature: advancedFeature.uid,
        data: {
          action: ActionEnum.automatic_google_transcription,
          question_xpath: questionXpath,
          params: advancedFeature.params.concat({
            language: languageCode,
          }),
        } as any,
      })
    }

    await mutationCreateAutomaticTranscript.mutateAsync({
      uidAsset: asset.uid,
      rootUuid: removeDefaultUuidPrefix(submission['meta/rootUuid']),
      data: {
        _version: SUBSEQUENCES_SCHEMA_VERSION,
        [questionXpath]: {
          automatic_google_transcription: { language: languageCode, locale },
        },
      },
    })
  }

  if (!languageCode) return null

  // During mutation and after success, let parent handle the view
  if (mutationCreateAutomaticTranscript.isPending || mutationCreateAutomaticTranscript.isSuccess) {
    return null
  }

  return (
    <div className={cx(bodyStyles.root, bodyStyles.stepConfig)}>
      <header className={bodyStyles.header}>{t('Automatic transcription of audio file from')}</header>

      <RegionSelector
        isDisabled={anyPending}
        serviceCode='goog'
        serviceType='transcription'
        rootLanguage={languageCode}
        onRegionChange={handleChangeLocale}
        onCancel={handleClickBack}
      />

      <h2>{t('Transcription provider')}</h2>

      <p>
        {t(
          'Automated transcription is provided by Google Cloud Platform. By ' +
            'using this service you agree that your audio file will be sent to ' +
            "Google's servers for the purpose of transcribing. However, it will " +
            "not be stored on Google's servers beyond the short period needed for " +
            'completing the transcription, and we do not allow Google to use the ' +
            'audio for improving its transcription service.',
        )}
      </p>

      <footer className={bodyStyles.footer}>
        <div className={bodyStyles.footerCenterButtons}>
          <Button type='secondary' size='m' label={t('cancel')} onClick={handleClickBack} isDisabled={anyPending} />

          <Button
            type='primary'
            size='m'
            label={t('create transcript')}
            onClick={handleCreateTranscript}
            isDisabled={anyPending}
          />
        </div>
      </footer>
    </div>
  )
}

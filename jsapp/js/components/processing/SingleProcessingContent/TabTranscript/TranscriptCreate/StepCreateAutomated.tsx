import React, { useEffect, useState } from 'react'

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
import LoadingSpinner from '#/components/common/loadingSpinner'
import type { LanguageCode, LocaleCode } from '#/components/languages/languagesStore'
import RegionSelector from '#/components/languages/regionSelector'
import type { AssetResponse } from '#/dataInterface'
import { getAudioDuration, removeDefaultUuidPrefix } from '#/utils'
import { SUBSEQUENCES_SCHEMA_VERSION } from '../../../common/constants'
import bodyStyles from '../../../common/processingBody.module.scss'
import { getAttachmentForProcessing, secondsToTranscriptionEstimate } from '../transcript.utils'

/** Until the estimate is loaded we display dot dot dot. */
const NO_ESTIMATED_MINUTES = '…'

interface Props {
  asset: AssetResponse
  questionXpath: string
  languageCode: LanguageCode
  submission: DataResponse
  onBack: () => void
  advancedFeatures: AdvancedFeatureResponse[]
}

export default function StepCreateAutomated({
  asset,
  questionXpath,
  languageCode,
  submission,
  onBack,
  advancedFeatures,
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

  // When polling for transcript, we need to calculate the estimated time
  // TODO improvement: check `sidebarSubmissionMedia`, perhaps get a duration in a sync manner, show asap?
  const [estimate, setEstimate] = useState<string>(NO_ESTIMATED_MINUTES)
  useEffect(() => {
    if (mutationCreateAutomaticTranscript.isPending) {
      const attachment = getAttachmentForProcessing(asset, questionXpath, submission)
      if (typeof attachment !== 'string') {
        getAudioDuration(attachment.download_url).then((length: number) => {
          setEstimate(secondsToTranscriptionEstimate(length))
        })
      }
    } else {
      setEstimate(NO_ESTIMATED_MINUTES)
    }
  }, [mutationCreateAutomaticTranscript.isPending])

  function handleChangeLocale(newVal: LocaleCode | null) {
    setLocale(newVal)
  }

  function handleClickBack() {
    onBack()
  }

  async function handleCreateTranscript() {
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
          action: ActionEnum.automatic_google_transcription, // TODO: OpenAPI PatchedAdvancedFeaturePatchRequest doesn't have this prop typed. See https://linear.app/kobotoolbox/issue/DEV-1627
          question_xpath: questionXpath, // TODO: OpenAPI PatchedAdvancedFeaturePatchRequest doesn't have this prop typed. https://linear.app/kobotoolbox/issue/DEV-1627
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

  if (mutationCreateAutomaticTranscript.isPending) {
    return (
      <div className={cx(bodyStyles.root, bodyStyles.stepConfig)}>
        <LoadingSpinner type='big' message={false} />

        <header className={bodyStyles.header}>{t('Automatic transcription in progress')}</header>

        <p>{t('Estimated time for completion: ##estimate##').replace('##estimate##', estimate)}</p>
      </div>
    )
  }

  // During a short moment after mutation finishes, we want to avoid blinking of previous UI
  if (mutationCreateAutomaticTranscript.isSuccess) {
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

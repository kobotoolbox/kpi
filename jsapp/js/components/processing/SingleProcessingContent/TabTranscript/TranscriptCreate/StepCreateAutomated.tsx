import React, { useEffect, useState } from 'react'

import cx from 'classnames'
import type { AdvancedFeatureResponse } from '#/api/models/advancedFeatureResponse'
import type { DataResponse } from '#/api/models/dataResponse'
import { onErrorDefaultHandler } from '#/api/onErrorDefaultHandler'
import { queryClient } from '#/api/queryClient'
import {
  getAssetsAdvancedFeaturesListQueryKey,
  getAssetsDataSupplementRetrieveQueryKey,
  useAssetsAdvancedFeaturesCreate,
  useAssetsAdvancedFeaturesPartialUpdate,
  useAssetsDataSupplementPartialUpdate,
} from '#/api/react-query/survey-data'
import Button from '#/components/common/button'
import LoadingSpinner from '#/components/common/loadingSpinner'
import type { LanguageCode, LocaleCode } from '#/components/languages/languagesStore'
import RegionSelector from '#/components/languages/regionSelector'
import type { AssetResponse } from '#/dataInterface'
import { getAudioDuration, notify, removeDefaultUuidPrefix } from '#/utils'
import { ADVANCED_FEATURES_ACTION, SUBSEQUENCES_SCHEMA_VERSION } from '../../../common/constants'
import bodyStyles from '../../../common/processingBody.module.scss'
import { getAttachmentForProcessing, secondsToTranscriptionEstimate } from '../transcript.utils'

/** Until the estimate is loaded we display dot dot dot. */
const NO_ESTIMATED_MINUTES = '…'

interface Props {
  asset: AssetResponse
  questionXpath: string
  languageCode: LanguageCode
  submission: DataResponse & Record<string, string>
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
    (af) =>
      af.action === ADVANCED_FEATURES_ACTION.automatic_google_transcription && af.question_xpath === questionXpath,
  )

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

  const mutationCreateAutomaticTranscript = useAssetsDataSupplementPartialUpdate({
    mutation: {
      onSettled: () => {
        queryClient.invalidateQueries({
          queryKey: getAssetsDataSupplementRetrieveQueryKey(
            asset.uid,
            removeDefaultUuidPrefix(submission['meta/rootUuid']),
          ),
        })
      },
      onError: (error, variables, context) => {
        if (error.detail === 'Invalid action') {
          // This should never happen. If you encounter this error, figure out
          // why advanced feature wasn't enabled silently before transcript request
          notify(
            'Advances Features are not enabled for this language for this form.',
            'error',
            {},
            `${error.name}: ${error.message} | ${error.detail}`,
          )
        } else {
          onErrorDefaultHandler(error, variables, context)
        }
      },
    },
  })

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
          action: ADVANCED_FEATURES_ACTION.automatic_google_transcription,
          // TODO: OpenAPI shouldn't be double-arrayed.
          params: [
            {
              language: languageCode,
            } as any,
          ],
        },
      })
      // TODO: OpenAPI shouldn't be double-arrayed.
    } else if (!advancedFeature?.params.find((param) => 'language' in param && param.language === languageCode)) {
      await mutationPatchAF.mutateAsync({
        uidAsset: asset.uid,
        uidAdvancedFeature: advancedFeature.uid,
        data: {
          action: ADVANCED_FEATURES_ACTION.automatic_google_transcription, // TODO: OpenAPI PatchedAdvancedFeaturePatchRequest doesn't have this prop typed.
          question_xpath: questionXpath, // TODO: OpenAPI PatchedAdvancedFeaturePatchRequest doesn't have this prop typed.
          params: advancedFeature.params.concat({
            // TODO: OpenAPI shouldn't be double-arrayed.
            language: languageCode,
          } as any),
        } as any,
      })
    }

    await mutationCreateAutomaticTranscript.mutateAsync({
      uidAsset: asset.uid,
      rootUuid: removeDefaultUuidPrefix(submission['meta/rootUuid']),
      data: {
        _version: SUBSEQUENCES_SCHEMA_VERSION,
        [questionXpath]: {
          automatic_google_transcription: { language: languageCode, locale } as any, // TODO: OpenAPI is missing `locale`.
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

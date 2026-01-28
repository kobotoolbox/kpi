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
import Alert from '#/components/common/alert'
import Button from '#/components/common/button'
import LoadingSpinner from '#/components/common/loadingSpinner'
import type { LanguageCode, LocaleCode } from '#/components/languages/languagesStore'
import RegionSelector from '#/components/languages/regionSelector'
import { SUBSEQUENCES_SCHEMA_VERSION } from '#/components/processing/common/constants'
import { getLatestAutomaticTranslationVersionItem } from '#/components/processing/common/utils'
import type { AssetResponse } from '#/dataInterface'
import { removeDefaultUuidPrefix } from '#/utils'
import bodyStyles from '../../../common/processingBody.module.scss'

interface Props {
  asset: AssetResponse
  questionXpath: string
  languageCode: LanguageCode
  submission: DataResponse
  onBack: () => void
  onCreate: (languageCode: LanguageCode) => void
  advancedFeatures: AdvancedFeatureResponse[]
}

export default function StepCreateAutomated({
  asset,
  questionXpath,
  languageCode,
  submission,
  onBack,
  onCreate,
  advancedFeatures,
}: Props) {
  const [locale, setLocale] = useState<null | string>(null)

  const advancedFeature = advancedFeatures.find(
    (af) => af.action === ActionEnum.automatic_google_translation && af.question_xpath === questionXpath,
  )

  const mutationCreateAF = useAssetsAdvancedFeaturesCreate()
  const mutationPatchAF = useAssetsAdvancedFeaturesPartialUpdate()

  const mutationCreateAutomaticTranslation = useAssetsDataSupplementPartialUpdate()

  const latestAutomaticTranslation =
    mutationCreateAutomaticTranslation.data?.status === 200
      ? getLatestAutomaticTranslationVersionItem(
          mutationCreateAutomaticTranslation.data?.data,
          questionXpath,
          languageCode,
        )?._data
      : undefined
  const errorMessage =
    latestAutomaticTranslation &&
    'status' in latestAutomaticTranslation &&
    latestAutomaticTranslation.status === 'failed' &&
    latestAutomaticTranslation.error

  const anyPending =
    mutationCreateAF.isPending || mutationPatchAF.isPending || mutationCreateAutomaticTranslation.isPending

  function handleChangeLocale(newVal: LocaleCode | null) {
    setLocale(newVal)
  }

  function handleClickBack() {
    onBack()
  }

  // TODO: cleanup unused methods, search for `requestAutoTranslation`
  async function handleCreateTranslation() {
    // Silently under the hook enable advanced features if needed.
    if (!advancedFeature) {
      await mutationCreateAF.mutateAsync({
        uidAsset: asset.uid,
        data: {
          question_xpath: questionXpath,
          action: ActionEnum.automatic_google_translation,
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
          action: ActionEnum.automatic_google_translation, // TODO: OpenAPI PatchedAdvancedFeaturePatchRequest doesn't have this prop typed. https://linear.app/kobotoolbox/issue/DEV-1627
          question_xpath: questionXpath, // TODO: OpenAPI PatchedAdvancedFeaturePatchRequest doesn't have this prop typed. https://linear.app/kobotoolbox/issue/DEV-1627
          params: advancedFeature.params.concat({
            language: languageCode,
          }),
        } as any,
      })
    }

    await mutationCreateAutomaticTranslation.mutateAsync({
      uidAsset: asset.uid,
      rootUuid: removeDefaultUuidPrefix(submission['meta/rootUuid']),
      data: {
        _version: SUBSEQUENCES_SCHEMA_VERSION,
        [questionXpath]: {
          automatic_google_translation: { language: languageCode, locale },
        },
      },
    })

    // TODO: Error handling, e.g. can't translate to language that's the transcript is in.

    onCreate(languageCode)
  }

  if (!languageCode) return null

  if (mutationCreateAutomaticTranslation.isPending) {
    return (
      <div className={cx(bodyStyles.root, bodyStyles.stepConfig)}>
        <LoadingSpinner type='big' message={false} />

        <header className={bodyStyles.header}>{t('Automatic translation in progress')}</header>

        {/*
          Automatic translation is much faster than automatic transcription, but
          for the consistency sake we use similar UI here.
        */}
        <p>{t('Estimated time for completion: ##estimate##').replace('##estimate##', t('less than a minute'))}</p>
      </div>
    )
  }

  return (
    <div className={cx(bodyStyles.root, bodyStyles.stepConfig)}>
      <header className={bodyStyles.header}>{t('Automatic translation of transcript to')}</header>

      <RegionSelector
        isDisabled={anyPending}
        serviceCode='goog'
        serviceType='translation'
        rootLanguage={languageCode}
        onRegionChange={handleChangeLocale}
        onCancel={handleClickBack}
      />

      <h2>{t('Translation provider')}</h2>

      <p>
        {t(
          'Automated translation is provided by Google Cloud Platform. By using ' +
            'this service you agree that your transcript text will be sent to ' +
            "Google's servers for the purpose of translation. However, it will not " +
            "be stored on Google's servers beyond the very short period needed for " +
            'completing the translation.',
        )}
      </p>

      {errorMessage && (
        <div>
          <Alert iconName='alert' type='error'>
            {errorMessage}
          </Alert>
        </div>
      )}

      <footer className={bodyStyles.footer}>
        <div className={bodyStyles.footerCenterButtons}>
          <Button type='secondary' size='m' label={t('cancel')} onClick={handleClickBack} isDisabled={anyPending} />

          <Button
            type='primary'
            size='m'
            label={t('create translation')}
            onClick={handleCreateTranslation}
            isDisabled={anyPending}
          />
        </div>
      </footer>
    </div>
  )
}

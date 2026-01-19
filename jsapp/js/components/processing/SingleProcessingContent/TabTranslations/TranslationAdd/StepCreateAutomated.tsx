import React, { useState } from 'react'

import cx from 'classnames'
import type { DataResponse } from '#/api/models/dataResponse'
import type { NLPActionParamsItem } from '#/api/models/nLPActionParamsItem'
import { onErrorDefaultHandler } from '#/api/onErrorDefaultHandler'
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
import LoadingSpinner from '#/components/common/loadingSpinner'
import type { LanguageCode, LocaleCode } from '#/components/languages/languagesStore'
import RegionSelector from '#/components/languages/regionSelector'
import { ADVANCED_FEATURES_ACTION, SUBSEQUENCES_SCHEMA_VERSION } from '#/components/processing/common/constants'
import type { AssetResponse } from '#/dataInterface'
import { notify, removeDefaultUuidPrefix } from '#/utils'
import bodyStyles from '../../../common/processingBody.module.scss'

interface Props {
  asset: AssetResponse
  questionXpath: string
  languageCode: LanguageCode
  submission: DataResponse & Record<string, string>
  onBack: () => void
  onCreate: (languageCode: LanguageCode) => void
}

export default function StepCreateAutomated({
  asset,
  questionXpath,
  languageCode,
  submission,
  onBack,
  onCreate,
}: Props) {
  const [locale, setLocale] = useState<null | string>(null)

  // TODO: remove, for now just logging for debugging.
  const queryAF = useAssetsAdvancedFeaturesList(asset.uid)

  const advancedFeature =
    queryAF.data?.status === 200
      ? queryAF.data?.data.find(
          (af) =>
            af.action === ADVANCED_FEATURES_ACTION.automatic_google_translation && af.question_xpath === questionXpath,
        )
      : undefined
  console.log(advancedFeature)

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

  const mutationCreateAutomaticTranslation = useAssetsDataSupplementPartialUpdate({
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
          // TODO: should never happen, gotta check and enable silently.
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
    queryAF.isPending ||
    mutationCreateAF.isPending ||
    mutationPatchAF.isPending ||
    mutationCreateAutomaticTranslation.isPending

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
          action: ADVANCED_FEATURES_ACTION.automatic_google_translation,
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
          action: ADVANCED_FEATURES_ACTION.automatic_google_translation, // TODO: OpenAPI PatchedAdvancedFeaturePatchRequest doesn't have this prop typed.
          question_xpath: questionXpath, // TODO: OpenAPI PatchedAdvancedFeaturePatchRequest doesn't have this prop typed.
          params: advancedFeature.params.concat({
            // TODO: OpenAPI shouldn't be double-arrayed.
            language: languageCode,
          } as any),
        } as any,
      })
    }

    await mutationCreateAutomaticTranslation.mutateAsync({
      uidAsset: asset.uid,
      rootUuid: removeDefaultUuidPrefix(submission['meta/rootUuid']),
      data: {
        _version: SUBSEQUENCES_SCHEMA_VERSION,
        [questionXpath]: {
          automatic_google_translation: { language: languageCode, locale } as any, // TODO: OpenAPI is missing `locale`.
        },
      },
    })

    // TODO: Error handling, e.g. can't translate to language that's the transcript is in.

    onCreate(languageCode)
  }

  if (!languageCode) return null

  console.log('TranslationCreate', locale)

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

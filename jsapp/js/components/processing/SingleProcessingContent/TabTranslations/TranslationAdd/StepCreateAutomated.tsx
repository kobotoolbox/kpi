import React from 'react'

import { Flex, Group, TextInput } from '@mantine/core'
import { IconLanguage, IconX } from '@tabler/icons-react'
import cx from 'classnames'
import { ServerError } from '#/api/ServerError'
import { ActionEnum } from '#/api/models/actionEnum'
import type { AdvancedFeatureResponse } from '#/api/models/advancedFeatureResponse'
import type { DataResponse } from '#/api/models/dataResponse'
import { getLanguagesRetrieveQueryKey, useLanguagesRetrieve } from '#/api/react-query/other'
import {
  useAssetsAdvancedFeaturesCreate,
  useAssetsAdvancedFeaturesPartialUpdate,
  useAssetsDataSupplementPartialUpdate,
} from '#/api/react-query/survey-data'
import ActionIcon from '#/components/common/ActionIcon'
import KoboIcon from '#/components/common/KoboIcon'
import Alert from '#/components/common/alert'
import Button from '#/components/common/button'
import LoadingSpinner from '#/components/common/loadingSpinner'
import type { LanguageCode } from '#/components/languages/languagesStore'
import { SUBSEQUENCES_SCHEMA_VERSION } from '#/components/processing/common/constants'
import { getLatestAutomaticTranslationVersionItem } from '#/components/processing/common/utils'
import type { AssetResponse } from '#/dataInterface'
import { notify, removeDefaultUuidPrefix } from '#/utils'
import bodyStyles from '../../../common/processingBody.module.scss'

interface Props {
  asset: AssetResponse
  questionXpath: string
  languageCode: LanguageCode
  submission: DataResponse
  onBack: () => void
  onLimitExceeded: () => void
  onCreate: (languageCode: LanguageCode, context: 'automated' | 'manual') => void
  advancedFeatures: AdvancedFeatureResponse[]
}

export default function StepCreateAutomated({
  asset,
  questionXpath,
  languageCode,
  submission,
  onBack,
  onLimitExceeded,
  onCreate,
  advancedFeatures,
}: Props) {
  const advancedFeature = advancedFeatures.find(
    (af) => af.action === ActionEnum.automatic_google_translation && af.question_xpath === questionXpath,
  )

  const mutationCreateAF = useAssetsAdvancedFeaturesCreate()
  const mutationPatchAF = useAssetsAdvancedFeaturesPartialUpdate()
  const mutationCreateAutomaticTranslation = useAssetsDataSupplementPartialUpdate({
    mutation: {
      onSuccess(response, _variables, _context) {
        if (response.status !== 200) return // just a typeguard, shouldn't happen in `onSuccess`.
        const translationVersion = getLatestAutomaticTranslationVersionItem(response.data, questionXpath, languageCode)
        if (
          translationVersion?._data &&
          'status' in translationVersion?._data &&
          translationVersion?._data.status === 'failed'
        ) {
          notify(translationVersion?._data.error, 'error', {}, translationVersion?._data.error)
        }
      },
      onError: (err) => {
        if (err instanceof ServerError && err.response.status === 402) {
          onLimitExceeded()
        } else {
          notify.error(t('Failed to create automatic translation. Please try again later.'))
        }
      },
    },
  })

  // TODO: HACK-FIX: We should rely on passing Language instead of LanguageCode throughout the single processing view to avoid
  // using the languages hook here, but this involves dealing with time consuming type handling for LanguageSelector.
  // For now, we can rely on react-query's caching to not repeat a call and complete the RegionSelector refactor
  const { data, isLoading: isLoadingLanguages } = useLanguagesRetrieve(languageCode, {
    query: {
      queryKey: getLanguagesRetrieveQueryKey(languageCode),
      enabled: languageCode !== '',
    },
  })
  const language = data?.status === 200 ? data.data : undefined

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
    mutationCreateAF.isPending ||
    mutationPatchAF.isPending ||
    mutationCreateAutomaticTranslation.isPending ||
    isLoadingLanguages

  function handleClickBack() {
    onBack()
  }

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
    } else if (!advancedFeature?.params.find((param) => 'language' in param && param.language === languageCode)) {
      await mutationPatchAF.mutateAsync({
        uidAsset: asset.uid,
        uidAdvancedFeature: advancedFeature.uid,
        data: {
          action: ActionEnum.automatic_google_translation,
          question_xpath: questionXpath,
          params: advancedFeature.params.concat({
            language: languageCode,
          }),
        } as any,
      })
    }

    try {
      await mutationCreateAutomaticTranslation.mutateAsync({
        uidAsset: asset.uid,
        rootUuid: removeDefaultUuidPrefix(submission['meta/rootUuid']),
        data: {
          _version: SUBSEQUENCES_SCHEMA_VERSION,
          [questionXpath]: {
            automatic_google_translation: { language: languageCode },
          },
        },
      })
    } catch {
      // Error is handled by the onError callback above
      return
    }

    onCreate(languageCode, 'automated')
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

      <Flex component='section' direction='row' align='center' justify='center' mb='xl'>
        <Group gap='xs'>
          <TextInput
            readOnly
            value={language?.name || ''}
            leftSection={<KoboIcon icon={IconLanguage} size='sm' />}
            w={220}
            size='sm'
            rightSection={
              <ActionIcon
                disabled={anyPending}
                aria-label={t('Close')}
                variant='transparent'
                size='sm'
                onClick={handleClickBack}
                icon={IconX}
              />
            }
          />
        </Group>
      </Flex>

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

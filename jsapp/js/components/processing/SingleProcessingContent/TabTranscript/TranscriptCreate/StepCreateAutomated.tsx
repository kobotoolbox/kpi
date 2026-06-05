import React, { useState } from 'react'

import { ActionIcon, Flex, Group, TextInput } from '@mantine/core'
import { IconLanguage, IconX } from '@tabler/icons-react'
import cx from 'classnames'
import { ActionEnum } from '#/api/models/actionEnum'
import type { AdvancedFeatureResponse } from '#/api/models/advancedFeatureResponse'
import type { DataResponse } from '#/api/models/dataResponse'
import { getLanguagesRetrieveQueryKey, useLanguagesRetrieve } from '#/api/react-query/other'
import {
  useAssetsAdvancedFeaturesCreate,
  useAssetsAdvancedFeaturesPartialUpdate,
  useAssetsDataSupplementPartialUpdate,
} from '#/api/react-query/survey-data'
import KoboIcon from '#/components/common/KoboIcon'
import Button from '#/components/common/button'
import RegionSelector from '#/components/languages/RegionSelector'
import type { LanguageCode, LocaleCode } from '#/components/languages/languagesStore'
import { getLatestTranscriptVersionItem } from '#/components/processing/common/utils'
import type { AssetResponse } from '#/dataInterface'
import { notify, removeDefaultUuidPrefix } from '#/utils'
import { SUBSEQUENCES_SCHEMA_VERSION } from '../../../common/constants'
import bodyStyles from '../../../common/processingBody.module.scss'

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
  const mutationCreateAutomaticTranscript = useAssetsDataSupplementPartialUpdate({
    mutation: {
      onSuccess(response, _variables, _context) {
        if (response.status !== 200) return // just a typeguard, shouldn't happen in `onSuccess`.
        const transcriptVersion = getLatestTranscriptVersionItem(response.data, questionXpath)
        if (
          transcriptVersion?._data &&
          'status' in transcriptVersion?._data &&
          transcriptVersion?._data.status === 'failed'
        ) {
          notify(transcriptVersion?._data.error, 'error', {}, transcriptVersion?._data.error)
        }
      },
    },
  })

  // TODO: HACK-FIX: We should rely on passing Language instead of LanguageCode throughout the single processing view to avoid
  // using the languages hook here, but this involves dealing with time consuming type handling for LanguageSelector.
  // For now, we can rely on react-query's caching to not repeat a call and complete the RegionSelector refactor
  const { data, isLoading: isLoadingLanguages } = useLanguagesRetrieve(languageCode, {
    query: {
      // Same key as the RegionSelector hook
      queryKey: getLanguagesRetrieveQueryKey(languageCode),
      enabled: languageCode !== '',
    },
  })
  const language = data?.status === 200 ? data.data : undefined

  const anyPending =
    mutationCreateAF.isPending ||
    mutationPatchAF.isPending ||
    mutationCreateAutomaticTranscript.isPending ||
    isLoadingLanguages

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
              >
                <KoboIcon icon={IconX} size='xs' />
              </ActionIcon>
            }
          />

          <RegionSelector
            rootLanguage={languageCode}
            disabled={anyPending}
            serviceCode='goog'
            serviceType='transcription'
            onRegionChange={handleChangeLocale}
            size='sm'
          />
        </Group>
      </Flex>

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
            isDisabled={anyPending || locale === null}
          />
        </div>
      </footer>
    </div>
  )
}

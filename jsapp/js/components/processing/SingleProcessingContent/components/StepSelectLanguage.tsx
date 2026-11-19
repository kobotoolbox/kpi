import React, { useMemo } from 'react'

import { Group, Stack } from '@mantine/core'
import cx from 'classnames'
import type { UsageLimitTypes } from '#/account/stripe.types'
import {
  type OrganizationsServiceUsageSummary,
  useOrganizationsServiceUsageSummary,
} from '#/account/usage/useOrganizationsServiceUsageSummary'
import Button from '#/components/common/button'
import LanguageSelector from '#/components/languages/LanguageSelector'
import RegionSelector from '#/components/languages/RegionSelector'
import type { LanguageCode } from '#/components/languages/languagesStore'
import ConflictingOngoingJobAlert from '#/components/processing/common/ConflictingOngoingJobAlert'
import envStore from '#/envStore'
import bodyStyles from '../../common/processingBody.module.scss'
import { CreateSteps, type TranslationSource } from '../../common/types'
import TransxAutomaticButton from './transxAutomaticButton'

interface Props {
  onBack: () => void
  onNext: (step: CreateSteps.Manual | CreateSteps.Automatic) => void
  onLimitExceeded: () => void
  usageType: UsageLimitTypes
  /** Which automatic service the selected language(s) must be supported by for the "automatic" button. */
  automaticServiceType: 'transcript' | 'translation'
  languageCode: LanguageCode | null
  setLanguageCode: (languageCode: LanguageCode | null) => void
  hiddenLanguages?: LanguageCode[]
  suggestedLanguages: LanguageCode[]
  titleOverride: string
  /** The label for "create manual" button that is being displayed if automatic functionality is not being enabled */
  singleManualButtonLabel: string
  disableManual?: boolean
  disableAutomatic: boolean
  showConflictingOngoingJobAlert?: boolean
  /**
   * The language a text response is written in, asked next to the target language when translating one. Both
   * buttons stay disabled until it's picked. Leave out for a transcript, which carries its own language.
   */
  source?: TranslationSource
  onSourceChange?: (source: TranslationSource) => void
}

export default function StepSelectLanguage({
  onBack,
  onNext,
  onLimitExceeded,
  usageType,
  automaticServiceType,
  languageCode,
  setLanguageCode,
  hiddenLanguages = [],
  suggestedLanguages,
  titleOverride,
  singleManualButtonLabel,
  disableManual = false,
  disableAutomatic,
  showConflictingOngoingJobAlert = false,
  source,
  onSourceChange,
}: Props) {
  const { data: serviceUsageData } = useOrganizationsServiceUsageSummary()
  const usageLimitBlock = useMemo(
    () =>
      serviceUsageData?.status === 200 &&
      serviceUsageData?.data.limitExceedList.includes(usageType) &&
      envStore.data.usage_limit_enforcement,
    [
      (serviceUsageData?.data as OrganizationsServiceUsageSummary)?.limitExceedList,
      envStore.data.usage_limit_enforcement,
      usageType,
    ],
  )

  function handleChangeLanguage(newVal: LanguageCode | null) {
    setLanguageCode(newVal ?? null)
  }

  const isSourceMissing = source !== undefined && !source.languageCode

  const handleClickBack = () => {
    // When clicking "back" we either unselect the language (inner component "back" action) by clearing it,
    // or if no language is selected, we let the parent know (the parent flow "back" action). A text response's source
    // language is kept: it's often pre-selected, and it's the same for every translation of the response.
    if (languageCode !== null) {
      setLanguageCode(null)
    } else {
      onBack()
    }
  }

  function handleChangeSourceLanguage(newLanguageCode: LanguageCode | null) {
    // The dialects belong to the previous language, `RegionSelector` picks one of the new language's
    onSourceChange?.({ languageCode: newLanguageCode, locale: null })
  }

  function handleChangeSourceLocale(newLocale: LanguageCode | null) {
    if (source) onSourceChange?.({ ...source, locale: newLocale })
  }

  function handleClickNextManual() {
    onNext(CreateSteps.Manual)
  }

  function handleClickNextAutomatic() {
    if (usageLimitBlock) {
      onLimitExceeded()
    } else {
      onNext(CreateSteps.Automatic)
    }
  }

  const isAutoEnabled = envStore.data.asr_mt_features_enabled

  return (
    <div className={cx(bodyStyles.root, bodyStyles.stepConfig)}>
      <Stack gap='md'>
        {source && (
          // Language and dialect side by side, like for an automatic transcription
          <Group grow align='flex-end' wrap='nowrap'>
            <LanguageSelector
              titleOverride={t('Please select the language of the text response')}
              onLanguageChange={handleChangeSourceLanguage}
              // Translating into the same language makes no sense
              hiddenLanguages={languageCode ? [languageCode] : []}
              // The selected language only shows when it's an option, and it may not be one of the featured ones
              suggestedLanguages={source.languageCode ? [source.languageCode] : []}
              value={source.languageCode}
              required
            />

            {source.languageCode && (
              <RegionSelector
                // Remount for each language, so its dialects replace the previous ones
                key={source.languageCode}
                rootLanguage={source.languageCode}
                serviceCode='goog'
                serviceType='translation'
                onRegionChange={handleChangeSourceLocale}
                initialRegion={source.locale}
                titleOverride={t('Dialect')}
              />
            )}
          </Group>
        )}

        <LanguageSelector
          titleOverride={titleOverride}
          onLanguageChange={handleChangeLanguage}
          hiddenLanguages={source?.languageCode ? [...hiddenLanguages, source.languageCode] : hiddenLanguages}
          suggestedLanguages={suggestedLanguages}
          value={languageCode}
          required={source !== undefined}
        />
      </Stack>

      {showConflictingOngoingJobAlert && <ConflictingOngoingJobAlert mt='md' />}

      <footer className={bodyStyles.footer}>
        <Button type='text' size='m' label={t('back')} startIcon='caret-left' onClick={handleClickBack} />

        <div className={bodyStyles.footerRightButtons}>
          <Button
            type='secondary'
            size='m'
            label={isAutoEnabled ? t('manual') : singleManualButtonLabel}
            onClick={handleClickNextManual}
            // We disable both manual and automatic entry points for a conflicting
            // job so users do not start edits that could be overwritten.
            isDisabled={languageCode === null || isSourceMissing || disableManual || showConflictingOngoingJobAlert}
          />
          <TransxAutomaticButton
            onClick={handleClickNextAutomatic}
            selectedLanguage={languageCode}
            sourceLanguage={source?.languageCode}
            type={automaticServiceType}
            disabled={isSourceMissing || disableAutomatic || showConflictingOngoingJobAlert}
          />
        </div>
      </footer>
    </div>
  )
}

import React, { useMemo } from 'react'

import { Stack } from '@mantine/core'
import cx from 'classnames'
import type { UsageLimitTypes } from '#/account/stripe.types'
import {
  type OrganizationsServiceUsageSummary,
  useOrganizationsServiceUsageSummary,
} from '#/account/usage/useOrganizationsServiceUsageSummary'
import Button from '#/components/common/button'
import LanguageSelector from '#/components/languages/LanguageSelector'
import type { LanguageCode } from '#/components/languages/languagesStore'
import ConflictingOngoingJobAlert from '#/components/processing/common/ConflictingOngoingJobAlert'
import envStore from '#/envStore'
import bodyStyles from '../../common/processingBody.module.scss'
import { CreateSteps } from '../../common/types'
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
   * The language a text response is written in, asked above the target language when translating one. Both buttons
   * stay disabled until it's picked. Leave out for a transcript, which carries its own language.
   */
  textSource?: {
    languageCode: LanguageCode | null
    onChange: (languageCode: LanguageCode | null) => void
  }
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
  textSource,
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

  const sourceLanguage = textSource?.languageCode ?? null
  const isSourceMissing = textSource !== undefined && !sourceLanguage

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
        {textSource && (
          <LanguageSelector
            titleOverride={t('Please select the language of the text response')}
            onLanguageChange={textSource.onChange}
            // Translating into the same language makes no sense
            hiddenLanguages={languageCode ? [languageCode] : []}
            // The selected language only shows when it's an option, and it may not be one of the featured ones
            suggestedLanguages={sourceLanguage ? [sourceLanguage] : []}
            value={sourceLanguage}
            required
          />
        )}

        <LanguageSelector
          titleOverride={titleOverride}
          onLanguageChange={handleChangeLanguage}
          hiddenLanguages={sourceLanguage ? [...hiddenLanguages, sourceLanguage] : hiddenLanguages}
          suggestedLanguages={suggestedLanguages}
          value={languageCode}
          required={textSource !== undefined}
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
            sourceLanguage={sourceLanguage}
            type={automaticServiceType}
            disabled={isSourceMissing || disableAutomatic || showConflictingOngoingJobAlert}
          />
        </div>
      </footer>
    </div>
  )
}

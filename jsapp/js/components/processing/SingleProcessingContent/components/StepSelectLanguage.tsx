import React, { useMemo, useState } from 'react'

import cx from 'classnames'
import { UsageLimitTypes } from '#/account/stripe.types'
import { useBillingPeriod } from '#/account/usage/useBillingPeriod'
import {
  type OrganizationsServiceUsageSummary,
  useOrganizationsServiceUsageSummary,
} from '#/account/usage/useOrganizationsServiceUsageSummary'
import Button from '#/components/common/button'
import LanguageSelector, { resetAllLanguageSelectors } from '#/components/languages/languageSelector'
import type { LanguageBase, LanguageCode } from '#/components/languages/languagesStore'
import envStore from '#/envStore'
import bodyStyles from '../../common/processingBody.module.scss'
import { CreateSteps } from '../../common/types'
import NlpUsageLimitBlockModal from './nlpUsageLimitBlockModal'
import TransxAutomaticButton from './transxAutomaticButton'

interface Props {
  onBack: () => void
  onNext: (step: CreateSteps.Manual | CreateSteps.Automatic) => void
  languageCode: LanguageCode | null
  setLanguageCode: (languageCode: LanguageCode | null) => void
  hiddenLanguages?: LanguageCode[]
  suggestedLanguages: LanguageCode[]
  titleOverride: string
  /** The label for "create manual" button that is being displayed if automatic functionality is not being enabled */
  singleManualButtonLabel: string
  disableAutomatic: boolean
}

// TODO: BUG we need this to know if the context is transcript or translation, so we can display proper manual button
// label and pass it on to TransxAutomaticButton
export default function StepSelectLanguage({
  onBack,
  onNext,
  languageCode,
  setLanguageCode,
  hiddenLanguages = [],
  suggestedLanguages,
  titleOverride,
  singleManualButtonLabel,
  disableAutomatic,
}: Props) {
  const { data: serviceUsageData } = useOrganizationsServiceUsageSummary()
  const [isLimitBlockModalOpen, setIsLimitBlockModalOpen] = useState<boolean>(false)
  const usageLimitBlock = useMemo(
    () =>
      serviceUsageData?.status === 200 &&
      serviceUsageData?.data.limitExceedList.includes(UsageLimitTypes.TRANSCRIPTION) &&
      envStore.data.usage_limit_enforcement,
    [
      (serviceUsageData?.data as OrganizationsServiceUsageSummary)?.limitExceedList,
      envStore.data.usage_limit_enforcement,
    ],
  )
  const { billingPeriod } = useBillingPeriod()

  function handleDismissModal() {
    setIsLimitBlockModalOpen(false)
  }

  function handleChangeLanguage(newVal: LanguageBase | null) {
    setLanguageCode(newVal?.code ?? null)
  }

  const handleClickBack = () => {
    // When clicking "back" we either unselect the language (inner component "back" action) through a special component
    // function , or if no language is selected, we let the parent know (the parent flow "back" action).
    if (languageCode !== null) {
      resetAllLanguageSelectors()
    } else {
      onBack()
    }
  }

  function handleClickNextManual() {
    onNext(CreateSteps.Manual)
  }

  function handleClickNextAutomatic() {
    if (usageLimitBlock) {
      setIsLimitBlockModalOpen(true)
    } else {
      onNext(CreateSteps.Automatic)
    }
  }

  const isAutoEnabled = envStore.data.asr_mt_features_enabled

  return (
    <div className={cx(bodyStyles.root, bodyStyles.stepConfig)}>
      <LanguageSelector
        titleOverride={titleOverride}
        onLanguageChange={handleChangeLanguage}
        hiddenLanguages={hiddenLanguages}
        suggestedLanguages={suggestedLanguages}
      />

      <footer className={bodyStyles.footer}>
        <Button type='text' size='m' label={t('back')} startIcon='caret-left' onClick={handleClickBack} />

        <div className={bodyStyles.footerRightButtons}>
          <Button
            type='secondary'
            size='m'
            label={isAutoEnabled ? t('manual') : singleManualButtonLabel}
            onClick={handleClickNextManual}
            isDisabled={languageCode === null}
          />
          <TransxAutomaticButton
            onClick={handleClickNextAutomatic}
            selectedLanguage={languageCode}
            type='transcript'
            disabled={disableAutomatic}
          />
          <NlpUsageLimitBlockModal
            isModalOpen={isLimitBlockModalOpen}
            usageType={UsageLimitTypes.TRANSCRIPTION}
            dismissed={handleDismissModal}
            interval={billingPeriod}
          />
        </div>
      </footer>
    </div>
  )
}

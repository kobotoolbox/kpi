import React, { useMemo, useState } from 'react'

import cx from 'classnames'
import { UsageLimitTypes } from '#/account/stripe.types'
import { useBillingPeriod } from '#/account/usage/useBillingPeriod'
import {
  type OrganizationsServiceUsageSummary,
  useOrganizationsServiceUsageSummary,
} from '#/account/usage/useOrganizationsServiceUsageSummary'
import type { DataResponse } from '#/api/models/dataResponse'
import Button from '#/components/common/button'
import LanguageSelector from '#/components/languages/languageSelector'
import type { LanguageBase, LanguageCode } from '#/components/languages/languagesStore'
import type { AnyRowTypeName } from '#/constants'
import type { AssetResponse } from '#/dataInterface'
import envStore from '#/envStore'
import bodyStyles from '../../../common/processingBody.module.scss'
import NlpUsageLimitBlockModal from '../../components/nlpUsageLimitBlockModal'
import TransxAutomaticButton from '../../components/transxAutomaticButton'
import { getProcessedFileLabel, getQuestionName } from '../common/utils'
import { getAttachmentForProcessing } from '../transcript.utils'

interface Props {
  asset: AssetResponse
  questionXpath: string
  onBack: () => void
  onNext: (step: 'manual' | 'automatic') => void
  languageCode: LanguageCode | null
  setLanguageCode: (languageCode: LanguageCode | null) => void
  submission: DataResponse & Record<string, string>
}

export default function StepSelectLanguage({
  asset,
  questionXpath,
  onBack,
  onNext,
  languageCode,
  setLanguageCode,
  submission,
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
    setLanguageCode(null)
    onBack()
  }

  function handleClickNextManual() {
    onNext('manual')
  }

  function handleClickNextAutomatic() {
    if (usageLimitBlock) {
      setIsLimitBlockModalOpen(true)
    } else {
      onNext('automatic')
    }
  }

  const languageSelectorTitle = t('Please select the original language of the ##type##').replace(
    '##type##',
    getProcessedFileLabel(getQuestionName(asset, questionXpath) as AnyRowTypeName), // TODO: potential bug was always here.
  )
  const isAutoEnabled = envStore.data.asr_mt_features_enabled
  const attachment = getAttachmentForProcessing(asset, questionXpath, submission)

  return (
    <div className={cx(bodyStyles.root, bodyStyles.stepConfig)}>
      <LanguageSelector
        titleOverride={languageSelectorTitle}
        onLanguageChange={handleChangeLanguage}
        suggestedLanguages={asset.advanced_features?.transcript?.languages ?? []}
      />

      <footer className={bodyStyles.footer}>
        <Button type='text' size='m' label={t('back')} startIcon='caret-left' onClick={handleClickBack} />

        <div className={bodyStyles.footerRightButtons}>
          <Button
            type='secondary'
            size='m'
            label={isAutoEnabled ? t('manual') : t('transcribe')}
            onClick={handleClickNextManual}
            isDisabled={languageCode === null}
          />
          <TransxAutomaticButton
            onClick={handleClickNextAutomatic}
            selectedLanguage={languageCode}
            type='transcript'
            disabled={typeof attachment === 'string' || attachment.is_deleted}
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

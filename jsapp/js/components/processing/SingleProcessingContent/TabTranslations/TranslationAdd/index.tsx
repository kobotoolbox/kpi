import React, { useEffect, useRef, useState } from 'react'
import { UsageLimitTypes } from '#/account/stripe.types'
import { useBillingPeriod } from '#/account/usage/useBillingPeriod'
import type { AdvancedFeatureResponse } from '#/api/models/advancedFeatureResponse'
import type { BulkActionResponse } from '#/api/models/bulkActionResponse'
import type { DataResponse } from '#/api/models/dataResponse'
import type { DataSupplementResponse } from '#/api/models/dataSupplementResponse'
import type { SupplementalDataVersionItemAutomatic } from '#/api/models/supplementalDataVersionItemAutomatic'
import type { SupplementalDataVersionItemManual } from '#/api/models/supplementalDataVersionItemManual'
import { getLanguagesRetrieveQueryKey, useLanguagesRetrieve } from '#/api/react-query/other'
import type { LanguageCode } from '#/components/languages/languagesStore'
import { isConflictingOngoingJobForSubmission } from '#/components/processing/common/conflictingOngoingJob'
import { CreateSteps } from '#/components/processing/common/types'
import {
  getFormLanguageCode,
  getSavedSourceLanguage,
  getSuggestedLanguages,
} from '#/components/processing/common/utils'
import type { AssetResponse } from '#/dataInterface'
import envStore from '#/envStore'
import { getSubmissionRootUuid } from '#/utils'
import StepSelectLanguage from '../../components/StepSelectLanguage'
import NlpUsageLimitBlockModal from '../../components/nlpUsageLimitBlockModal'
import StepBegin from './StepBegin'
import StepCreateAutomated from './StepCreateAutomated'
import StepCreateManual from './StepCreateManual'

interface Props {
  asset: AssetResponse
  questionXpath: string
  submission: DataResponse
  supplement: DataSupplementResponse
  activeBulkActions: BulkActionResponse[]
  /** Target languages that can't be picked: already translated into, or the transcript's own language. */
  languagesUnavailable: LanguageCode[]
  initialStep?: CreateSteps.Begin | CreateSteps.Language
  translationVersions: Array<SupplementalDataVersionItemManual | SupplementalDataVersionItemAutomatic>
  /** A text response is translated directly, from the language the user picks for it */
  isTextQuestion: boolean
  onCreate: (languageCode: LanguageCode, context: 'automated' | 'manual') => void
  onBack: () => void
  onUnsavedWorkChange: (hasUnsavedWork: boolean) => void
  advancedFeatures: AdvancedFeatureResponse[]
}

export default function TranslationAdd({
  asset,
  questionXpath,
  submission,
  supplement,
  activeBulkActions,
  languagesUnavailable,
  initialStep,
  translationVersions,
  isTextQuestion,
  onCreate,
  onBack,
  onUnsavedWorkChange,
  advancedFeatures,
}: Props) {
  const [step, setStep] = useState<CreateSteps>(initialStep ?? CreateSteps.Begin)
  const [languageCode, setLanguageCode] = useState<null | LanguageCode>(null)
  const [isLimitBlockModalOpen, setIsLimitBlockModalOpen] = useState<boolean>(false)
  const { billingPeriod } = useBillingPeriod()

  // Every translation of a text response comes from the same text, so start from the language picked for an earlier one
  const [sourceLanguage, setSourceLanguage] = useState<LanguageCode | null>(
    () => getSavedSourceLanguage(translationVersions) ?? null,
  )
  const textSourceLanguage = isTextQuestion ? sourceLanguage : null

  // Otherwise the response is likely in the form's language, so pre-select it once we know it's one we have, unless
  // it's already the target language. That happens only once: if the user clears the field afterwards, it stays empty.
  const [formLanguageCode] = useState(() =>
    isTextQuestion && !sourceLanguage ? (getFormLanguageCode(asset) ?? '') : '',
  )
  const { data: formLanguageData } = useLanguagesRetrieve(formLanguageCode, {
    query: { queryKey: getLanguagesRetrieveQueryKey(formLanguageCode), enabled: formLanguageCode !== '' },
  })
  const hasPreselectedFormLanguage = useRef(false)
  useEffect(() => {
    if (hasPreselectedFormLanguage.current || formLanguageData?.status !== 200 || !formLanguageCode) return
    hasPreselectedFormLanguage.current = true
    if (formLanguageCode !== languageCode) setSourceLanguage((current) => current ?? formLanguageCode)
  }, [formLanguageData, formLanguageCode, languageCode])

  // Translation conflicts are language-specific, but only once a target language
  // is selected. Before that we warn about any ongoing job, so users learn about
  // it on this tab too instead of only on the transcript one.
  const hasConflictingOngoingJob = isConflictingOngoingJobForSubmission({
    activeBulkActions,
    actionType: 'translation',
    fieldXpath: questionXpath,
    submissionUuid: getSubmissionRootUuid(submission),
    selectedLanguage: languageCode ?? undefined,
  })

  /**
   * This is for going back from manual/automated to language selector step
   */
  function goBackFromCreateStep() {
    // Clear the selected language when returning to the language selection step
    setLanguageCode(null)
    setStep(CreateSteps.Language)
  }

  /**
   * This is for going back from language selector step to begin or language viewer
   */
  function goBackFromLanguageStep() {
    if (translationVersions.length > 0) {
      // If we already have existing languages, going back from select language step should lead to displaying existing
      // language in 'view' mode
      onBack()
    } else {
      // Otherwise let's display begin step
      setStep(CreateSteps.Begin)
    }
  }

  return (
    <>
      {step === CreateSteps.Begin && (
        <StepBegin
          asset={asset}
          hasConflictingOngoingJob={hasConflictingOngoingJob}
          isTextQuestion={isTextQuestion}
          onNext={() => setStep(CreateSteps.Language)}
        />
      )}
      {step === CreateSteps.Language && (
        <StepSelectLanguage
          onBack={goBackFromLanguageStep}
          onNext={(nextStep: CreateSteps.Manual | CreateSteps.Automatic) => setStep(nextStep)}
          onLimitExceeded={() => setIsLimitBlockModalOpen(true)}
          usageType={UsageLimitTypes.TRANSLATION}
          automaticServiceType='translation'
          hiddenLanguages={languagesUnavailable}
          suggestedLanguages={getSuggestedLanguages(advancedFeatures)}
          languageCode={languageCode}
          setLanguageCode={setLanguageCode}
          titleOverride={t('Please select the language you want to translate to')}
          singleManualButtonLabel={t('translate')}
          disableManual={hasConflictingOngoingJob}
          disableAutomatic={!envStore.data.asr_mt_features_enabled}
          showConflictingOngoingJobAlert={hasConflictingOngoingJob}
          textSource={isTextQuestion ? { languageCode: sourceLanguage, onChange: setSourceLanguage } : undefined}
        />
      )}
      {step === CreateSteps.Manual && !!languageCode && (
        <StepCreateManual
          onBack={goBackFromCreateStep}
          languageCode={languageCode}
          asset={asset}
          questionXpath={questionXpath}
          submission={submission}
          supplement={supplement}
          activeBulkActions={activeBulkActions}
          sourceLanguage={textSourceLanguage}
          onCreate={onCreate}
          onUnsavedWorkChange={onUnsavedWorkChange}
          advancedFeatures={advancedFeatures}
        />
      )}
      {step === CreateSteps.Automatic && !!languageCode && (
        <StepCreateAutomated
          onBack={goBackFromCreateStep}
          onLimitExceeded={() => setIsLimitBlockModalOpen(true)}
          languageCode={languageCode}
          asset={asset}
          questionXpath={questionXpath}
          submission={submission}
          hasConflictingOngoingJob={hasConflictingOngoingJob}
          isTextQuestion={isTextQuestion}
          sourceLanguage={textSourceLanguage}
          onCreate={onCreate}
          advancedFeatures={advancedFeatures}
        />
      )}
      <NlpUsageLimitBlockModal
        isModalOpen={isLimitBlockModalOpen}
        usageType={UsageLimitTypes.TRANSLATION}
        dismissed={() => setIsLimitBlockModalOpen(false)}
        interval={billingPeriod}
      />
    </>
  )
}

import React, { useState } from 'react'
import { UsageLimitTypes } from '#/account/stripe.types'
import { useBillingPeriod } from '#/account/usage/useBillingPeriod'
import type { AdvancedFeatureResponse } from '#/api/models/advancedFeatureResponse'
import type { BulkActionResponse } from '#/api/models/bulkActionResponse'
import type { DataResponse } from '#/api/models/dataResponse'
import type { DataSupplementResponse } from '#/api/models/dataSupplementResponse'
import type { SupplementalDataVersionItemAutomatic } from '#/api/models/supplementalDataVersionItemAutomatic'
import type { SupplementalDataVersionItemManual } from '#/api/models/supplementalDataVersionItemManual'
import type { LanguageCode } from '#/components/languages/languagesStore'
import {
  getSubmissionRootUuid,
  isConflictingOngoingJobForSubmission,
} from '#/components/processing/common/conflictingOngoingJob'
import { CreateSteps } from '#/components/processing/common/types'
import { getSuggestedLanguages } from '#/components/processing/common/utils'
import type { AssetResponse } from '#/dataInterface'
import envStore from '#/envStore'
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
  languagesExisting: LanguageCode[]
  initialStep?: CreateSteps.Begin | CreateSteps.Language
  translationVersions: Array<SupplementalDataVersionItemManual | SupplementalDataVersionItemAutomatic>
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
  languagesExisting,
  initialStep,
  translationVersions,
  onCreate,
  onBack,
  onUnsavedWorkChange,
  advancedFeatures,
}: Props) {
  const [step, setStep] = useState<CreateSteps>(initialStep ?? CreateSteps.Begin)
  const [languageCode, setLanguageCode] = useState<null | LanguageCode>(null)
  const [isLimitBlockModalOpen, setIsLimitBlockModalOpen] = useState<boolean>(false)
  const { billingPeriod } = useBillingPeriod()

  // Translation conflicts are language-specific, so we only evaluate once a
  // target language is selected.
  const hasConflictingOngoingJob =
    languageCode !== null &&
    isConflictingOngoingJobForSubmission({
      activeBulkActions,
      actionType: 'translation',
      fieldXpath: questionXpath,
      submissionUuid: getSubmissionRootUuid(submission),
      selectedLanguage: languageCode,
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
      {step === CreateSteps.Begin && <StepBegin asset={asset} onNext={() => setStep(CreateSteps.Language)} />}
      {step === CreateSteps.Language && (
        <StepSelectLanguage
          onBack={goBackFromLanguageStep}
          onNext={(nextStep: CreateSteps.Manual | CreateSteps.Automatic) => setStep(nextStep)}
          onLimitExceeded={() => setIsLimitBlockModalOpen(true)}
          usageType={UsageLimitTypes.TRANSLATION}
          hiddenLanguages={languagesExisting}
          suggestedLanguages={getSuggestedLanguages(advancedFeatures)}
          languageCode={languageCode}
          setLanguageCode={setLanguageCode}
          titleOverride={t('Please select the language you want to translate to')}
          singleManualButtonLabel={t('translate')}
          disableManual={hasConflictingOngoingJob}
          disableAutomatic={!envStore.data.asr_mt_features_enabled}
          showConflictingOngoingJobAlert={hasConflictingOngoingJob}
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

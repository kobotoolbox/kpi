import React, { useState } from 'react'
import { UsageLimitTypes } from '#/account/stripe.types'
import { useBillingPeriod } from '#/account/usage/useBillingPeriod'
import type { AdvancedFeatureResponse } from '#/api/models/advancedFeatureResponse'
import type { BulkActionResponse } from '#/api/models/bulkActionResponse'
import type { DataResponse } from '#/api/models/dataResponse'
import type { DataSupplementResponse } from '#/api/models/dataSupplementResponse'
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
import { getProcessedFileLabel, getQuestionType } from '../common/utils'
import { getAttachmentForProcessing } from '../transcript.utils'
import StepBegin from './StepBegin'
import StepCreateAutomated from './StepCreateAutomated'
import StepCreateManual from './StepCreateManual'

interface Props {
  asset: AssetResponse
  questionXpath: string
  submission: DataResponse
  activeBulkActions: BulkActionResponse[]
  supplement: DataSupplementResponse
  onUnsavedWorkChange: (hasUnsavedWork: boolean) => void
  advancedFeatures: AdvancedFeatureResponse[]
}

export default function TranscriptCreate({
  asset,
  questionXpath,
  submission,
  activeBulkActions,
  supplement,
  onUnsavedWorkChange,
  advancedFeatures,
}: Props) {
  const [step, setStep] = useState<CreateSteps>(CreateSteps.Begin)
  const [languageCode, setLanguageCode] = useState<null | LanguageCode>(null)
  const [isLimitBlockModalOpen, setIsLimitBlockModalOpen] = useState<boolean>(false)
  const { billingPeriod } = useBillingPeriod()

  const languageSelectorTitle = t('Please select the original language of the ##type##').replace(
    '##type##',
    getProcessedFileLabel(getQuestionType(asset, questionXpath)),
  )

  const hasConflictingOngoingJob =
    languageCode !== null &&
    isConflictingOngoingJobForSubmission({
      activeBulkActions,
      actionType: 'transcript',
      fieldXpath: questionXpath,
      submissionUuid: getSubmissionRootUuid(submission),
      selectedLanguage: languageCode,
    })

  const attachment = getAttachmentForProcessing(questionXpath, submission)

  function goBackToLanguageStep() {
    // Clear the selected language when returning to the language selection step
    setLanguageCode(null)
    setStep(CreateSteps.Language)
  }

  return (
    <>
      {step === CreateSteps.Begin && (
        <StepBegin asset={asset} questionXpath={questionXpath} onNext={() => setStep(CreateSteps.Language)} />
      )}
      {step === CreateSteps.Language && (
        <StepSelectLanguage
          onBack={() => setStep(CreateSteps.Begin)}
          onNext={(selectedStep: CreateSteps.Manual | CreateSteps.Automatic) => setStep(selectedStep)}
          onLimitExceeded={() => setIsLimitBlockModalOpen(true)}
          usageType={UsageLimitTypes.TRANSCRIPTION}
          languageCode={languageCode}
          setLanguageCode={setLanguageCode}
          suggestedLanguages={getSuggestedLanguages(advancedFeatures)}
          titleOverride={languageSelectorTitle}
          singleManualButtonLabel={t('transcribe')}
          disableManual={hasConflictingOngoingJob}
          disableAutomatic={
            !envStore.data.asr_mt_features_enabled || typeof attachment === 'string' || !!attachment.is_deleted
          }
          showConflictingOngoingJobAlert={hasConflictingOngoingJob}
        />
      )}
      {step === CreateSteps.Manual && !!languageCode && (
        <StepCreateManual
          onBack={goBackToLanguageStep}
          languageCode={languageCode}
          asset={asset}
          questionXpath={questionXpath}
          submission={submission}
          supplement={supplement}
          activeBulkActions={activeBulkActions}
          onUnsavedWorkChange={onUnsavedWorkChange}
          advancedFeatures={advancedFeatures}
        />
      )}
      {step === CreateSteps.Automatic && !!languageCode && (
        <StepCreateAutomated
          onBack={goBackToLanguageStep}
          languageCode={languageCode}
          asset={asset}
          questionXpath={questionXpath}
          submission={submission}
          advancedFeatures={advancedFeatures}
        />
      )}
      <NlpUsageLimitBlockModal
        isModalOpen={isLimitBlockModalOpen}
        usageType={UsageLimitTypes.TRANSCRIPTION}
        dismissed={() => setIsLimitBlockModalOpen(false)}
        interval={billingPeriod}
      />
    </>
  )
}

import React, { useMemo, useState } from 'react'
import { UsageLimitTypes } from '#/account/stripe.types'
import { useBillingPeriod } from '#/account/usage/useBillingPeriod'
import type { AdvancedFeatureResponse } from '#/api/models/advancedFeatureResponse'
import type { BulkActionResponse } from '#/api/models/bulkActionResponse'
import type { DataResponse } from '#/api/models/dataResponse'
import type { DataSupplementResponse } from '#/api/models/dataSupplementResponse'
import type { LanguageCode } from '#/components/languages/languagesStore'
import { userCan } from '#/components/permissions/utils'
import { isConflictingOngoingJobForSubmission } from '#/components/processing/common/conflictingOngoingJob'
import { getProcessingQuestionType } from '#/components/processing/common/questionType'
import { CreateSteps } from '#/components/processing/common/types'
import { getSuggestedLanguages, isAudioQuestionType } from '#/components/processing/common/utils'
import { useAudioDurations } from '#/components/submissions/useCalculateAudioDuration.hook'
import type { AssetResponse } from '#/dataInterface'
import envStore from '#/envStore'
import { getSubmissionRootUuid } from '#/utils'
import StepSelectLanguage from '../../components/StepSelectLanguage'
import NlpUsageLimitBlockModal from '../../components/nlpUsageLimitBlockModal'
import { getProcessedFileLabel } from '../common/utils'
import { getAttachmentForProcessing, isAudioTooLongForAutomaticTranscription } from '../transcript.utils'
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

  const questionType = getProcessingQuestionType(asset, questionXpath, submission)
  const processedFileLabel = getProcessedFileLabel(questionType)

  const languageSelectorTitle = t('Please select the original language of the ##type##').replace(
    '##type##',
    processedFileLabel,
  )

  // No `selectedLanguage`: every job on this question rewrites the transcript, so
  // for `transcript` the check ignores the language anyway. Previously this was
  // additionally gated on a language being picked, which kept the "begin" step
  // (where none is picked yet) from ever knowing about a running job.
  const hasConflictingOngoingJob = isConflictingOngoingJobForSubmission({
    activeBulkActions,
    actionType: 'transcript',
    fieldXpath: questionXpath,
    submissionUuid: getSubmissionRootUuid(submission),
  })

  // A string instead of an attachment means there is no file to process.
  const attachmentOrError = getAttachmentForProcessing(questionXpath, submission)
  const attachment = typeof attachmentOrError === 'string' ? undefined : attachmentOrError

  const canStartAutomatic =
    envStore.data.asr_mt_features_enabled &&
    !!attachment &&
    !attachment.is_deleted &&
    userCan('change_submissions', asset)

  // Measuring can cost an `ffprobe` run on the back end, so we ask only when the answer could
  // change what the user may do here. Text questions have no audio to measure at all.
  const uidToMeasure = canStartAutomatic && isAudioQuestionType(questionType) ? attachment?.uid : undefined
  const uidsToMeasure = useMemo(() => (uidToMeasure ? [uidToMeasure] : []), [uidToMeasure])

  const { duration, isLoading: isDurationLoading } = useAudioDurations(uidsToMeasure, asset.uid)

  const isAudioTooLong = isAudioTooLongForAutomaticTranscription(duration)

  // Long audio takes the longest to measure, so a click before the length is known is the very case
  // we are preventing.
  const isMeasuringAudio = !!uidToMeasure && isDurationLoading

  function goBackToLanguageStep() {
    // Clear the selected language when returning to the language selection step
    setLanguageCode(null)
    setStep(CreateSteps.Language)
  }

  return (
    <>
      {step === CreateSteps.Begin && (
        <StepBegin
          asset={asset}
          processedFileLabel={processedFileLabel}
          hasConflictingOngoingJob={hasConflictingOngoingJob}
          onNext={() => setStep(CreateSteps.Language)}
        />
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
          disableAutomatic={!canStartAutomatic || isMeasuringAudio}
          showConflictingOngoingJobAlert={hasConflictingOngoingJob}
          showLongAudioAlert={isAudioTooLong}
          isAutomaticPending={isMeasuringAudio}
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
          hasConflictingOngoingJob={hasConflictingOngoingJob}
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

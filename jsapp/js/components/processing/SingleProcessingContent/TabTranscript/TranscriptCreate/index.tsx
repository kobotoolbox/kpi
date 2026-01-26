import React, { useState } from 'react'
import type { AdvancedFeatureResponse } from '#/api/models/advancedFeatureResponse'
import type { DataResponse } from '#/api/models/dataResponse'
import type { LanguageCode } from '#/components/languages/languagesStore'
import { CreateSteps } from '#/components/processing/common/types'
import type { AssetResponse } from '#/dataInterface'
import envStore from '#/envStore'
import StepSelectLanguage from '../../components/StepSelectLanguage'
import { getProcessedFileLabel, getQuestionType } from '../common/utils'
import { getAttachmentForProcessing } from '../transcript.utils'
import StepBegin from './StepBegin'
import StepCreateAutomated from './StepCreateAutomated'
import StepCreateManual from './StepCreateManual'

interface Props {
  asset: AssetResponse
  questionXpath: string
  submission: DataResponse
  onUnsavedWorkChange: (hasUnsavedWork: boolean) => void
  advancedFeatures: AdvancedFeatureResponse[]
}

export default function TranscriptCreate({
  asset,
  questionXpath,
  submission,
  onUnsavedWorkChange,
  advancedFeatures,
}: Props) {
  const [step, setStep] = useState<CreateSteps>(CreateSteps.Begin)
  const [languageCode, setLanguageCode] = useState<null | LanguageCode>(null)

  const languageSelectorTitle = t('Please select the original language of the ##type##').replace(
    '##type##',
    getProcessedFileLabel(getQuestionType(asset, questionXpath)),
  )
  const attachment = getAttachmentForProcessing(asset, questionXpath, submission)

  return (
    <>
      {step === CreateSteps.Begin && (
        <StepBegin asset={asset} questionXpath={questionXpath} onNext={() => setStep(CreateSteps.Language)} />
      )}
      {step === CreateSteps.Language && (
        <StepSelectLanguage
          onBack={() => setStep(CreateSteps.Begin)}
          onNext={(selectedStep: CreateSteps.Manual | CreateSteps.Automatic) => setStep(selectedStep)}
          languageCode={languageCode}
          setLanguageCode={setLanguageCode}
          suggestedLanguages={asset.advanced_features?.transcript?.languages ?? []}
          titleOverride={languageSelectorTitle}
          disableAutomatic={
            !envStore.data.asr_mt_features_enabled || typeof attachment === 'string' || !!attachment.is_deleted
          }
        />
      )}
      {step === CreateSteps.Manual && !!languageCode && (
        <StepCreateManual
          onBack={() => setStep(CreateSteps.Language)}
          languageCode={languageCode}
          asset={asset}
          questionXpath={questionXpath}
          submission={submission}
          onUnsavedWorkChange={onUnsavedWorkChange}
          advancedFeatures={advancedFeatures}
        />
      )}
      {step === CreateSteps.Automatic && !!languageCode && (
        <StepCreateAutomated
          onBack={() => setStep(CreateSteps.Language)}
          languageCode={languageCode}
          asset={asset}
          questionXpath={questionXpath}
          submission={submission}
          advancedFeatures={advancedFeatures}
        />
      )}
    </>
  )
}

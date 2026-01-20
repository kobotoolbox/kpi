import React, { useState } from 'react'
import type { DataResponse } from '#/api/models/dataResponse'
import type { assetsAdvancedFeaturesListResponse } from '#/api/react-query/survey-data'
import type { LanguageCode } from '#/components/languages/languagesStore'
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
  submission: DataResponse & Record<string, string>
  onUnsavedWorkChange: (hasUnsavedWork: boolean) => void
  advancedFeaturesData: assetsAdvancedFeaturesListResponse | undefined
}

export default function TranscriptCreate({
  asset,
  questionXpath,
  submission,
  onUnsavedWorkChange,
  advancedFeaturesData,
}: Props) {
  const [step, setStep] = useState<'begin' | 'language' | 'manual' | 'automatic'>('begin')
  const [languageCode, setLanguageCode] = useState<null | LanguageCode>(null)

  const languageSelectorTitle = t('Please select the original language of the ##type##').replace(
    '##type##',
    getProcessedFileLabel(getQuestionType(asset, questionXpath)),
  )
  const attachment = getAttachmentForProcessing(asset, questionXpath, submission)

  return (
    <>
      {step === 'begin' && <StepBegin asset={asset} questionXpath={questionXpath} onNext={() => setStep('language')} />}
      {step === 'language' && (
        <StepSelectLanguage
          onBack={() => setStep('begin')}
          onNext={(step: 'manual' | 'automatic') => setStep(step)}
          languageCode={languageCode}
          setLanguageCode={setLanguageCode}
          suggestedLanguages={asset.advanced_features?.transcript?.languages ?? []}
          titleOverride={languageSelectorTitle}
          disableAutomatic={
            !envStore.data.asr_mt_features_enabled || typeof attachment === 'string' || !!attachment.is_deleted
          }
        />
      )}
      {step === 'manual' && !!languageCode && (
        <StepCreateManual
          onBack={() => setStep('language')}
          languageCode={languageCode}
          asset={asset}
          questionXpath={questionXpath}
          submission={submission}
          onUnsavedWorkChange={onUnsavedWorkChange}
          advancedFeaturesData={advancedFeaturesData}
        />
      )}
      {step === 'automatic' && !!languageCode && (
        <StepCreateAutomated
          onBack={() => setStep('language')}
          languageCode={languageCode}
          asset={asset}
          questionXpath={questionXpath}
          submission={submission}
          advancedFeaturesData={advancedFeaturesData}
        />
      )}
    </>
  )
}

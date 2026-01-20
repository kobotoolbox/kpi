import React, { useState } from 'react'
import type { DataResponse } from '#/api/models/dataResponse'
import type { assetsAdvancedFeaturesListResponse } from '#/api/react-query/survey-data'
import type { LanguageCode } from '#/components/languages/languagesStore'
import type { AssetResponse } from '#/dataInterface'
import envStore from '#/envStore'
import StepSelectLanguage from '../../components/StepSelectLanguage'
import StepBegin from './StepBegin'
import StepCreateAutomated from './StepCreateAutomated'
import StepCreateManual from './StepCreateManual'

interface Props {
  asset: AssetResponse
  questionXpath: string
  submission: DataResponse & Record<string, string>
  languagesExisting: LanguageCode[]
  initialStep?: 'begin' | 'language'
  onCreate: (languageCode: LanguageCode) => void
  onUnsavedWorkChange: (hasUnsavedWork: boolean) => void
  advancedFeaturesData: assetsAdvancedFeaturesListResponse | undefined
}

export default function TranslateAdd({
  asset,
  questionXpath,
  submission,
  languagesExisting,
  initialStep,
  onCreate,
  onUnsavedWorkChange,
  advancedFeaturesData,
}: Props) {
  const [step, setStep] = useState<'begin' | 'language' | 'manual' | 'automatic'>(initialStep ?? 'begin')
  const [languageCode, setLanguageCode] = useState<null | LanguageCode>(null)

  return (
    <>
      {step === 'begin' && <StepBegin asset={asset} onNext={() => setStep('language')} />}
      {step === 'language' && (
        <StepSelectLanguage
          onBack={() => setStep('begin')}
          onNext={(step: 'manual' | 'automatic') => setStep(step)}
          hiddenLanguages={languagesExisting}
          suggestedLanguages={asset.advanced_features?.translation?.languages ?? []}
          languageCode={languageCode}
          setLanguageCode={setLanguageCode}
          titleOverride={t('Please select the language you want to translate to')}
          disableAutomatic={!envStore.data.asr_mt_features_enabled}
        />
      )}
      {step === 'manual' && !!languageCode && (
        <StepCreateManual
          onBack={() => setStep('language')}
          languageCode={languageCode}
          asset={asset}
          questionXpath={questionXpath}
          submission={submission}
          onCreate={onCreate}
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
          onCreate={onCreate}
          advancedFeaturesData={advancedFeaturesData}
        />
      )}
    </>
  )
}

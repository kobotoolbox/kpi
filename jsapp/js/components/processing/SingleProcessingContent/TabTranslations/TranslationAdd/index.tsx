import React, { useState } from 'react'
import type { AdvancedFeatureResponse } from '#/api/models/advancedFeatureResponse'
import type { DataResponse } from '#/api/models/dataResponse'
import type { LanguageCode } from '#/components/languages/languagesStore'
import { CreateSteps } from '#/components/processing/common/types'
import type { AssetResponse } from '#/dataInterface'
import envStore from '#/envStore'
import StepSelectLanguage from '../../components/StepSelectLanguage'
import StepBegin from './StepBegin'
import StepCreateAutomated from './StepCreateAutomated'
import StepCreateManual from './StepCreateManual'

interface Props {
  asset: AssetResponse
  questionXpath: string
  submission: DataResponse
  languagesExisting: LanguageCode[]
  initialStep?: CreateSteps.Begin | CreateSteps.Language
  onCreate: (languageCode: LanguageCode) => void
  onUnsavedWorkChange: (hasUnsavedWork: boolean) => void
  advancedFeatures: AdvancedFeatureResponse[]
}

export default function TranslateAdd({
  asset,
  questionXpath,
  submission,
  languagesExisting,
  initialStep,
  onCreate,
  onUnsavedWorkChange,
  advancedFeatures,
}: Props) {
  const [step, setStep] = useState<CreateSteps>(initialStep ?? CreateSteps.Begin)
  const [languageCode, setLanguageCode] = useState<null | LanguageCode>(null)

  function goBackToLanguageStep() {
    // TODO HACKFIX: Because `LanguageSelector` is not a controlled component, the selected language inside of it and
    // the one we have here might become out of sync. Let's ensure we clear it out when re-displaying language step)
    setLanguageCode(null)
    setStep(CreateSteps.Language)
  }

  return (
    <>
      {step === CreateSteps.Begin && <StepBegin asset={asset} onNext={() => setStep(CreateSteps.Language)} />}
      {step === CreateSteps.Language && (
        <StepSelectLanguage
          onBack={() => setStep(CreateSteps.Begin)}
          onNext={(step: CreateSteps.Manual | CreateSteps.Automatic) => setStep(step)}
          hiddenLanguages={languagesExisting}
          suggestedLanguages={asset.advanced_features?.translation?.languages ?? []}
          languageCode={languageCode}
          setLanguageCode={setLanguageCode}
          titleOverride={t('Please select the language you want to translate to')}
          singleManualButtonLabel={t('translate')}
          disableAutomatic={!envStore.data.asr_mt_features_enabled}
        />
      )}
      {step === CreateSteps.Manual && !!languageCode && (
        <StepCreateManual
          onBack={goBackToLanguageStep}
          languageCode={languageCode}
          asset={asset}
          questionXpath={questionXpath}
          submission={submission}
          onCreate={onCreate}
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
          onCreate={onCreate}
          advancedFeatures={advancedFeatures}
        />
      )}
    </>
  )
}

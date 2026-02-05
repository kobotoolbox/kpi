import React, { useState } from 'react'
import type { _DataSupplementResponseOneOfAutomaticGoogleTranslationVersionsItem } from '#/api/models/_dataSupplementResponseOneOfAutomaticGoogleTranslationVersionsItem'
import type { _DataSupplementResponseOneOfManualTranslationVersionsItem } from '#/api/models/_dataSupplementResponseOneOfManualTranslationVersionsItem'
import type { AdvancedFeatureResponse } from '#/api/models/advancedFeatureResponse'
import type { DataResponse } from '#/api/models/dataResponse'
import type { DataSupplementResponse } from '#/api/models/dataSupplementResponse'
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
  supplement: DataSupplementResponse
  languagesExisting: LanguageCode[]
  initialStep?: CreateSteps.Begin | CreateSteps.Language
  translationVersions: Array<
    | _DataSupplementResponseOneOfManualTranslationVersionsItem
    | _DataSupplementResponseOneOfAutomaticGoogleTranslationVersionsItem
  >
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

  /**
   * This is for going back from manual/automated to language selector step
   */
  function goBackFromCreateStep() {
    // TODO HACKFIX: Because `LanguageSelector` is not a controlled component, the selected language inside of it and
    // the one we have here might become out of sync. Let's ensure we clear it out when re-displaying language step)
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
          onBack={goBackFromCreateStep}
          languageCode={languageCode}
          asset={asset}
          questionXpath={questionXpath}
          submission={submission}
          supplement={supplement}
          onCreate={onCreate}
          onUnsavedWorkChange={onUnsavedWorkChange}
          advancedFeatures={advancedFeatures}
        />
      )}
      {step === CreateSteps.Automatic && !!languageCode && (
        <StepCreateAutomated
          onBack={goBackFromCreateStep}
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

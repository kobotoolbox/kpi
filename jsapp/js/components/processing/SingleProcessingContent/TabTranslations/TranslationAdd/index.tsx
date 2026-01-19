import React, { useState } from 'react'

import cx from 'classnames'
import type { DataResponse } from '#/api/models/dataResponse'
import type { LanguageCode } from '#/components/languages/languagesStore'
import singleProcessingStore from '#/components/processing/singleProcessingStore'
import type { AssetResponse } from '#/dataInterface'
import envStore from '#/envStore'
import bodyStyles from '../../../common/processingBody.module.scss'
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
}

export default function TranslateAdd({
  asset,
  questionXpath,
  submission,
  languagesExisting,
  initialStep,
  onCreate,
}: Props) {
  const [step, setStep] = useState<'begin' | 'language' | 'manual' | 'automatic'>(initialStep ?? 'begin')
  const [languageCode, setLanguageCode] = useState<null | LanguageCode>(null)

  return (
    <div className={cx(bodyStyles.root, bodyStyles.stepBegin)}>
      {step === 'begin' && <StepBegin asset={asset} onNext={() => setStep('language')} />}
      {step === 'language' && (
        <StepSelectLanguage
          onBack={() => setStep('begin')}
          onNext={(step: 'manual' | 'automatic') => setStep(step)}
          hiddenLanguages={languagesExisting}
          suggestedLanguages={singleProcessingStore.getAssetTranslatableLanguages()}
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
        />
      )}
    </div>
  )
}

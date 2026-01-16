import React, { useState } from 'react'

import cx from 'classnames'
import type { DataResponse } from '#/api/models/dataResponse'
import type { LanguageCode } from '#/components/languages/languagesStore'
import type { AssetResponse } from '#/dataInterface'
import bodyStyles from '../../../common/processingBody.module.scss'
import StepBegin from './StepBegin'
import StepCreateAutomated from './StepCreateAutomated'
import StepCreateManual from './StepCreateManual'
import StepSelectLanguage from './StepSelectLanguage'

interface Props {
  asset: AssetResponse
  questionXpath: string
  submission: DataResponse & Record<string, string>
}

export default function TranscriptCreate({ asset, questionXpath, submission }: Props) {
  const [step, setStep] = useState<'begin' | 'language' | 'manual' | 'automatic'>('begin')
  const [languageCode, setLanguageCode] = useState<null | LanguageCode>(null)

  console.log('TranscriptCreate', asset, questionXpath, submission)

  return (
    <div className={cx(bodyStyles.root, bodyStyles.stepBegin)}>
      {step === 'begin' && <StepBegin asset={asset} questionXpath={questionXpath} onNext={() => setStep('language')} />}
      {step === 'language' && (
        <StepSelectLanguage
          onBack={() => setStep('begin')}
          onNext={(step: 'manual' | 'automatic') => setStep(step)}
          languageCode={languageCode}
          setLanguageCode={setLanguageCode}
          asset={asset}
          questionXpath={questionXpath}
          submission={submission}
        />
      )}
      {step === 'manual' && !!languageCode && (
        <StepCreateManual
          onBack={() => setStep('language')}
          languageCode={languageCode}
          asset={asset}
          questionXpath={questionXpath}
          submission={submission} />
      )}
      {step === 'automatic' && !!languageCode && (
        <StepCreateAutomated
          onBack={() => setStep('language')}
          languageCode={languageCode}
          asset={asset}
          questionXpath={questionXpath}
          submission={submission}
        />
      )}
    </div>
  )
}

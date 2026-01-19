import React, { useState } from 'react'

import cx from 'classnames'
import type { DataResponse } from '#/api/models/dataResponse'
import type { LanguageCode } from '#/components/languages/languagesStore'
import type { AssetResponse } from '#/dataInterface'
import envStore from '#/envStore'
import bodyStyles from '../../../common/processingBody.module.scss'
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
}

export default function TranscriptCreate({ asset, questionXpath, submission }: Props) {
  const [step, setStep] = useState<'begin' | 'language' | 'manual' | 'automatic'>('begin')
  const [languageCode, setLanguageCode] = useState<null | LanguageCode>(null)

  const languageSelectorTitle = t('Please select the original language of the ##type##').replace(
    '##type##',
    getProcessedFileLabel(getQuestionType(asset, questionXpath)),
  )
  const attachment = getAttachmentForProcessing(asset, questionXpath, submission)

  return (
    <div className={cx(bodyStyles.root, bodyStyles.stepBegin)}>
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
        />
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

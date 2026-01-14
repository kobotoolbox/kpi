import React from 'react'

import cx from 'classnames'
import type { DataResponse } from '#/api/models/dataResponse'
import type { LanguageCode } from '#/components/languages/languagesStore'
import type { AssetResponse } from '#/dataInterface'
import bodyStyles from '../../../common/processingBody.module.scss'

interface Props {
  asset: AssetResponse
  questionXpath: string
  languageCode: LanguageCode
  submission: DataResponse & Record<string, string>
  onBack: () => void
}

/**
 * TODO: wrap Editor and display it.
 */

export default function StepCreateManual({}: Props) {
  return <div className={cx(bodyStyles.root, bodyStyles.stepConfig)}>TODO</div>
}

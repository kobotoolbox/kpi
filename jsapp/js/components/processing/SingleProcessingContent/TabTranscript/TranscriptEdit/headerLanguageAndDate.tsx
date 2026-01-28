import React from 'react'

import type { DataSupplementResponse } from '#/api/models/dataSupplementResponse'
import { AsyncLanguageDisplayLabel } from '#/components/languages/languagesUtils'
import type { TranscriptVersionItem } from '#/components/processing/common/types'
import bodyStyles from '../../../common/processingBody.module.scss'
import TransxDate from '../../components/transxDate'

interface Props {
  transcriptVersion: TranscriptVersionItem
  supplement: DataSupplementResponse
  xpath: string
}

/** We have this as separate component, because we use it in two places. */
export default function HeaderLanguageAndDate({ transcriptVersion, supplement, xpath }: Props) {
  const valueLanguageCode = transcriptVersion._data.language

  return (
    <>
      <label className={bodyStyles.transxHeaderLanguage}>
        <AsyncLanguageDisplayLabel code={valueLanguageCode} />
      </label>
      <TransxDate transxVersion={transcriptVersion} supplement={supplement} xpath={xpath} />
    </>
  )
}

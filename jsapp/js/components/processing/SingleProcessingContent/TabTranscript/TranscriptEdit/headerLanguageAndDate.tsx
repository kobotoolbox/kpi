import React from 'react'

import { AsyncLanguageDisplayLabel } from '#/components/languages/languagesUtils'
import type { TranscriptVersionItem } from '#/components/processing/common/types'
import bodyStyles from '../../../common/processingBody.module.scss'
import TransxDate from '../../components/transxDate'

interface Props {
  transcriptVersion: TranscriptVersionItem
}

/** We have this as separate component, because we use it in two places. */
export default function HeaderLanguageAndDate({ transcriptVersion }: Props) {
  const valueLanguageCode = transcriptVersion._data.language

  return (
    <>
      <label className={bodyStyles.transxHeaderLanguage}>
        <AsyncLanguageDisplayLabel code={valueLanguageCode} />
      </label>
      {/* Note: there is no `_dateModified` here, because modifying through API is just creating a new version */}
      {transcriptVersion._dateCreated !== '' && <TransxDate dateCreated={transcriptVersion._dateCreated} />}
    </>
  )
}

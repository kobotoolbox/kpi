import React from 'react'

import type { _DataSupplementResponseOneOfOneOfAutomaticGoogleTranscriptionVersionsItem } from '#/api/models/_dataSupplementResponseOneOfOneOfAutomaticGoogleTranscriptionVersionsItem'
import type { _DataSupplementResponseOneOfOneOfManualTranscriptionVersionsItem } from '#/api/models/_dataSupplementResponseOneOfOneOfManualTranscriptionVersionsItem'
import { AsyncLanguageDisplayLabel } from '#/components/languages/languagesUtils'
import bodyStyles from '../../../common/processingBody.module.scss'
import TransxDate from '../../components/transxDate'

interface Props {
  transcriptVersion:
    | _DataSupplementResponseOneOfOneOfManualTranscriptionVersionsItem
    | _DataSupplementResponseOneOfOneOfAutomaticGoogleTranscriptionVersionsItem
}

/** We have this as separate component, because we use it in two places. */
export default function HeaderLanguageAndDate({ transcriptVersion }: Props) {
  const valueLanguageCode = transcriptVersion._data.language

  return (
    <React.Fragment>
      <label className={bodyStyles.transxHeaderLanguage}>
        <AsyncLanguageDisplayLabel code={valueLanguageCode} />
      </label>
      <TransxDate
        dateCreated={transcriptVersion._dateCreated}
        dateModified={(transcriptVersion as any)._dateModified}
      />{' '}
      {/* TODO OpenAPI: add _dateModified */}
    </React.Fragment>
  )
}

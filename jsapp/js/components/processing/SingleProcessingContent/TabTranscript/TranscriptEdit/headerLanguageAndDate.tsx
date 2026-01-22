import React from 'react'

import type { _DataSupplementResponseOneOfAutomaticGoogleTranscriptionVersionsItem } from '#/api/models/_dataSupplementResponseOneOfAutomaticGoogleTranscriptionVersionsItem'
import type { _DataSupplementResponseOneOfManualTranscriptionVersionsItem } from '#/api/models/_dataSupplementResponseOneOfManualTranscriptionVersionsItem'
import { AsyncLanguageDisplayLabel } from '#/components/languages/languagesUtils'
import bodyStyles from '../../../common/processingBody.module.scss'
import TransxDate from '../../components/transxDate'

interface Props {
  transcriptVersion:
    | _DataSupplementResponseOneOfManualTranscriptionVersionsItem
    | _DataSupplementResponseOneOfAutomaticGoogleTranscriptionVersionsItem
}

/** We have this as separate component, because we use it in two places. */
export default function HeaderLanguageAndDate({ transcriptVersion }: Props) {
  const valueLanguageCode = transcriptVersion._data.language

  return (
    <React.Fragment>
      <label className={bodyStyles.transxHeaderLanguage}>
        {/*
        TODO: BUG sometimes when switching between submissions (through the SelectSubmission component), we end up with
        wrong label being displayed (e.g. "Bangla (en)" or "English (bn)" - mixing 2 letter code with wrong name)
        */}
        <AsyncLanguageDisplayLabel code={valueLanguageCode} />
      </label>
      {/* Note: there is no `_dateModified` here, because modifying through API is just creating a new version */}
      {transcriptVersion._dateCreated !== '' && <TransxDate dateCreated={transcriptVersion._dateCreated} />}
    </React.Fragment>
  )
}

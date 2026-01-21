import React from 'react'

import type { _DataSupplementResponseOneOfAutomaticGoogleTranscriptionVersionsItem } from '#/api/models/_dataSupplementResponseOneOfAutomaticGoogleTranscriptionVersionsItem'
import type { _DataSupplementResponseOneOfAutomaticGoogleTranslationVersionsItem } from '#/api/models/_dataSupplementResponseOneOfAutomaticGoogleTranslationVersionsItem'
import type { _DataSupplementResponseOneOfManualTranscriptionVersionsItem } from '#/api/models/_dataSupplementResponseOneOfManualTranscriptionVersionsItem'
import type { _DataSupplementResponseOneOfManualTranslationVersionsItem } from '#/api/models/_dataSupplementResponseOneOfManualTranslationVersionsItem'
import { AsyncLanguageDisplayLabel } from '#/components/languages/languagesUtils'
import TransxDate from '../SingleProcessingContent/components/transxDate'
import bodyStyles from '../common/processingBody.module.scss'
import styles from './transxDisplay.module.scss'

interface TransxDisplayProps {
  supplementVersion:
    | _DataSupplementResponseOneOfAutomaticGoogleTranscriptionVersionsItem
    | _DataSupplementResponseOneOfManualTranscriptionVersionsItem
    | _DataSupplementResponseOneOfManualTranslationVersionsItem
    | _DataSupplementResponseOneOfAutomaticGoogleTranslationVersionsItem
}

export default function TransxDisplay({ supplementVersion }: TransxDisplayProps) {
  return (
    <section className={styles.root}>
      <div className={bodyStyles.root}>
        <header className={bodyStyles.transxHeader}>
          {supplementVersion._data.language && (
            <React.Fragment>
              <AsyncLanguageDisplayLabel code={supplementVersion._data.language} />
              <TransxDate
                dateCreated={supplementVersion._dateCreated}
                dateModified={(supplementVersion as any)._dateModified}
              />
              {/* // TODO OpenAPI: add _dateModified */}
            </React.Fragment>
          )}
        </header>

        <article className={bodyStyles.text} dir='auto'>
          {'value' in supplementVersion._data ? supplementVersion._data.value : null}
        </article>
      </div>
    </section>
  )
}

import React from 'react'

import { AsyncLanguageDisplayLabel } from '#/components/languages/languagesUtils'
import TransxDate from '../SingleProcessingContent/components/transxDate'
import bodyStyles from '../common/processingBody.module.scss'
import type { TranscriptDataWithValue, TranscriptVersionItem } from '../common/types'
import styles from './transxDisplay.module.scss'

interface TransxDisplayProps {
  transxVersionItem: TranscriptVersionItem
}

export default function TransxDisplay({ transxVersionItem }: TransxDisplayProps) {
  const { language, value } = transxVersionItem._data as TranscriptDataWithValue

  return (
    <section className={styles.root}>
      <div className={bodyStyles.root}>
        <header className={bodyStyles.transxHeader}>
          {language && (
            <>
              <AsyncLanguageDisplayLabel code={language} />
              <TransxDate
                dateCreated={transxVersionItem._dateCreated}
                dateModified={(transxVersionItem as any)._dateModified}
              />
              {/* // TODO OpenAPI: add _dateModified */}
            </>
          )}
        </header>

        <article className={bodyStyles.text} dir='auto'>
          {value}
        </article>
      </div>
    </section>
  )
}

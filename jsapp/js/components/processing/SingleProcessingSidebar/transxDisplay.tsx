import React from 'react'

import { AsyncLanguageDisplayLabel } from '#/components/languages/languagesUtils'
import TransxDate from '../SingleProcessingContent/components/transxDate'
import bodyStyles from '../common/processingBody.module.scss'
import type { TranscriptVersionItemWithValue, TransxVersionItem } from '../common/types'
import styles from './transxDisplay.module.scss'

interface TransxDisplayProps {
  transxVersionItem: TransxVersionItem
}

export default function TransxDisplay({ transxVersionItem }: TransxDisplayProps) {
  const { language, value } = transxVersionItem._data as TranscriptVersionItemWithValue

  return (
    <section className={styles.root}>
      <div className={bodyStyles.root}>
        <header className={bodyStyles.transxHeader}>
          {language && (
            <>
              <AsyncLanguageDisplayLabel code={language} />
              <TransxDate dateCreated={transxVersionItem._dateCreated} />
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

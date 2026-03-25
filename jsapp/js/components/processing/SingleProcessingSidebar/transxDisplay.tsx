import React from 'react'

import type { DataSupplementResponse } from '#/api/models/dataSupplementResponse'
import { AsyncLanguageDisplayLabel } from '#/components/languages/languagesUtils'
import TransxDate from '../SingleProcessingContent/components/transxDate'
import bodyStyles from '../common/processingBody.module.scss'
import type { TranscriptVersionItemWithValue, TransxVersionItem } from '../common/types'
import styles from './transxDisplay.module.scss'

interface TransxDisplayProps {
  transxVersion: TransxVersionItem
  supplement: DataSupplementResponse
  xpath: string
}

export default function TransxDisplay({ transxVersion, supplement, xpath }: TransxDisplayProps) {
  const { language, value } = transxVersion._data as TranscriptVersionItemWithValue

  return (
    <section className={styles.root}>
      <div className={bodyStyles.root}>
        <header className={bodyStyles.transxHeader}>
          {language && (
            <>
              <AsyncLanguageDisplayLabel code={language} />
              <TransxDate transxVersion={transxVersion} supplement={supplement} xpath={xpath} />
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

import React, { useCallback } from 'react'

import { AsyncLanguageDisplayLabel } from '#/components/languages/languagesUtils'
import type { Transx } from '#/components/processing/singleProcessingStore'
import TransxDate from '#/components/processing/transxDate.component'
import bodyStyles from '../processingBody.module.scss'
import styles from './transxDisplay.module.scss'

interface TransxDisplayProps {
  transx: Transx
}

export default function TransxDisplay(props: TransxDisplayProps) {
  const renderLanguageAndDate = useCallback(() => {
    const source = props.transx

    const contentLanguageCode = source?.languageCode
    if (contentLanguageCode === undefined) {
      return null
    }

    return (
      <React.Fragment>
        <AsyncLanguageDisplayLabel code={props.transx.languageCode} />

        <TransxDate dateCreated={source.dateCreated} dateModified={source.dateModified} />
      </React.Fragment>
    )
  }, [])

  return (
    <section className={styles.root}>
      <div className={bodyStyles.root}>
        <header className={bodyStyles.transxHeader}>{renderLanguageAndDate()}</header>

        <article className={bodyStyles.text} dir='auto'>
          {props.transx.value}
        </article>
      </div>
    </section>
  )
}

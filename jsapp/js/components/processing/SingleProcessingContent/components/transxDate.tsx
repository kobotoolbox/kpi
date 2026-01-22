import React from 'react'

import cx from 'classnames'
import { formatTime, formatTimeDateShort } from '#/utils'
import styles from './transxDate.module.scss'

/**
 * Returns a human friendly date. Returns empty string if there is no sufficient
 * data provided.
 */
function getTransxDate(dateCreated: string): {
  long: string
  short: string
} {
  return {
    long: formatTime(dateCreated),
    short: formatTimeDateShort(dateCreated),
  }
}

interface TransxDateProps {
  dateCreated: string
}

export default function TransxDate({ dateCreated }: TransxDateProps) {
  const dateText = getTransxDate(dateCreated)

  return (
    <>
      {dateText.long !== '' && <time className={cx(styles.transxDate, styles.transxDateLong)}>{dateText.long}</time>}
      {dateText.short !== '' && <time className={cx(styles.transxDate, styles.transxDateShort)}>{dateText.short}</time>}
    </>
  )
}

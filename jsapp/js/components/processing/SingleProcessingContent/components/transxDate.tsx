import React, { useMemo } from 'react'

import cx from 'classnames'
import type { DataSupplementResponse } from '#/api/models/dataSupplementResponse'
import { formatTime, formatTimeDateShort } from '#/utils'
import type { TransxVersionItem } from '../../common/types'
import {
  getAllTranscriptVersions,
  getAllTranslationVersionsForLanguage,
  isVersionItemTranscript,
  isVersionItemTranslation,
} from '../../common/utils'
import styles from './transxDate.module.scss'

interface TransxDateProps {
  transxVersion: TransxVersionItem
  supplement: DataSupplementResponse
  xpath: string
}

export default function TransxDate({ transxVersion, supplement, xpath }: TransxDateProps) {
  // When drafting manual transx, there is no date to be shown
  if (transxVersion._dateCreated === '') {
    return null
  }

  // Note: we don't use any `_dateModified` here, because modifying through API is just creating a new version
  const shortDate = formatTimeDateShort(transxVersion._dateAccepted ?? transxVersion._dateCreated)
  const longDateRaw = formatTime(transxVersion._dateAccepted ?? transxVersion._dateCreated)

  const longDate = useMemo(() => {
    // Step 1. if transxVersion is an unaccepted automated one, show "generated".
    // This works because `status` exist only on items that are automated
    if (!transxVersion._dateAccepted && 'status' in transxVersion._data) {
      return t('generated ##date##').replace('##date##', longDateRaw)
    }

    // Step 2. detect if transxVersion is transcript or translation (we check both, as TransxVersionItem includes qual)
    const isTranscript = isVersionItemTranscript(supplement, xpath, transxVersion)
    const isTranslation = isVersionItemTranslation(supplement, xpath, transxVersion)

    // Step 3. get all versions from the context of transxVersion (either all transcripts, or all translations for given
    // language). We did it this way, because the next steps will be the same for transcript and translation.
    let allVersions: TransxVersionItem[] = []
    if (isTranscript) {
      allVersions = getAllTranscriptVersions(supplement, xpath)
    }
    if (isTranslation && 'language' in transxVersion._data) {
      allVersions = getAllTranslationVersionsForLanguage(supplement, xpath, transxVersion._data.language)
    }

    // Step 4. get one previous version that exists before current version
    const currentVersionIndex = allVersions.findIndex((item) => item._uuid === transxVersion._uuid)
    const onePreviousVersion =
      currentVersionIndex !== -1 && currentVersionIndex < allVersions.length - 1
        ? allVersions[currentVersionIndex + 1]
        : undefined

    // Step 5. determine if previous version exists and had in fact some value that got modified
    if (onePreviousVersion && 'value' in onePreviousVersion._data && onePreviousVersion._data.value !== null) {
      return t('last modified ##date##').replace('##date##', longDateRaw)
    } else {
      return t('created ##date##').replace('##date##', longDateRaw)
    }
  }, [transxVersion, supplement, xpath])

  // We render two dates, because CSS is hiding one or the other based on viewport size
  return (
    <>
      {longDate !== '' && <time className={cx(styles.transxDate, styles.transxDateLong)}>{longDate}</time>}
      {shortDate !== '' && <time className={cx(styles.transxDate, styles.transxDateShort)}>{shortDate}</time>}
    </>
  )
}

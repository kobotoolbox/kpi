import React, { useEffect, useState } from 'react'

import { useQuery } from '@tanstack/react-query'
import cx from 'classnames'
import type { DataResponse } from '#/api/models/dataResponse'
import { getAssetsDataSupplementRetrieveQueryOptions } from '#/api/react-query/survey-data'
import LoadingSpinner from '#/components/common/loadingSpinner'
import type { AssetResponse } from '#/dataInterface'
import { getAudioDuration } from '#/utils'
import bodyStyles from '../../../common/processingBody.module.scss'
import { getAttachmentForProcessing, secondsToTranscriptionEstimate } from '../transcript.utils'

/** Until the estimate is loaded we display dot dot dot. */
const NO_ESTIMATED_MINUTES = '…'

interface Props {
  asset: AssetResponse
  questionXpath: string
  submission: DataResponse
}

export default function AutomaticTranscriptionInProgress({ asset, questionXpath, submission }: Props) {
  const [estimate, setEstimate] = useState<string>(NO_ESTIMATED_MINUTES)

  console.log('AutomaticTranscriptionInProgress render')

  const querySupplement = useQuery(getAssetsDataSupplementRetrieveQueryOptions(asset.uid, submission._uuid))

  // Poll for transcription status every 3 seconds
  useEffect(() => {
    let timeoutId: NodeJS.Timeout

    const pollTranscriptionStatus = () => {
      querySupplement.refetch()
      timeoutId = setTimeout(pollTranscriptionStatus, 3000)
    }

    // Start the first poll
    timeoutId = setTimeout(pollTranscriptionStatus, 3000)

    return () => {
      clearTimeout(timeoutId)
    }
  }, [querySupplement])

  useEffect(() => {
    const attachment = getAttachmentForProcessing(asset, questionXpath, submission)
    if (typeof attachment !== 'string') {
      getAudioDuration(attachment.download_url).then((length: number) => {
        setEstimate(secondsToTranscriptionEstimate(length))
      })
    }
  }, [asset, questionXpath, submission])

  return (
    <div className={cx(bodyStyles.root, bodyStyles.stepConfig)}>
      <LoadingSpinner type='big' message={false} />

      <header className={bodyStyles.header}>{t('Automatic transcription in progress')}</header>

      <p>{t('Estimated time for completion: ##estimate##').replace('##estimate##', estimate)}</p>
    </div>
  )
}

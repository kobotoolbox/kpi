import cx from 'classnames'
import React, { useEffect, useState } from 'react'
import type { DataResponse } from '#/api/models/dataResponse'
import { queryClient } from '#/api/queryClient'
import {
  getAssetsAdvancedFeaturesCreateMutationOptions,
  getAssetsDataSupplementPartialUpdateMutationOptions,
  getAssetsDataSupplementRetrieveQueryKey,
  getAssetsPairedDataPartialUpdateMutationOptions,
  useAssetsDataSupplementRetrieve,
} from '#/api/react-query/survey-data'
import LoadingSpinner from '#/components/common/loadingSpinner'
import type { AssetResponse } from '#/dataInterface'
import { getAudioDuration, removeDefaultUuidPrefix } from '#/utils'
import bodyStyles from '../../common/processingBody.module.scss'
import { getAttachmentForProcessing, secondsToTranscriptionEstimate } from './transcript.utils'

/** Until the estimate is loaded we display dot dot dot. */
const NO_ESTIMATED_MINUTES = '…'
const POLL_INTERVAL = 3000

interface Props {
  asset: AssetResponse
  questionXpath: string
  submission: DataResponse
}

export default function AutomaticTranscriptionInProgress({ asset, questionXpath, submission }: Props) {
  const [estimate, setEstimate] = useState<string>(NO_ESTIMATED_MINUTES)

  const mutationPending =
    queryClient.isMutating({ mutationKey: getAssetsAdvancedFeaturesCreateMutationOptions().mutationKey! }) > 0 ||
    queryClient.isMutating({ mutationKey: getAssetsPairedDataPartialUpdateMutationOptions().mutationKey! }) > 0 ||
    queryClient.isMutating({ mutationKey: getAssetsDataSupplementPartialUpdateMutationOptions().mutationKey! }) > 0

  console.log('mutationPending', mutationPending)

  // Don't race mutations, mutation response will Directly Update this.
  const querySupplement = useAssetsDataSupplementRetrieve(
    asset.uid,
    removeDefaultUuidPrefix(submission['meta/rootUuid']),
    {
      query: {
        queryKey: getAssetsDataSupplementRetrieveQueryKey(
          asset.uid,
          removeDefaultUuidPrefix(submission['meta/rootUuid']),
        ),
        staleTime: Number.POSITIVE_INFINITY,
        enabled: !mutationPending,
      },
    },
  )

  useEffect(() => {
    if (mutationPending) return // Start polling only after the initial mutation(s) are done.
    let timeoutId: NodeJS.Timeout

    const pollTranscriptionStatus = () => {
      querySupplement.refetch()
      timeoutId = setTimeout(pollTranscriptionStatus, POLL_INTERVAL)
    }

    // Start the first poll
    // TODO: smarter time based on _dateCreated and estimate
    timeoutId = setTimeout(pollTranscriptionStatus, POLL_INTERVAL)

    return () => {
      clearTimeout(timeoutId)
    }
  }, [querySupplement, mutationPending])

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

import { Loader } from '@mantine/core'
import React from 'react'
import type { DataResponse } from '#/api/models/dataResponse'
import {
  type assetsDataListResponse,
  getAssetsDataListQueryKey,
  useAssetsDataList,
} from '#/api/react-query/survey-data'
import Button from '#/components/common/button'
import { goToProcessing } from '#/components/processing/routes.utils'
import styles from './index.module.scss'

const selectNeighborResults = (data: assetsDataListResponse) => {
  if (data.status !== 200) return
  if (!data.data.results.length) return
  return {
    submission: data.data.results[0],
    count: data.data.count,
  }
}

interface Props {
  submission?: DataResponse
  assetUid: string
  xpath: string
}

/**
 * Component with the current question label and the UI for switching between
 * submissions and questions. It also has means of leaving Single Processing
 * via "DONE" button.
 */
export default function SelectSubmission({ assetUid, submission, xpath }: Props) {
  if (!submission) return

  // Because submission times are only accurate to the second,_id
  // is the only easy way to figure out where a submission is on
  // an intuitively ordered list of submissions. If we decide to stop using
  // _id, we will need to consult with backend team for other solutions
  function getNeighborParams(id: number, direction: 'next' | 'prev') {
    const isNext = direction === 'next' // Next = Older (Down)
    const op = isNext ? '$lt' : '$gt'
    const sortDir = isNext ? -1 : 1

    return {
      limit: 1,
      start: 0,
      query: JSON.stringify({
        _id: { [op]: id },
      }),
      sort: JSON.stringify({ _id: sortDir }),
    }
  }

  const nextParams = getNeighborParams(submission._id, 'next')
  const queryNext = useAssetsDataList(assetUid, nextParams, {
    query: {
      queryKey: getAssetsDataListQueryKey(assetUid, nextParams),
      enabled: !!assetUid,
      select: selectNeighborResults,
    },
  })

  const prevParams = getNeighborParams(submission._id, 'prev')
  const queryPrev = useAssetsDataList(assetUid, prevParams, {
    query: {
      queryKey: getAssetsDataListQueryKey(assetUid, prevParams),
      enabled: !!assetUid,
      select: selectNeighborResults,
    },
  })

  const prevCount = queryPrev.data?.count ?? 0
  const nextCount = queryNext.data?.count ?? 0
  const count = prevCount + nextCount + 1

  const goPrev = () => {
    if (!queryPrev.data) return
    goToProcessing(assetUid, xpath, queryPrev.data.submission['meta/rootUuid'], true)
  }

  const goNext = () => {
    if (!queryNext.data) return
    goToProcessing(assetUid, xpath, queryNext.data.submission['meta/rootUuid'], true)
  }

  const isLoading = queryPrev.isPending || queryNext.isPending

  return (
    <section className={styles.column}>
      <nav className={styles.submissions}>
        <div className={styles.countContainer}>
          {isLoading ? (
            <Loader />
          ) : (
            <div className={styles.count}>
              <strong>
                {t('Item')}
                &nbsp;
                {prevCount + 1}
              </strong>
              &nbsp;
              {t('of ##total_count##').replace('##total_count##', String(count))}
            </div>
          )}
        </div>

        <Button
          type='text'
          size='s'
          startIcon='arrow-up'
          onClick={goPrev}
          isDisabled={!queryPrev.data?.submission || isLoading}
        />

        <Button
          type='text'
          size='s'
          endIcon='arrow-down'
          onClick={goNext}
          isDisabled={!queryNext.data?.submission || isLoading}
        />
      </nav>
    </section>
  )
}

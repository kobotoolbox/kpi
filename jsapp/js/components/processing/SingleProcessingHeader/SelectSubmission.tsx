import { Loader } from '@mantine/core'
import React, { useCallback } from 'react'
import type { DataResponse } from '#/api/models/dataResponse'
import {
  type assetsDataListResponse,
  getAssetsDataListQueryKey,
  useAssetsDataList,
} from '#/api/react-query/survey-data'
import Button from '#/components/common/button'
import { goToProcessing } from '#/components/processing/routes.utils'
import { addDefaultUuidPrefix } from '#/utils'
import styles from './index.module.scss'

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

  function getNeighborParams(uid: string, time: string, direction: 'next' | 'prev') {
    const isNext = direction === 'next'
    const formattedUiD = addDefaultUuidPrefix(uid)
    const op = isNext ? '$lt' : '$gt'
    const sortDir = isNext ? -1 : 1

    return {
      limit: 1,
      start: 0,
      query: JSON.stringify({
        $or: [
          { _submission_time: { [op]: time } },
          {
            $and: [
              { _submission_time: time },
              {
                $expr: {
                  [op]: [{ $ifNull: ['$meta/rootUuid', '$meta/instanceID'] }, formattedUiD],
                },
              },
            ],
          },
        ],
      }),
      sort: JSON.stringify({
        _submission_time: sortDir,
        _uuid: sortDir,
      }),
    }
  }

  function getNeighborResults(data: assetsDataListResponse) {
    if (data.status !== 200) return
    if (!data.data.results.length) return
    return {
      submission: data.data.results[0],
      count: data.data.count,
    }
  }

  const { _uuid, _submission_time } = submission

  const nextParams = getNeighborParams(_uuid, _submission_time, 'next')
  const queryNext = useAssetsDataList(assetUid!, nextParams, {
    query: {
      queryKey: getAssetsDataListQueryKey(assetUid, nextParams),
      enabled: !!assetUid,
      select: useCallback(getNeighborResults, [_uuid, _submission_time]),
    },
  })

  const prevParams = getNeighborParams(_uuid, _submission_time, 'prev')
  const queryPrev = useAssetsDataList(assetUid!, prevParams, {
    query: {
      queryKey: getAssetsDataListQueryKey(assetUid, prevParams),
      enabled: !!assetUid,
      select: useCallback(getNeighborResults, [_uuid, _submission_time]),
    },
  })

  const prevCount = queryPrev.data?.count ?? 0
  const nextCount = queryNext.data?.count ?? 0
  const count = prevCount + nextCount + 1

  const goPrev = () => {
    if (!queryPrev.data) return
    goToProcessing(assetUid, xpath, queryPrev.data.submission._uuid, true)
  }

  const goNext = () => {
    if (!queryNext.data) return
    goToProcessing(assetUid, xpath, queryNext.data.submission._uuid, true)
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

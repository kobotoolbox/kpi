import { Group, Loader, Text } from '@mantine/core'
import React from 'react'
import {
  type assetsDataListResponse,
  getAssetsDataListQueryKey,
  useAssetsDataList,
} from '#/api/react-query/survey-data'
import ActionIcon from '#/components/common/ActionIcon'
import { getSubmissionRootUuid } from '#/utils'
import { getSubmissionNeighborParams } from './submissionRouting'

const selectNeighbor = (data: assetsDataListResponse) => {
  if (data.status !== 200) return
  if (!data.data.results.length) return
  return { submission: data.data.results[0], count: data.data.count }
}

interface SubmissionNeighborNavProps {
  assetUid: string
  /** `_id` of the record currently being displayed. */
  submissionDbId: number
  /** Called with the root UUID of the record to move to. */
  onGoToSubmission: (submissionRootUuid: string) => void
}

/**
 * Moves between submissions, and says where in the list the current one sits.
 *
 * Rather than being handed a list, this asks the API for the single record on
 * either side plus how many lie that way - so it works the same whether the user
 * arrived from the data table, from the map, or from a link someone sent them.
 * Same approach as the single processing view's `SelectSubmission`.
 *
 * Note it walks every submission the user can see. Filters applied in the data
 * table are that table's own state and have no bearing here.
 */
export default function SubmissionNeighborNav({
  assetUid,
  submissionDbId,
  onGoToSubmission,
}: SubmissionNeighborNavProps) {
  const prevParams = getSubmissionNeighborParams(submissionDbId, 'prev')
  const queryPrev = useAssetsDataList(assetUid, prevParams, {
    query: { queryKey: getAssetsDataListQueryKey(assetUid, prevParams), select: selectNeighbor },
  })

  const nextParams = getSubmissionNeighborParams(submissionDbId, 'next')
  const queryNext = useAssetsDataList(assetUid, nextParams, {
    query: { queryKey: getAssetsDataListQueryKey(assetUid, nextParams), select: selectNeighbor },
  })

  const isLoading = queryPrev.isPending || queryNext.isPending
  const newerCount = queryPrev.data?.count ?? 0
  const olderCount = queryNext.data?.count ?? 0

  return (
    <Group gap='xs' wrap='nowrap'>
      {isLoading ? (
        <Loader size='xs' />
      ) : (
        <Text size='sm'>
          {t('##index## of ##total##')
            .replace('##index##', String(newerCount + 1))
            .replace('##total##', String(newerCount + olderCount + 1))}
        </Text>
      )}

      <ActionIcon
        variant='transparent'
        size='sm'
        iconName='angle-left'
        aria-label={t('Previous submission')}
        tooltip={t('Previous submission')}
        disabled={isLoading || !queryPrev.data}
        onClick={() => {
          if (queryPrev.data) {
            onGoToSubmission(getSubmissionRootUuid(queryPrev.data.submission))
          }
        }}
      />

      <ActionIcon
        variant='transparent'
        size='sm'
        iconName='angle-right'
        aria-label={t('Next submission')}
        tooltip={t('Next submission')}
        disabled={isLoading || !queryNext.data}
        onClick={() => {
          if (queryNext.data) {
            onGoToSubmission(getSubmissionRootUuid(queryNext.data.submission))
          }
        }}
      />
    </Group>
  )
}

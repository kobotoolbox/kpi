import { Group } from '@mantine/core'
import React from 'react'
import Button from '#/components/common/ButtonNew'
import type { SubmissionNeighbors } from './useSubmissionNeighbors'

interface SubmissionNeighborNavProps {
  neighbors: SubmissionNeighbors
  /** Called with the root UUID of the record to move to. */
  onGoToSubmission: (submissionRootUuid: string) => void
}

/** Steps to the submission before or after the one being displayed. */
export default function SubmissionNeighborNav({ neighbors, onGoToSubmission }: SubmissionNeighborNavProps) {
  const { isLoading, prevRootUuid, nextRootUuid } = neighbors

  return (
    <Group gap='xs' wrap='nowrap'>
      <Button
        variant='transparent'
        leftIcon='angle-left'
        disabled={isLoading || !prevRootUuid}
        onClick={() => {
          if (prevRootUuid) {
            onGoToSubmission(prevRootUuid)
          }
        }}
      >
        {t('Previous')}
      </Button>

      <Button
        variant='transparent'
        rightIcon='angle-right'
        disabled={isLoading || !nextRootUuid}
        onClick={() => {
          if (nextRootUuid) {
            onGoToSubmission(nextRootUuid)
          }
        }}
      >
        {t('Next')}
      </Button>
    </Group>
  )
}

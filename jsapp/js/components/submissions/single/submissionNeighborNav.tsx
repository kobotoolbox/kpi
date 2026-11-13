import { Group } from '@mantine/core'
import React from 'react'
import Button from '#/components/common/ButtonNew'
import type { SubmissionNeighbor, SubmissionNeighbors } from './useSubmissionNeighbors'

interface SubmissionNeighborNavProps {
  neighbors: SubmissionNeighbors
  onGoToSubmission: (neighbor: SubmissionNeighbor) => void
}

/** Steps to the submission before or after the one being displayed. */
export default function SubmissionNeighborNav({ neighbors, onGoToSubmission }: SubmissionNeighborNavProps) {
  const { isLoading, prev, next } = neighbors

  return (
    <Group gap='xs' wrap='nowrap'>
      <Button
        variant='transparent'
        leftIcon='angle-left'
        disabled={isLoading || !prev}
        onClick={() => {
          if (prev) {
            onGoToSubmission(prev)
          }
        }}
      >
        {t('Previous')}
      </Button>

      <Button
        variant='transparent'
        rightIcon='angle-right'
        disabled={isLoading || !next}
        onClick={() => {
          if (next) {
            onGoToSubmission(next)
          }
        }}
      >
        {t('Next')}
      </Button>
    </Group>
  )
}

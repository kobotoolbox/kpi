import type { SubmissionResponse } from '#/dataInterface'
import { getRepeatGroupAnswers } from '../repeatGroupUtils'

interface RepeatGroupCellProps {
  submissionData: SubmissionResponse
  rowName: string
}

/**
 * Displays a list of answers from a repeat group question.
 */
export default function RepeatGroupCell(props: RepeatGroupCellProps) {
  const repeatGroupAnswers = getRepeatGroupAnswers(props.submissionData, props.rowName)
  if (!repeatGroupAnswers || repeatGroupAnswers.length <= 0) return null
  return (
    <div
      dir='auto'
      style={{
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}
    >
      {repeatGroupAnswers.map((answer, i) => (
        <span key={i}>
          {i > 0 && ', '}
          {answer}
        </span>
      ))}
    </div>
  )
}

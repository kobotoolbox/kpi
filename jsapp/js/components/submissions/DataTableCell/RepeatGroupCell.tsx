import type { SubmissionResponse } from '#/dataInterface'
import { getRepeatGroupAnswers } from '../repeatGroupUtils'
import styles from './RepeatGroupCell.module.scss'

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
    <div dir='auto' className={styles.cell}>
      {repeatGroupAnswers.map((answer, i) => (
        <span key={i}>
          {i > 0 && ', '}
          {answer}
        </span>
      ))}
    </div>
  )
}

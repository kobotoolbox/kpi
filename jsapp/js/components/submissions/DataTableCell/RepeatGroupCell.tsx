import type { SubmissionResponse } from '#/dataInterface'

import { getRepeatGroupAnswers } from '../submissionUtils'

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
  if (!repeatGroupAnswers) return null

  return (
    <div className={styles.repeatGroupCell} dir='auto'>
      {repeatGroupAnswers.map((answer, i) => (
        <span key={i}>
          {i > 0 && ', '}
          {answer}
        </span>
      ))}
    </div>
  )
}

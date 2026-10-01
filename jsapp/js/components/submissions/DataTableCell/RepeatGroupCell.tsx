import ActionIconProcessing from '#/components/common/ActionIconProcessing'
import type { SubmissionResponse } from '#/dataInterface'
import { getRepeatGroupAnswers } from '../repeatGroupUtils'
import styles from './RepeatGroupCell.module.scss'

interface RepeatGroupCellProps {
  submissionData: SubmissionResponse
  rowName: string
  /**
   * Shows the "Open" button of `AudioCell` and `TextCell`, disabled with an explanation, as
   * Processing doesn't support repeat groups. Only meant for questions NLP supports.
   */
  showDisabledProcessingAction?: boolean
}

/**
 * Displays a list of answers from a repeat group question.
 */
export default function RepeatGroupCell(props: RepeatGroupCellProps) {
  const repeatGroupAnswers = getRepeatGroupAnswers(props.submissionData, props.rowName)
  if (!repeatGroupAnswers || repeatGroupAnswers.length <= 0) return null

  const answers = (
    <div dir='auto' className={styles.cell}>
      {repeatGroupAnswers.map((answer, i) => (
        <span key={i}>
          {i > 0 && ', '}
          {answer}
        </span>
      ))}
    </div>
  )

  if (!props.showDisabledProcessingAction) {
    return answers
  }

  return (
    <div className={styles.cellWithAction}>
      {answers}
      <ActionIconProcessing isInRepeatGroup />
    </div>
  )
}

import type { SubmissionResponse } from '#/dataInterface'
import styles from './RepeatGroupCell.module.scss'
import { getRepeatGroupAnswers } from './submissionUtils'

interface RepeatGroupCellProps {
  submissionData: SubmissionResponse
  rowName: string
}

/**
 * Displays a list of answers from a repeat group question.
 */
export default function RepeatGroupCell(props: RepeatGroupCellProps) {
  const repeatGroupAnswers = getRepeatGroupAnswers(props.submissionData, props.rowName)
  if (repeatGroupAnswers) {
    const elementsToRender: React.ReactNode[] = []
    repeatGroupAnswers.forEach((answer, index) => {
      if (index !== 0) {
        elementsToRender.push(', ')
      }
      elementsToRender.push(answer)
    })
    return (
      <div className={styles.repeatGroupCell} dir='auto'>
        {elementsToRender}
      </div>
    )
  } else {
    return null
  }
}

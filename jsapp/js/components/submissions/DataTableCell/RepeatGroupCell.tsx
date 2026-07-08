import { List } from '@mantine/core'
import type { SubmissionResponse } from '#/dataInterface'
import {
  type RepeatGroupAnswerTreeNode,
  formatRepeatGroupAnswerValueToText,
  getRepeatGroupAnswerTree,
} from '../repeatGroupUtils'
import TextModalCell from './TextModalCell'

interface RepeatGroupCellProps {
  submissionData: SubmissionResponse
  rowName: string
  columnName: string
  submissionIndex: number
  submissionTotal: number
}

/**
 * Displays a list of answers from a repeat group question.
 */
export default function RepeatGroupCell(props: RepeatGroupCellProps) {
  const repeatGroupAnswers = getRepeatGroupAnswerTree(props.submissionData, props.rowName)
  if (!repeatGroupAnswers || repeatGroupAnswers.length <= 0) return null

  const formatIndexPath = (indexPath: number[]): string => `${indexPath.join('.')}.`

  const formatInlineAnswer = (answerNode: RepeatGroupAnswerTreeNode, indexPath: number[]): string => {
    if (!Array.isArray(answerNode)) {
      return `${formatIndexPath(indexPath)} ${formatRepeatGroupAnswerValueToText(answerNode)}`
    }

    return answerNode
      .map((childNode, childIndex) => formatInlineAnswer(childNode, [...indexPath, childIndex + 1]))
      .join('; ')
  }

  const collectIndexedLeafAnswers = (answerNode: RepeatGroupAnswerTreeNode, indexPath: number[]): string[] => {
    if (!Array.isArray(answerNode)) {
      return [`${formatIndexPath(indexPath)} ${formatRepeatGroupAnswerValueToText(answerNode)}`]
    }

    return answerNode.flatMap((childNode, childIndex) =>
      collectIndexedLeafAnswers(childNode, [...indexPath, childIndex + 1]),
    )
  }

  const inlineText = repeatGroupAnswers.map((answer, i) => formatInlineAnswer(answer, [i + 1])).join('; ')

  const modalRows = repeatGroupAnswers.flatMap((answer, i) => collectIndexedLeafAnswers(answer, [i + 1]))

  const modalContent = (
    <List pl={0}>
      {modalRows.map((rowText, i) => (
        <List.Item key={i}>{rowText}</List.Item>
      ))}
    </List>
  )

  return (
    <TextModalCell
      text={inlineText}
      modalContent={modalContent}
      columnName={props.columnName}
      submissionIndex={props.submissionIndex}
      submissionTotal={props.submissionTotal}
    />
  )
}

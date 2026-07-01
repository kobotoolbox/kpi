import { Text } from '@mantine/core'
import type { CellInfo } from 'react-table'
import { getColumnLabel } from '#/components/submissions/tableUtils'
import {
  ADDITIONAL_SUBMISSION_PROPS,
  META_QUESTION_TYPES,
  QUESTION_TYPES,
  SUPPLEMENTAL_DETAILS_PROP,
} from '#/constants'
import type { AssetResponse, SubmissionAttachment, SurveyChoice, SurveyRow } from '#/dataInterface'
import { formatTimeDateShort, recordKeys } from '#/utils'
import { getMediaAttachment } from '../submissionUtils'
import { TABLE_MEDIA_TYPES } from '../tableConstants'
import AudioCell from './AudioCell'
import MediaCell from './MediaCell'
import RepeatGroupCell from './RepeatGroupCell'
import SupplementalDetailsCell from './SupplementalDetailsCell'
import TextModalCell from './TextModalCell'

interface DataTableCellProps {
  asset: AssetResponse
  reactTableRow: CellInfo
  columnKey: string
  question?: SurveyRow
  choices: SurveyChoice[]
  showGroupName: boolean
  translationIndex: number
  submissionCount: number
  isBulkProcessingInProgress?: boolean
}

export default function DataTableCell(props: DataTableCellProps) {
  const shouldShowSelectMultipleLabels = props.translationIndex === 0
  const submission = props.reactTableRow.original
  const submissionIndex = props.reactTableRow.index + 1
  const columnName = getColumnLabel(props.asset, props.columnKey, props.showGroupName, props.translationIndex)

  if (
    props.isBulkProcessingInProgress &&
    props.reactTableRow.value === undefined &&
    props.columnKey.startsWith(SUPPLEMENTAL_DETAILS_PROP)
  ) {
    return (
      <Text truncate='end' fs='italic' c='gray.3' span h='100%' style={{ display: 'flex', alignItems: 'center' }}>
        {t('Processing')}
      </Text>
    )
  }

  if (typeof props.reactTableRow.value === 'object' && !props.columnKey.startsWith(SUPPLEMENTAL_DETAILS_PROP)) {
    return <RepeatGroupCell submissionData={submission} rowName={props.columnKey} />
  }

  if (props.question && props.question.type && props.reactTableRow.value) {
    if (recordKeys(TABLE_MEDIA_TYPES).includes(props.question.type)) {
      let mediaAttachment = null

      const attachmentIndex: number = submission._attachments.findIndex(
        (attachment: SubmissionAttachment) => attachment.media_file_basename === props.reactTableRow.value,
      )

      if (props.question.type !== QUESTION_TYPES.text.id && submission._attachments[attachmentIndex]) {
        mediaAttachment = getMediaAttachment(
          submission,
          props.reactTableRow.value,
          submission._attachments[attachmentIndex].question_xpath,
        )
      }

      if (
        props.question.type === QUESTION_TYPES.audio.id ||
        props.question.type === QUESTION_TYPES['background-audio'].id
      ) {
        if (mediaAttachment !== null && props.question.$xpath !== undefined) {
          const audioXpath =
            typeof mediaAttachment === 'string' ? props.question.$xpath : mediaAttachment.question_xpath
          return (
            <AudioCell
              assetUid={props.asset.uid}
              xpath={audioXpath}
              submissionData={submission}
              mediaAttachment={mediaAttachment}
            />
          )
        }
      }

      if (mediaAttachment !== null && props.question.$xpath !== undefined) {
        return (
          <MediaCell
            questionType={props.question.type}
            mediaAttachment={mediaAttachment}
            mediaName={props.reactTableRow.value}
            submissionIndex={submissionIndex}
            submissionTotal={props.submissionCount}
            submission={submission}
            asset={props.asset}
          />
        )
      }
    }

    if (props.question.type === QUESTION_TYPES.select_one.id) {
      const choice = props.choices.find(
        (choiceItem) =>
          choiceItem.list_name === props.question?.select_from_list_name &&
          choiceItem.name === props.reactTableRow.value,
      )
      if (choice?.label && choice.label[props.translationIndex]) {
        return <span className='trimmed-text'>{choice.label[props.translationIndex]}</span>
      } else {
        return <span className='trimmed-text'>{props.reactTableRow.value}</span>
      }
    }
    if (
      props.question.type === QUESTION_TYPES.select_multiple.id &&
      props.reactTableRow.value &&
      shouldShowSelectMultipleLabels
    ) {
      const values = props.reactTableRow.value.split(' ')
      const labels: Array<string | null> = []
      values.forEach((valueItem: string) => {
        const choice = props.choices.find(
          (choiceItem) =>
            choiceItem.list_name === props.question?.select_from_list_name && choiceItem.name === valueItem,
        )
        if (choice && choice.label && choice.label[props.translationIndex]) {
          labels.push(choice.label[props.translationIndex])
        }
      })

      return <span className='trimmed-text'>{labels.join(', ')}</span>
    }
    if (props.question.type === META_QUESTION_TYPES.start || props.question.type === META_QUESTION_TYPES.end) {
      return <span className='trimmed-text'>{formatTimeDateShort(props.reactTableRow.value)}</span>
    }
  }

  if (props.columnKey === ADDITIONAL_SUBMISSION_PROPS._submission_time) {
    return <span className='trimmed-text'>{formatTimeDateShort(props.reactTableRow.value)}</span>
  }

  if (props.question?.type === QUESTION_TYPES.text.id) {
    return (
      <TextModalCell
        text={props.reactTableRow.value}
        columnName={columnName}
        submissionIndex={submissionIndex}
        submissionTotal={props.submissionCount}
      />
    )
  }

  if (
    props.reactTableRow.value === undefined &&
    props.question === undefined &&
    props.columnKey.startsWith(SUPPLEMENTAL_DETAILS_PROP)
  ) {
    return (
      <SupplementalDetailsCell
        asset={props.asset}
        submission={submission}
        columnKey={props.columnKey}
        columnName={columnName}
        submissionIndex={submissionIndex}
        submissionTotal={props.submissionCount}
      />
    )
  }

  return (
    <span className='trimmed-text' dir='auto'>
      {props.reactTableRow.value}
    </span>
  )
}

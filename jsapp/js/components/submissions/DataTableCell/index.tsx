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
import { getMediaAttachment, getSupplementalDetailsContent } from '../submissionUtils'
import { TABLE_MEDIA_TYPES } from '../tableConstants'
import AudioCell from './AudioCell'
import MediaCell from './MediaCell'
import RepeatGroupCell from './RepeatGroupCell'
import TextModalCell from './TextModalCell'

interface DataTableCellProps {
  asset: AssetResponse
  row: CellInfo
  columnKey: string
  question?: SurveyRow
  choices: SurveyChoice[]
  showGroupName: boolean
  translationIndex: number
  submissionCount: number
  showSelectMultipleLabels: boolean
}

export default function DataTableCell(props: DataTableCellProps) {
  const columnName = getColumnLabel(props.asset, props.columnKey, props.showGroupName, props.translationIndex)

  if (typeof props.row.value === 'object' && !props.columnKey.startsWith(SUPPLEMENTAL_DETAILS_PROP)) {
    return <RepeatGroupCell submissionData={props.row.original} rowName={props.columnKey} />
  }

  if (props.question && props.question.type && props.row.value) {
    if (recordKeys(TABLE_MEDIA_TYPES).includes(props.question.type)) {
      let mediaAttachment = null

      const attachmentIndex: number = props.row.original._attachments.findIndex((attachment: SubmissionAttachment) => {
        return attachment.media_file_basename === props.row.value
      })

      if (props.question.type !== QUESTION_TYPES.text.id && props.row.original._attachments[attachmentIndex]) {
        mediaAttachment = getMediaAttachment(
          props.row.original,
          props.row.value,
          props.row.original._attachments[attachmentIndex].question_xpath,
        )
      }

      if (
        props.question.type === QUESTION_TYPES.audio.id ||
        props.question.type === QUESTION_TYPES['background-audio'].id
      ) {
        if (mediaAttachment !== null && props.question.$xpath !== undefined) {
          return (
            <AudioCell
              assetUid={props.asset.uid}
              xpath={props.question.$xpath}
              submissionData={props.row.original}
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
            mediaName={props.row.value}
            submissionIndex={props.row.index + 1}
            submissionTotal={props.submissionCount}
            submission={props.row.original}
            asset={props.asset}
          />
        )
      }
    }

    if (props.question.type === QUESTION_TYPES.select_one.id) {
      const choice = props.choices.find(
        (choiceItem) =>
          choiceItem.list_name === props.question?.select_from_list_name && choiceItem.name === props.row.value,
      )
      if (choice?.label && choice.label[props.translationIndex]) {
        return <span className='trimmed-text'>{choice.label[props.translationIndex]}</span>
      } else {
        return <span className='trimmed-text'>{props.row.value}</span>
      }
    }
    if (
      props.question.type === QUESTION_TYPES.select_multiple.id &&
      props.row.value &&
      props.showSelectMultipleLabels
    ) {
      const values = props.row.value.split(' ')
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
      return <span className='trimmed-text'>{formatTimeDateShort(props.row.value)}</span>
    }
  }

  if (props.columnKey === ADDITIONAL_SUBMISSION_PROPS._submission_time) {
    return <span className='trimmed-text'>{formatTimeDateShort(props.row.value)}</span>
  }

  if (props.question?.type === QUESTION_TYPES.text.id) {
    return (
      <TextModalCell
        text={props.row.value}
        columnName={columnName}
        submissionIndex={props.row.index + 1}
        submissionTotal={props.submissionCount}
      />
    )
  }

  if (
    props.row.value === undefined &&
    props.question === undefined &&
    props.columnKey.startsWith(SUPPLEMENTAL_DETAILS_PROP)
  ) {
    const supplementalValue = getSupplementalDetailsContent(props.row.original, props.columnKey) || ''
    if (props.columnKey.endsWith('verified')) {
      return <span className='trimmed-text'>{supplementalValue}</span>
    }
    return (
      <TextModalCell
        text={supplementalValue}
        columnName={columnName}
        submissionIndex={props.row.index + 1}
        submissionTotal={props.submissionCount}
      />
    )
  }

  return (
    <span className='trimmed-text' dir='auto'>
      {props.row.value}
    </span>
  )
}

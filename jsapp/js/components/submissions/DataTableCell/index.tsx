import { Text } from '@mantine/core'
import type { CellInfo } from 'react-table'
import { getColumnLabel, getSelectResponseLabel } from '#/components/submissions/tableUtils'
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
import TextCell from './TextCell'

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
  // Table settings encode the "XML Values" display option as a negative
  // translation index (see `TableSettings`).
  const shouldShowSelectLabels = props.translationIndex > -1
  const submission = props.reactTableRow.original
  const submissionIndex = props.reactTableRow.index + 1
  const columnName = getColumnLabel(props.asset, props.columnKey, props.showGroupName, props.translationIndex)

  const shouldRenderUndefinedNestedKeyAsRepeat = (() => {
    if (props.reactTableRow.value !== undefined || !props.columnKey.includes('/')) {
      return false
    }

    const keyPathSegments = props.columnKey.split('/')
    for (let i = keyPathSegments.length - 1; i >= 1; i--) {
      const parentPath = keyPathSegments.slice(0, i).join('/')
      if (Array.isArray(submission[parentPath])) {
        return true
      }
    }

    return false
  })()

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

  // Some repeat answers are stored under related nested keys, so a direct lookup for this column key can be
  // undefined even though repeat data exists in the submission payload.
  //
  // `null` is excluded explicitly, as `typeof null` is `'object'` and an empty
  // response (e.g. `_submitted_by` of an anonymous submission) would otherwise be
  // formatted as the string "null".
  if (
    !props.columnKey.startsWith(SUPPLEMENTAL_DETAILS_PROP) &&
    props.reactTableRow.value !== null &&
    (typeof props.reactTableRow.value === 'object' || shouldRenderUndefinedNestedKeyAsRepeat)
  ) {
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
            typeof mediaAttachment === 'string' || !mediaAttachment.question_xpath
              ? props.question.$xpath
              : mediaAttachment.question_xpath
          return (
            <AudioCell
              assetUid={props.asset.uid}
              xpath={audioXpath}
              submissionData={submission}
              mediaAttachment={mediaAttachment}
              questionLabel={columnName}
            />
          )
        }
      }

      if (mediaAttachment !== null && props.question.$xpath !== undefined) {
        return (
          <MediaCell
            questionType={props.question.type}
            mediaAttachment={mediaAttachment}
            displayValue={props.reactTableRow.value}
            submissionIndex={submissionIndex}
            submissionTotal={props.submissionCount}
            submission={submission}
            asset={props.asset}
          />
        )
      }
    }

    if (
      shouldShowSelectLabels &&
      (props.question.type === QUESTION_TYPES.select_one.id ||
        props.question.type === QUESTION_TYPES.select_multiple.id)
    ) {
      return (
        <span className='trimmed-text'>
          {getSelectResponseLabel({
            value: props.reactTableRow.value,
            questionType: props.question.type,
            listName: props.question.select_from_list_name,
            choices: props.choices,
            translationIndex: props.translationIndex,
          })}
        </span>
      )
    }
    if (props.question.type === META_QUESTION_TYPES.start || props.question.type === META_QUESTION_TYPES.end) {
      return <span className='trimmed-text'>{formatTimeDateShort(props.reactTableRow.value)}</span>
    }
  }

  if (props.columnKey === ADDITIONAL_SUBMISSION_PROPS._submission_time) {
    // Empty check keeps an absent date an empty cell, as `moment` formats those
    // as "Invalid date".
    return (
      <span className='trimmed-text'>
        {props.reactTableRow.value ? formatTimeDateShort(props.reactTableRow.value) : ''}
      </span>
    )
  }

  if (props.question?.type === QUESTION_TYPES.text.id) {
    return (
      <TextCell
        assetUid={props.asset.uid}
        xpath={props.question.$xpath}
        submissionData={submission}
        text={props.reactTableRow.value}
        questionLabel={columnName}
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
      />
    )
  }

  return (
    <span className='trimmed-text' dir='auto'>
      {props.reactTableRow.value}
    </span>
  )
}

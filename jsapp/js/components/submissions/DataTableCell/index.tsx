import { Text } from '@mantine/core'
import { isInRepeatGroup } from '#/components/processing/common/questionType'
import { isNlpSupported } from '#/components/processing/common/utils'
import { getColumnLabel, getSelectResponseLabel } from '#/components/submissions/tableUtils'
import {
  ADDITIONAL_SUBMISSION_PROPS,
  META_QUESTION_TYPES,
  QUESTION_TYPES,
  SUPPLEMENTAL_DETAILS_PROP,
} from '#/constants'
import type { AssetResponse, SubmissionResponse, SurveyChoice, SurveyRow } from '#/dataInterface'
import { formatTimeDateShort, recordKeys } from '#/utils'
import {
  findAttachmentByQuestionXpaths,
  getMediaAttachment,
  inferAttachmentQuestionType,
} from '../submissionMediaUtils'
import { TABLE_MEDIA_TYPES } from '../tableConstants'
import AudioCell from './AudioCell'
import MediaCell from './MediaCell'
import RepeatGroupCell from './RepeatGroupCell'
import SupplementalDetailsCell from './SupplementalDetailsCell'
import TextCell from './TextCell'

interface DataTableCellProps {
  asset: AssetResponse
  /** The whole submission the row stands for, as several cell types look beyond their own response. */
  submissionData: SubmissionResponse
  columnKey: string
  /**
   * The response stored under `columnKey`. Deliberately loose, as each branch below narrows it
   * by question type.
   */
  columnValue: any
  /** Zero-based position of the submission among the rendered rows, shown to the user as `+ 1`. */
  submissionIndex: number
  /**
   * The other paths this column stands for, dropped as duplicates of it when their question
   * moved between groups. Pre-move submissions file their attachments under those.
   */
  legacyAttachmentPaths?: string[]
  question?: SurveyRow
  choices: SurveyChoice[]
  showGroupName: boolean
  translationIndex: number
  submissionCount: number
  isBulkProcessingInProgress?: boolean
}

export default function DataTableCell(props: DataTableCellProps) {
  // Table settings encode the "Question & choice names" display option as
  // a negative translation index (see `TableSettings`).
  const shouldShowSelectLabels = props.translationIndex > -1
  const columnName = getColumnLabel(props.asset, props.columnKey, props.showGroupName, props.translationIndex)

  const shouldRenderUndefinedNestedKeyAsRepeat = (() => {
    if (props.columnValue !== undefined || !props.columnKey.includes('/')) {
      return false
    }

    const keyPathSegments = props.columnKey.split('/')
    for (let i = keyPathSegments.length - 1; i >= 1; i--) {
      const parentPath = keyPathSegments.slice(0, i).join('/')
      if (Array.isArray(props.submissionData[parentPath])) {
        return true
      }
    }

    return false
  })()

  if (
    props.isBulkProcessingInProgress &&
    props.columnValue === undefined &&
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
    props.columnValue !== null &&
    (typeof props.columnValue === 'object' || shouldRenderUndefinedNestedKeyAsRepeat)
  ) {
    return (
      <RepeatGroupCell
        submissionData={props.submissionData}
        rowName={props.columnKey}
        // Processing doesn't support repeat groups, so NLP supported questions get a disabled way into it.
        showDisabledProcessingAction={
          isNlpSupported(props.question?.type) && isInRepeatGroup(props.asset, props.columnKey, props.submissionData)
        }
      />
    )
  }

  // `question_xpath` was recorded when the submission came in, so it finds the file even
  // after a rename, a move or a removal.
  const attachment = findAttachmentByQuestionXpaths(props.submissionData, [
    props.columnKey,
    ...(props.legacyAttachmentPaths ?? []),
  ])

  // The row goes first where there is one: it alone tells `background-audio` from `audio`,
  // and a `file` question holding a photo from an `image` one.
  const questionType = props.question?.type ?? (attachment && inferAttachmentQuestionType(attachment))
  // The attachment's path is also the one the processing view has to open at.
  const questionXpath = attachment?.question_xpath ?? props.question?.$xpath

  if (questionType && props.columnValue) {
    if (recordKeys(TABLE_MEDIA_TYPES).includes(questionType)) {
      const mediaAttachment =
        attachment === undefined
          ? null
          : getMediaAttachment(props.submissionData, props.columnValue, attachment.question_xpath)

      if (questionType === QUESTION_TYPES.audio.id || questionType === QUESTION_TYPES['background-audio'].id) {
        if (mediaAttachment !== null && questionXpath !== undefined) {
          return (
            <AudioCell
              assetUid={props.asset.uid}
              xpath={questionXpath}
              submissionData={props.submissionData}
              mediaAttachment={mediaAttachment}
              questionLabel={columnName}
            />
          )
        }
      }

      if (mediaAttachment !== null && questionXpath !== undefined) {
        return (
          <MediaCell
            questionType={questionType}
            mediaAttachment={mediaAttachment}
            displayValue={props.columnValue}
            submissionIndex={props.submissionIndex + 1}
            submissionTotal={props.submissionCount}
            submission={props.submissionData}
            asset={props.asset}
          />
        )
      }
    }

    if (
      shouldShowSelectLabels &&
      (questionType === QUESTION_TYPES.select_one.id || questionType === QUESTION_TYPES.select_multiple.id)
    ) {
      return (
        <span className='trimmed-text'>
          {getSelectResponseLabel({
            value: props.columnValue,
            questionType,
            listName: props.question?.select_from_list_name,
            choices: props.choices,
            translationIndex: props.translationIndex,
          })}
        </span>
      )
    }
    if (questionType === META_QUESTION_TYPES.start || questionType === META_QUESTION_TYPES.end) {
      return <span className='trimmed-text'>{formatTimeDateShort(props.columnValue)}</span>
    }
  }

  if (props.columnKey === ADDITIONAL_SUBMISSION_PROPS._submission_time) {
    // Empty check keeps an absent date an empty cell, as `moment` formats those
    // as "Invalid date".
    return <span className='trimmed-text'>{props.columnValue ? formatTimeDateShort(props.columnValue) : ''}</span>
  }

  if (props.question?.type === QUESTION_TYPES.text.id) {
    return (
      <TextCell
        assetUid={props.asset.uid}
        xpath={props.question.$xpath}
        submissionData={props.submissionData}
        text={props.columnValue}
        questionLabel={columnName}
      />
    )
  }

  if (
    props.columnValue === undefined &&
    props.question === undefined &&
    props.columnKey.startsWith(SUPPLEMENTAL_DETAILS_PROP)
  ) {
    return (
      <SupplementalDetailsCell
        asset={props.asset}
        submission={props.submissionData}
        columnKey={props.columnKey}
        columnName={columnName}
      />
    )
  }

  return (
    <span className='trimmed-text' dir='auto'>
      {props.columnValue}
    </span>
  )
}

import React from 'react'

import { Text } from '@mantine/core'
import KoboImage from '#/components/common/koboImage'
import { QUESTION_TYPES } from '#/constants'
import type { AnyRowTypeName } from '#/constants'
import type { SubmissionAttachment } from '#/dataInterface'
import classes from './TableMediaPreview.module.scss'

interface TableMediaPreviewProps {
  questionType: AnyRowTypeName
  mediaAttachment?: SubmissionAttachment | string
  displayValue: string
}

function renderPreviewByType(
  questionType: AnyRowTypeName,
  mediaAttachment: SubmissionAttachment,
  displayValue: string,
) {
  switch (questionType) {
    case QUESTION_TYPES.file.id:
      return (
        <Text className={classes.text}>
          {displayValue}
          <br />({mediaAttachment.mimetype})
        </Text>
      )
    case QUESTION_TYPES.image.id:
      return (
        <div className={classes.image}>
          <KoboImage src={mediaAttachment.download_medium_url || mediaAttachment.download_url} />
        </div>
      )
    case QUESTION_TYPES.video.id:
      return <video className={classes.video} src={mediaAttachment.download_url} controls autoPlay />
    default:
      return (
        <Text className={classes.text}>
          {t('Unsupported media type: ##QUESTION_TYPE##').replace('##QUESTION_TYPE##', questionType)}
        </Text>
      )
  }
}

export default function TableMediaPreview(props: TableMediaPreviewProps) {
  if (props.questionType === QUESTION_TYPES.text.id) {
    return <Text className={classes.text}>{props.displayValue}</Text>
  }

  if (typeof props.mediaAttachment === 'string') {
    return <Text className={classes.text}>{props.mediaAttachment}</Text>
  }

  if (!props.mediaAttachment) {
    return <Text className={classes.text}>{t('Attachment not found or unavailable.')}</Text>
  }

  return (
    <div className={classes.root}>
      {renderPreviewByType(props.questionType, props.mediaAttachment, props.displayValue)}
    </div>
  )
}

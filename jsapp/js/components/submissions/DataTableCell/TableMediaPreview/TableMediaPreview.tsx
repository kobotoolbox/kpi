import { Text } from '@mantine/core'
import KoboImage from '#/components/common/koboImage'
import { QUESTION_TYPES } from '#/constants'
import type { AnyRowTypeName } from '#/constants'
import type { SubmissionAttachment } from '#/dataInterface'

const TEXT_STYLE_PROPS = {
  p: 'sm',
  style: { whiteSpace: 'pre-wrap' },
}

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
        <Text {...TEXT_STYLE_PROPS} dir='auto'>
          {displayValue}
          <br />({mediaAttachment.mimetype})
        </Text>
      )
    case QUESTION_TYPES.image.id:
      return <KoboImage src={mediaAttachment.download_medium_url || mediaAttachment.download_url} />
    case QUESTION_TYPES.video.id:
      return (
        <video
          style={{ width: '100%', maxHeight: '60vh', objectFit: 'contain' }}
          src={mediaAttachment.download_url}
          controls
          autoPlay
        />
      )
    default:
      return (
        <Text {...TEXT_STYLE_PROPS} dir='auto'>
          {t('Unsupported media type: ##QUESTION_TYPE##').replace('##QUESTION_TYPE##', questionType)}
        </Text>
      )
  }
}

export default function TableMediaPreview(props: TableMediaPreviewProps) {
  if (props.questionType === QUESTION_TYPES.text.id) {
    return (
      <Text dir='auto' {...TEXT_STYLE_PROPS}>
        {props.displayValue}
      </Text>
    )
  }

  if (typeof props.mediaAttachment === 'string') {
    return (
      <Text dir='auto' {...TEXT_STYLE_PROPS}>
        {props.mediaAttachment}
      </Text>
    )
  }

  if (!props.mediaAttachment) {
    return (
      <Text dir='auto' {...TEXT_STYLE_PROPS}>
        {t('Attachment not found or unavailable.')}
      </Text>
    )
  }

  return <>{renderPreviewByType(props.questionType, props.mediaAttachment, props.displayValue)}</>
}

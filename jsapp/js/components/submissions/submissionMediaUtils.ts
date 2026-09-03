import type { _DataResponseAttachmentsItem } from '#/api/models/_dataResponseAttachmentsItem'
import type { DataResponse } from '#/api/models/dataResponse'
import { type AnyRowTypeName, QuestionTypeName } from '#/constants'
import type { SubmissionAttachment, SubmissionResponse } from '#/dataInterface'

/**
 * Finds the attachment a submission stored for the given question path.
 *
 * Matches on `question_xpath` - the path recorded when the submission came in -
 * so the file is still found after the question or its groups get renamed.
 */
export function findAttachmentByQuestionXpath(
  submission: DataResponse | SubmissionResponse,
  questionXpath: string,
): SubmissionAttachment | undefined {
  return submission._attachments?.find((attachment) => attachment.question_xpath === questionXpath)
}

/**
 * Guesses the type of the question that produced an attachment, from its
 * mimetype.
 *
 * Needed when the question is gone from the current form definition (renamed
 * after this submission came in), leaving no row to read the real type from.
 * NOTE: Two known imprecisions, both harmless for displaying the file:
 * `background-audio` looks like `audio`, and a `file` question holding e.g. a
 * photo reads as `image`.
 */
export function getAttachmentQuestionType(
  attachment: Pick<SubmissionAttachment, 'mimetype'>,
): AnyRowTypeName | undefined {
  // No mimetype leaves nothing to guess from.
  if (!attachment.mimetype) {
    return undefined
  }
  if (attachment.mimetype.startsWith('audio/')) {
    return QuestionTypeName.audio
  }
  if (attachment.mimetype.startsWith('image/')) {
    return QuestionTypeName.image
  }
  if (attachment.mimetype.startsWith('video/')) {
    return QuestionTypeName.video
  }
  // Anything else could only have come from a `file` question.
  return QuestionTypeName.file
}

/**
 * Returns an attachment object or an error message.
 */
export function getMediaAttachment(
  submission: DataResponse | SubmissionResponse,
  fileName: string,
  questionXPath: string,
): string | SubmissionAttachment {
  let mediaAttachment: string | _DataResponseAttachmentsItem = t('Could not find ##fileName##').replace(
    '##fileName##',
    fileName,
  )
  submission._attachments.forEach((attachment) => {
    if (attachment.question_xpath === questionXPath) {
      // Check if the audio filetype is of type not supported by player and send it to format to mp3
      if (
        attachment.mimetype!.includes('audio/') &&
        !attachment.mimetype!.includes('/mp3') &&
        !attachment.mimetype!.includes('mpeg') &&
        !attachment.mimetype!.includes('/wav') &&
        !attachment.mimetype!.includes('ogg')
      ) {
        const newAudioURL = attachment.download_url + '?format=mp3'
        const newAttachment = {
          ...attachment,
          download_url: newAudioURL,
          download_large_url: newAudioURL,
          download_medium_url: newAudioURL,
          download_small_url: newAudioURL,
          mimetype: 'audio/mp3',
        }
        mediaAttachment = newAttachment
      } else {
        mediaAttachment = attachment
      }
    }
  })
  return mediaAttachment
}

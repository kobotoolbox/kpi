import type { _DataResponseAttachmentsItem } from '#/api/models/_dataResponseAttachmentsItem'
import type { DataResponse } from '#/api/models/dataResponse'
import { type AnyRowTypeName, QuestionTypeName } from '#/constants'
import type { SubmissionAttachment, SubmissionResponse } from '#/dataInterface'

/**
 * Finds the attachment a submission stored for the given question path. Matches on
 * `question_xpath`, the path recorded when the submission came in, so the file is
 * still found after the question or its groups get renamed or removed.
 */
export function findAttachmentByQuestionXpath(
  submission: DataResponse | SubmissionResponse,
  questionXpath: string,
): SubmissionAttachment | undefined {
  return submission._attachments?.find((attachment) => attachment.question_xpath === questionXpath)
}

/** `application/ogg` counts - a generic prefix, but we do play Ogg as audio. */
function isAudioMimetype(mimetype: string) {
  return mimetype.startsWith('audio/') || mimetype === 'application/ogg'
}

/**
 * Guesses which question type produced an attachment from its mimetype, for when the
 * question is gone from the form definition and no row is left to read the type from.
 *
 * Two imprecisions, both harmless for displaying the file: `background-audio` reads
 * as `audio`, and a `file` question holding e.g. a photo reads as `image`.
 */
export function inferAttachmentQuestionType(
  attachment: Pick<SubmissionAttachment, 'mimetype'>,
): AnyRowTypeName | undefined {
  if (!attachment.mimetype) {
    return undefined
  }
  if (isAudioMimetype(attachment.mimetype)) {
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
        isAudioMimetype(attachment.mimetype!) &&
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

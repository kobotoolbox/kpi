import type { _DataResponseAttachmentsItem } from '#/api/models/_dataResponseAttachmentsItem'
import type { DataResponse } from '#/api/models/dataResponse'
import type { SubmissionAttachment, SubmissionResponse } from '#/dataInterface'

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

import type { AssetAttachmentAudioDurationResponse } from '#/api/models/assetAttachmentAudioDurationResponse'
import type { SubmissionAttachment, SubmissionResponse } from '#/dataInterface'

/** Wraps a payload in the `{ status, data, headers }` envelope the API client returns. */
export function mockAudioDurationResponse(payload: AssetAttachmentAudioDurationResponse) {
  return {
    status: 200 as const,
    data: payload,
    headers: new Headers(),
  }
}

/**
 * Builds a submission with the given audio attachments.
 *
 * Not using the Orval mock factory here. It returns `DataResponse`, which
 * doesn't match the `SubmissionResponse` these consumers take, and its faker
 * values are random. The tests need exact uids, xpaths and mimetypes.
 */
export function buildSubmissionWithAttachments(
  attachments: Array<Partial<SubmissionAttachment> & { uid: string }>,
): SubmissionResponse {
  const builtAttachments: SubmissionAttachment[] = attachments.map((attachment) => {
    return {
      mimetype: 'audio/mp3',
      question_xpath: 'audio_q',
      download_url: '',
      filename: `${attachment.uid}.mp3`,
      media_file_basename: `${attachment.uid}.mp3`,
      ...attachment,
    }
  })

  // Only `_attachments` is read, so the rest of the submission shape is
  // intentionally omitted.
  return { _attachments: builtAttachments } as SubmissionResponse
}

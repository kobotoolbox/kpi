import { useMemo } from 'react'
import type { DataResponse } from '#/api/models/dataResponse'
import { useAudioDurations } from '#/components/submissions/useCalculateAudioDuration.hook'
import type { AssetResponse } from '#/dataInterface'
import { getAttachmentForProcessing } from './transcript.utils'

/**
 * Audio length in seconds from the backend, `undefined` until known. Cached, so screens asking about the same file
 * share one request.
 */
export function useTranscriptionSourceSeconds(
  asset: AssetResponse,
  questionXpath: string,
  submission: DataResponse,
): number | undefined {
  const attachment = getAttachmentForProcessing(questionXpath, submission)
  const attachmentUid = typeof attachment === 'string' ? undefined : attachment.uid
  const attachmentUids = useMemo(() => (attachmentUid ? [attachmentUid] : []), [attachmentUid])

  const { durationsByUid } = useAudioDurations(attachmentUids, asset.uid)
  return attachmentUid ? (durationsByUid.get(attachmentUid) ?? undefined) : undefined
}

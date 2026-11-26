import React, { createContext, useContext, useMemo } from 'react'
import { QuestionTypeName } from '#/constants'
import type { SubmissionAttachment, SubmissionResponse } from '#/dataInterface'
import { inferAttachmentQuestionType } from './submissionMediaUtils'
import type { VisibleAudioXpaths } from './table.types'
import { useAudioDurations } from './useCalculateAudioDuration.hook'

interface AudioDurationsContextValue {
  /** Backend-calculated duration (in whole seconds) keyed by attachment uid. */
  durationsByUid: Map<string, number | null>
  isLoading: boolean
}

const AudioDurationsContext = createContext<AudioDurationsContextValue>({
  durationsByUid: new Map(),
  isLoading: false,
})

interface AudioDurationsProviderProps {
  assetUid: string
  submissions: SubmissionResponse[]
  /** Hidden columns are left out, so we don't pay for ffprobe-backed lookups the user cannot see. */
  visibleAudioXpaths: VisibleAudioXpaths
  children: React.ReactNode
}

/**
 * Fetches backend audio durations for every audio attachment on the currently
 * displayed submissions in a single batched request, and exposes them through
 * context so each audio cell can render a duration that matches the bulk
 * processing feature exactly.
 *
 * It runs for every user, not only ASR/MT ones: the mini player doesn't
 * preload, so without this the length stays unknown until playback.
 * It only fetches durations for visible audio columns.
 */
export function AudioDurationsProvider({
  assetUid,
  submissions,
  visibleAudioXpaths,
  children,
}: AudioDurationsProviderProps) {
  const attachmentUids = useMemo(() => {
    const audioQuestionXpaths = new Set(visibleAudioXpaths.audioQuestion)
    const noQuestionXpaths = new Set(visibleAudioXpaths.noQuestion)

    // Mirrors the cell: the question type decides, and the mimetype only when there's no question.
    const isPlayedAsAudio = (attachment: SubmissionAttachment) =>
      audioQuestionXpaths.has(attachment.question_xpath) ||
      (noQuestionXpaths.has(attachment.question_xpath) &&
        inferAttachmentQuestionType(attachment) === QuestionTypeName.audio)

    return submissions
      .flatMap((submission) => submission._attachments || [])
      .filter((attachment) => !attachment.is_deleted && isPlayedAsAudio(attachment))
      .map((attachment) => attachment.uid)
  }, [submissions, visibleAudioXpaths])

  const { durationsByUid, isLoading } = useAudioDurations(attachmentUids, assetUid)

  const value = useMemo(() => {
    return { durationsByUid, isLoading }
  }, [durationsByUid, isLoading])

  return <AudioDurationsContext.Provider value={value}>{children}</AudioDurationsContext.Provider>
}

/**
 * Returns the backend-calculated duration (in whole seconds) for the given
 * attachment, or `undefined` while it is still loading / unavailable (in which
 * case the player falls back to the browser-decoded duration).
 */
export function useAttachmentDuration(attachmentUid: string | undefined): number | undefined {
  const { durationsByUid } = useContext(AudioDurationsContext)
  if (attachmentUid === undefined) {
    return undefined
  }
  const seconds = durationsByUid.get(attachmentUid)
  return seconds ?? undefined
}

import React, { createContext, useContext, useMemo } from 'react'
import type { SubmissionResponse } from '#/dataInterface'
import { isAudioMimetype } from './submissionMediaUtils'
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
  /**
   * Attachment xpaths of the visible columns that may show audio (see
   * `getVisibleAudioXpaths`). Hidden columns are skipped, so we don't pay for
   * ffprobe-backed lookups the user cannot see.
   */
  visibleAudioXpaths: string[]
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
    // Bail out early (no query fired) when no audio columns are visible.
    if (visibleAudioXpaths.length === 0) {
      return []
    }

    const visibleXpaths = new Set(visibleAudioXpaths)
    return submissions
      .flatMap((submission) => submission._attachments || [])
      .filter(
        (attachment) =>
          !attachment.is_deleted &&
          !!attachment.mimetype &&
          isAudioMimetype(attachment.mimetype) &&
          visibleXpaths.has(attachment.question_xpath),
      )
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

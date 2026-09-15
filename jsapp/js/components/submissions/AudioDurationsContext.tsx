import React, { createContext, useContext, useMemo } from 'react'
import type { SubmissionResponse } from '#/dataInterface'
import envStore from '#/envStore'
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
   * XPaths of the audio question columns that are currently visible in the
   * table. Attachments belonging to hidden columns are skipped so we don't pay
   * the (potentially expensive, ffprobe-backed) duration lookup for durations
   * the user cannot see.
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
 * Two guards keep this from adding load where it brings no benefit:
 * - It only runs when ASR/MT features are enabled for the account. When they
 *   are off there is no processing view or bulk modal to compare against, so
 *   there's nothing for the table to be consistent with, and the browser's own
 *   decoded duration is good enough.
 * - It only fetches durations for visible audio columns.
 */
export function AudioDurationsProvider({
  assetUid,
  submissions,
  visibleAudioXpaths,
  children,
}: AudioDurationsProviderProps) {
  const isAsrMtEnabled = envStore.data.asr_mt_features_enabled

  const attachmentUids = useMemo(() => {
    // Bail out early (no query fired) when the feature is off or no audio
    // columns are visible.
    if (!isAsrMtEnabled || visibleAudioXpaths.length === 0) {
      return []
    }

    const visibleXpaths = new Set(visibleAudioXpaths)
    return submissions
      .flatMap((submission) => submission._attachments || [])
      .filter(
        (attachment) =>
          !attachment.is_deleted &&
          attachment.mimetype?.startsWith('audio/') &&
          visibleXpaths.has(attachment.question_xpath),
      )
      .map((attachment) => attachment.uid)
  }, [isAsrMtEnabled, submissions, visibleAudioXpaths])

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

import { useEffect } from 'react'
import type { ServerError } from '#/api/ServerError'
import { useAssetsAttachmentsAudioDurationCreate } from '#/api/react-query/survey-data'
import type { SubmissionResponse } from '#/dataInterface'

interface UseCalculateAudioDurationParams {
  selectedSubmissions: SubmissionResponse[]
  fieldId: string
  assetUid: string
  onLoadingChange: (isLoading: boolean) => void
  onDurationAdd: (duration: number) => void
  onError: (message: string) => void
}

const MAXIMUM_AUDIO_DURATION_BATCH_SIZE = 200

export function useCalculateAudioDuration({
  selectedSubmissions,
  fieldId,
  assetUid,
  onLoadingChange,
  onDurationAdd,
  onError,
}: UseCalculateAudioDurationParams) {
  const { mutate: getAudioDurations } = useAssetsAttachmentsAudioDurationCreate()

  useEffect(() => {
    // Extract audio attachment uids from submissions
    const attachmentUids = selectedSubmissions
      .flatMap((submission) => submission._attachments || [])
      .filter((attachment) => attachment.question_xpath === fieldId)
      .map((attachment) => attachment.uid)

    // Create batches of 200 (with limiting the submissions to 1 page, the biggest number of batches possible is 3)
    const attachmentUidBatches: string[][] = []
    for (let i = 0; i < attachmentUids.length; i += MAXIMUM_AUDIO_DURATION_BATCH_SIZE) {
      attachmentUidBatches.push(attachmentUids.slice(i, i + MAXIMUM_AUDIO_DURATION_BATCH_SIZE))
    }
    ;(async () => {
      onLoadingChange(true)

      for (const batch of attachmentUidBatches) {
        let attempt = 0

        // We attempt 2 more times if we get a 504
        while (attempt < 3) {
          try {
            const result = await new Promise<{ success: boolean; total?: number; error?: ServerError }>((resolve) => {
              getAudioDurations(
                {
                  uidAsset: assetUid,
                  data: {
                    attachment_uids: batch,
                  },
                },
                {
                  onSuccess: (response) => {
                    resolve({ success: true, total: response.data.total })
                  },
                  onError: (error) => {
                    const serverError = error as ServerError
                    resolve({ success: false, error: serverError })
                  },
                },
              )
            })

            if (result.success && result.total !== undefined) {
              onDurationAdd(result.total)
              break
            } else if (result.error?.response?.status === 504) {
              attempt++
              if (attempt < 3) {
                const delay = 2 ** (attempt - 1) * 1000
                await new Promise((resolve) => setTimeout(resolve, delay))
              } else {
                onError(t('Failed to calculate audio duration after multiple attempts. Please try again.'))
                onLoadingChange(false)
                return
              }
            } else {
              const errorMessage = result.error?.toString() || t('Failed to calculate audio duration.')
              onError(errorMessage)
              onLoadingChange(false)
              return
            }
          } catch (error) {
            onError(t('An unexpected error occurred while calculating audio duration.'))
            onLoadingChange(false)
            return
          }
        }
      }

      onLoadingChange(false)
    })()
  }, [])
}

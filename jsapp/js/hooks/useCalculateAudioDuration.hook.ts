import { useEffect, useState } from 'react'
import type { ServerError } from '#/api/ServerError'
import { useAssetsAttachmentsAudioDurationCreate } from '#/api/react-query/survey-data'
import type { SubmissionResponse } from '#/dataInterface'

interface UseCalculateAudioDurationReturn {
  duration: number
  isLoading: boolean
  isError: boolean
  errorMessage: string | null
}

interface UseCalculateAudioDurationParams {
  selectedSubmissions: SubmissionResponse[]
  fieldId: string
  assetUid: string
}

const MAXIMUM_AUDIO_DURATION_BATCH_SIZE = 200

export function useCalculateAudioDuration({
  selectedSubmissions,
  fieldId,
  assetUid,
}: UseCalculateAudioDurationParams): UseCalculateAudioDurationReturn {
  const [duration, setDuration] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [isError, setIsError] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

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
      setIsLoading(true)

      // We accumulate locally to avoid sending an incorrect duration to the user if this process fails mid-batch
      let totalDuration = 0

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
              totalDuration += result.total
              break
            } else if (result.error?.response?.status === 504) {
              attempt++
              if (attempt < 3) {
                const delay = 2 ** (attempt - 1) * 1000
                await new Promise((resolve) => setTimeout(resolve, delay))
              } else {
                setIsError(true)
                setErrorMessage(t('Failed to calculate audio duration after multiple attempts. Please try again.'))
                setIsLoading(false)
                return
              }
            } else {
              const responseErrorMessage = result.error?.toString() || t('Failed to calculate audio duration.')
              setIsError(true)
              setErrorMessage(responseErrorMessage)
              setIsLoading(false)
              return
            }
          } catch (error) {
            setIsError(true)
            setErrorMessage(t('An unexpected error occurred while calculating audio duration.'))
            setIsLoading(false)
            return
          }
        }
      }

      setIsError(false)
      setIsLoading(false)
      setDuration(totalDuration)
    })()
  }, [])

  return { duration, isLoading, isError, errorMessage }
}

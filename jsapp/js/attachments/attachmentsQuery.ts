import { useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchDelete } from '#/api'
import { endpoints } from '#/api.endpoints'

/**
 * Makes a request to endpoint that deletes a single attachment.
 *
 * Note: As a result, deleted attachment file(s) will be removed, and the attachment object (`SubmissionAttachment`)
 * will be marked with `is_deleted` flag.
 */
function removeAttachment(assetUid: string, submissionRootUuid: string, attachmentUid: string) {
  // TODO: remove this when BE is ready. For now we mock the delete request
  return new Promise<void>((resolve, reject) => {
    setTimeout(() => {
      // 1/3 of the time we fail:
      if (Math.random() < 1 / 3) {
        reject(new Error('MOCK Remove attachment failed'))
      } else {
        resolve()
      }
    }, 1000)
  })

  return fetchDelete(
    endpoints.ATTACHMENT_DETAIL_URL.replace(':asset_uid', assetUid)
      .replace(':submission_id', submissionRootUuid)
      .replace(':attachment_uid', attachmentUid),
  )
}

export function useRemoveAttachment(assetUid: string, submissionRootUuid: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (attachmentUid: string) => removeAttachment(assetUid, submissionRootUuid, attachmentUid),
    onSettled: () => {
      // TODO: successful removal of single attachment should cause a refresh of UI that uses submission data
      // TODO: when we migrate Data Table code to use query, we need to make sure we invalidate things here:
      queryClient.invalidateQueries({ queryKey: [] })
    },
  })
}

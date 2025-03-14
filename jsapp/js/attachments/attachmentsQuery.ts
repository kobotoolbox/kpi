import { useMutation, useQueryClient } from '@tanstack/react-query'
// import { fetchDelete } from '#/api'
// import { endpoints } from '#/api.endpoints'

/**
 * Makes a request to endpoint that deletes a single attachment.
 *
 * Note: As a result, deleted attachment file(s) will be removed, and the attachment object (`SubmissionAttachment`)
 * will be marked with `is_deleted` flag.
 */
function removeAttachment(assetUid: string, submissionId: string, attachmentUid: string) {
  // TODO: remove this when BE is ready. For now we mock the delete request
  return new Promise<void>((resolve, reject) => {
    setTimeout(() => {
      // 1/3 of the time we fail:
      if (Math.random() < 1 / 3) {
        reject(new Error('MOCK Remove attachment failed'))
        console.error('MOCK Remove attachment failed', assetUid, submissionId, attachmentUid)
      } else {
        resolve()
        console.log('MOCK Remove attachment succeeded', assetUid, submissionId, attachmentUid)
      }
    }, 1000)
  })

  // return fetchDelete(
  //   endpoints.ATTACHMENT_DETAIL_URL.replace(':asset_uid', assetUid)
  //     .replace(':submission_id', submissionId)
  //     .replace(':attachment_uid', attachmentUid),
  // )
}

export function useRemoveAttachment(assetUid: string, submissionId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (attachmentUid: string) => removeAttachment(assetUid, submissionId, attachmentUid),
    onSettled: () => {
      // TODO: successful removal of single attachment should cause a refresh of UI that uses submission data
      // TODO: when we migrate Data Table code to use query, we need to make sure we invalidate things here:
      queryClient.invalidateQueries({ queryKey: [] })
    },
  })
}

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchDelete } from '#/api'
import { endpoints } from '#/api.endpoints'

/**
 * Makes a request to endpoint that deletes a single attachment.
 *
 * Note: As a result, deleted attachment file(s) will be removed, and the attachment object (`SubmissionAttachment`)
 * will be marked with `is_deleted` flag.
 */
function removeAttachment(assetUid: string, attachmentUid: string) {
  return fetchDelete(endpoints.ATTACHMENT_BULK_URL.replace(':asset_uid', assetUid), {
    attachment_uids: [attachmentUid],
  })
}

/**
 * Makes a request to endpoint that deletes all attachments for a given submissions.
 *
 * Note: As a result, deleted attachment file(s) will be removed, and the attachment object (`SubmissionAttachment`)
 * will be marked with `is_deleted` flag.
 */
function removeBulkAttachments(assetUid: string, submissionIds: number[]) {
  // TODO: remove this when BE is ready. For now we mock the delete request
  return new Promise<void>((resolve, reject) => {
    setTimeout(() => {
      // 1/3 of the time we fail:
      if (Math.random() < 1 / 3) {
        reject(new Error('MOCK Remove bulk attachments failed'))
        console.error('MOCK Remove bulk attachments failed', assetUid, submissionIds)
      } else {
        resolve()
        console.log('MOCK Remove bulk attachments succeeded', assetUid, submissionIds)
      }
    }, 1000)
  })

  // return fetchDelete(
  //   endpoints.ATTACHMENT_DETAIL_BULK_URL.replace(':asset_uid', assetUid), {submissionIds: submissionIds},
  // )
}

export function useRemoveAttachment(assetUid: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (attachmentUid: string) => removeAttachment(assetUid, attachmentUid),
    onSettled: () => {
      // TODO: successful removal of single attachment should cause a refresh of UI that uses submission data. When we
      // migrate Data Table code to use query, we need to make sure we invalidate things here.
      // For now let's rely on components handling this themselves (e.g. by refetching data or using
      // `actions.resources.refreshTableSubmissions`)
      queryClient.invalidateQueries({ queryKey: [] })
    },
  })
}

export function useRemoveBulkAttachments(assetUid: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (submissionIds: number[]) => removeBulkAttachments(assetUid, submissionIds),
    onSettled: () => {
      // TODO: same as in `useRemoveAttachment` aboce.
      queryClient.invalidateQueries({ queryKey: [] })
    },
  })
}

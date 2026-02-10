import { useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchDelete } from '#/api'
import { endpoints } from '#/api.endpoints'

/**
 * Makes a request to endpoint that deletes all attachments for a given submissions.
 *
 * Note: As a result, deleted attachment file(s) will be removed, and the attachment object (`SubmissionAttachment`)
 * will be marked with `is_deleted` flag.
 */
function removeBulkAttachments(assetUid: string, submissionRootUuids: string[]) {
  return fetchDelete(endpoints.ATTACHMENT_BULK_URL.replace(':asset_uid', assetUid), {
    submission_root_uuids: submissionRootUuids,
  })
}

/**
 * A hook for removing all attachments from a list of submissions (`rootUuid`s)
 *
 * @deprecated - use react-query orval helpers instead. See DEV-1655
 */
export function useRemoveBulkAttachments(assetUid: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (submissionRootUuids: string[]) => removeBulkAttachments(assetUid, submissionRootUuids),
    onSettled: () => {
      // TODO: successful removal of single attachment should cause a refresh of UI that uses submission data. When we
      // migrate Data Table code to use query, we need to make sure we invalidate things here.
      // For now let's rely on components handling this themselves (e.g. by refetching data or using
      // `actions.resources.refreshTableSubmissions`)
      queryClient.invalidateQueries({ queryKey: [] })
    },
  })
}

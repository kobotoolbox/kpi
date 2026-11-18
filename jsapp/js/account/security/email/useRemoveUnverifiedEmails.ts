import { useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchWithAuth } from '#/api/orval.mutator'
import { getMeEmailsListQueryKey, getMeEmailsListUrl } from '#/api/react-query/user-team-organization-usage'

/**
 * Drops the account unverified addresses - in practice the single one awaiting confirmation.
 *
 * TODO: when DEV-3091 is done drop this and use `useMeEmailsDestroy` instead.
 */
export function useRemoveUnverifiedEmails() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey: ['meEmailsDestroy'],
    mutationFn: () => fetchWithAuth(getMeEmailsListUrl(), { method: 'DELETE' }),
    // Invalidated on failure too: resending deletes before it re-posts, so a failed POST must not leave a removed
    // address on screen.
    onSettled: () => queryClient.invalidateQueries({ queryKey: getMeEmailsListQueryKey() }),
  })
}

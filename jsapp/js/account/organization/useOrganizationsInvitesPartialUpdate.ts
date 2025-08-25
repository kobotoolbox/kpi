import {
  getOrganizationsInvitesListQueryKey,
  getOrganizationsInvitesRetrieveQueryKey,
  type organizationsInvitesListResponse,
  type organizationsInvitesRetrieveResponse,
  useOrganizationsInvitesPartialUpdate as useOrganizationsInvitesPartialUpdateRaw,
} from '#/api/react-query/organization-invites'
import { queryClient } from '#/query/queryClient'

/**
 * TODO: After https://github.com/orval-labs/orval/issues/2297 is resolved, move to a centralized configuration.
 */
export default function useOrganizationsInvitesPartialUpdate(options?: Parameters<typeof useOrganizationsInvitesPartialUpdateRaw>[0] ) {
  return useOrganizationsInvitesPartialUpdateRaw({
    mutation: {
      ...options?.mutation,
      onMutate: async ({ data, guid, organizationId }) => {
        // Optimistic update for invite list
        const queryKeyInviteList = getOrganizationsInvitesListQueryKey(organizationId)
        await queryClient.cancelQueries({ queryKey: queryKeyInviteList })
        const prevInviteList = queryClient.getQueryData<organizationsInvitesListResponse>(queryKeyInviteList)
        // @ts-expect-error schema: PatchedInvitePatchPayloadOneOf.status should be an enum, but is a string.
        queryClient.setQueryData<organizationsInvitesListResponse>(queryKeyInviteList, (prev) => {
          if (!prev) throw new Error('cannot optimistically update a cache that doesnt exist')
          if (prev.status === 404) throw new Error('cannot optimistically update a 404 response')
          return {
            ...prev,
            data: {
              ...prev.data,
              results: prev.data.results.map((invite) => ({
                ...invite,
                status: invite.url.includes(guid) && 'status' in data ? data.status : invite.status,
                invitee_role: invite.url.includes(guid) && 'role' in data ? data.role : invite.invitee_role,
              })),
            },
          }
        })

        // Optimistic update for invite
        const queryKeyInvite = getOrganizationsInvitesRetrieveQueryKey(organizationId, guid)
        await queryClient.cancelQueries({ queryKey: queryKeyInvite })
        const prevInvite = queryClient.getQueryData<organizationsInvitesRetrieveResponse>(queryKeyInvite)
        // @ts-expect-error schema: PatchedInvitePatchPayloadOneOf.status should be an enum, but is a string.
        queryClient.setQueryData<organizationsInvitesRetrieveResponse>(queryKeyInviteList, (prev) => {
          if (!prev) throw new Error('cannot optimistically update a cache that doesnt exist')
          if (prev.status === 404) throw new Error('cannot optimistically update a 404 response')
          return {
            ...prev,
            data: {
              ...prev.data,
              status: prev.data.url.includes(guid) && 'status' in data ? data.status : prev.data.status,
              invitee_role: prev.data.url.includes(guid) && 'role' in data ? data.role : prev.data.invitee_role,
            },
          }
        })

        return { prevInviteList, prevInvite }
      },
      onSettled: (_response, error, { organizationId, guid }, context) => {
        if (error) {
          if (context?.prevInviteList)
            queryClient.setQueryData(getOrganizationsInvitesListQueryKey(organizationId), context.prevInviteList)
          if (context?.prevInvite)
            queryClient.setQueryData(getOrganizationsInvitesRetrieveQueryKey(organizationId, guid), context.prevInvite)
        }
        queryClient.invalidateQueries({ queryKey: getOrganizationsInvitesListQueryKey(organizationId) })
        queryClient.invalidateQueries({
          queryKey: getOrganizationsInvitesRetrieveQueryKey(organizationId, guid),
        })
      },
    },
    request: {
      ...options?.request,
    },
  })
}

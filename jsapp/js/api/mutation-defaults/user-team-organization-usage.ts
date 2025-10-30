import {
  getOrganizationsInvitesCreateMutationOptions,
  getOrganizationsInvitesDestroyMutationOptions,
  getOrganizationsInvitesListQueryKey,
  getOrganizationsInvitesPartialUpdateMutationOptions,
  getOrganizationsInvitesRetrieveQueryKey,
  getOrganizationsListQueryKey,
  getOrganizationsMembersDestroyMutationOptions,
  getOrganizationsMembersListQueryKey,
  getOrganizationsMembersPartialUpdateMutationOptions,
  getOrganizationsMembersRetrieveQueryKey,
  getOrganizationsPartialUpdateMutationOptions,
  getOrganizationsRetrieveQueryKey,
  type organizationsInvitesRetrieveResponse,
  type organizationsMembersListResponse,
  type organizationsMembersRetrieveResponse,
} from '#/api/react-query/user-team-organization-usage'
import session from '#/stores/session'
import { getAssetUIDFromUrl } from '#/utils'
import { queryClient } from '../queryClient'
import { invalidateItem, invalidateList, optimisticallyUpdateItem, optimisticallyUpdateList } from './common'

queryClient.setMutationDefaults(
  getOrganizationsPartialUpdateMutationOptions().mutationKey!,
  getOrganizationsPartialUpdateMutationOptions({
    /**
     * Good simple example for a "invalidate only" approach.
     * Note that it's possible to optimistically update both the list and item (like below), but doesn't.
     */
    mutation: {
      onSettled: (_data, _error, variables) => {
        invalidateList(getOrganizationsListQueryKey())
        invalidateItem(getOrganizationsRetrieveQueryKey(variables.uidOrganization))
      },
    },
  }),
)

queryClient.setMutationDefaults(
  getOrganizationsInvitesCreateMutationOptions().mutationKey!,
  getOrganizationsInvitesCreateMutationOptions({
    /**
     * Good simple example for a "invalidate only" approach.
     * Note that:
     * - when creating an item then no need to invalidate any of existing items.
     * - when creating an item then invalidate member list as well, because KPI placeholds members based on invites.
     *
     * Also a good example when NOT to use optimistic updates, because:
     * - in current UI it would gain nothing to insert the single item cache
     * - it's impossible to guess the order of items in the lists, so don't even try
     */
    mutation: {
      onSettled: (_data, _error, variables) => {
        invalidateList(getOrganizationsInvitesListQueryKey(variables.uidOrganization))
        invalidateList(getOrganizationsMembersListQueryKey(variables.uidOrganization))
      },
    },
  }),
)
queryClient.setMutationDefaults(
  getOrganizationsInvitesDestroyMutationOptions().mutationKey!,
  getOrganizationsInvitesDestroyMutationOptions({
    /**
     * Good complex example for optimistic update approach.
     * Note that members are placeholded based on invites, thus need to handle list for both invites and members.
     * When dealing with more than one list and/or item, better name then specifically.
     */
    mutation: {
      onMutate: async ({ guid, uidOrganization }) => {
        // Note: `useOrganizationsInvitesList` is unused, skipping optimistically updating it.
        const invitesSnapshots: [readonly unknown[], unknown][] = []

        const membersSnapshots = await optimisticallyUpdateList<organizationsMembersListResponse>(
          getOrganizationsMembersListQueryKey(uidOrganization),
          (response) =>
            ({
              ...response,
              data: {
                ...response?.data,
                ...(response?.status === 200
                  ? {
                      results: response?.data.results.filter(
                        ({ invite }) => !invite?.url || getAssetUIDFromUrl(invite?.url) !== guid,
                      ),
                    }
                  : {}),
              },
            }) as organizationsMembersListResponse,
        )

        const inviteSnapshot = await optimisticallyUpdateItem(
          getOrganizationsInvitesRetrieveQueryKey(uidOrganization, guid),
          null,
        )

        return {
          snapshots: [...invitesSnapshots, ...membersSnapshots, inviteSnapshot],
        }
      },
    },
  }),
)
queryClient.setMutationDefaults(
  getOrganizationsInvitesPartialUpdateMutationOptions().mutationKey!,
  getOrganizationsInvitesPartialUpdateMutationOptions({
    /**
     * Good complex example for optimistic update approach.
     * Note that members are placeholded based on invites, thus need to handle list for both invites and members.
     * When dealing with more than one list and/or item, better name them specifically.
     */
    mutation: {
      onMutate: async ({ uidOrganization, guid, data }) => {
        // Note: `useOrganizationsInvitesList` is unused, skipping optimistically updating it.
        const invitesSnapshots: [readonly unknown[], unknown][] = []

        const membersSnapshots = await optimisticallyUpdateList<organizationsMembersListResponse>(
          getOrganizationsMembersListQueryKey(uidOrganization),
          (response) =>
            ({
              ...response,
              data: {
                ...response?.data,
                ...(response?.status === 200
                  ? {
                      results: response?.data.results.map((member) => ({
                        ...member,
                        invite: member.invite
                          ? {
                              ...member.invite,
                              invitee_role:
                                'role' in data && getAssetUIDFromUrl(member.invite.url) === guid
                                  ? data.role
                                  : member.invite.invitee_role,
                              status:
                                'status' in data && getAssetUIDFromUrl(member.invite.url) === guid
                                  ? data.status
                                  : member.invite.status,
                            }
                          : member.invite,
                      })),
                    }
                  : {}),
              },
            }) as organizationsMembersListResponse,
        )

        const inviteSnapshot = await optimisticallyUpdateItem<organizationsInvitesRetrieveResponse>(
          getOrganizationsInvitesRetrieveQueryKey(uidOrganization, guid),
          (response) =>
            ({
              ...response,
              data: {
                ...response?.data,
                ...(response?.status === 200
                  ? {
                      ...response?.data,
                      ...('role' in data ? { invitee_role: data.role } : null),
                      ...('status' in data ? { status: data.status } : null),
                    }
                  : {}),
              },
            }) as organizationsInvitesRetrieveResponse,
        )

        return {
          snapshots: [...invitesSnapshots, ...membersSnapshots, inviteSnapshot],
        }
      },
    },
  }),
)

queryClient.setMutationDefaults(
  getOrganizationsMembersDestroyMutationOptions().mutationKey!,
  getOrganizationsMembersDestroyMutationOptions({
    /**
     * Good simple example for optimistic update approach. Note that usually have to handle 1 list and 1 item.
     */
    mutation: {
      onMutate: async ({ uidOrganization, username }) => {
        const listSnapshots = await optimisticallyUpdateList<organizationsMembersListResponse>(
          getOrganizationsMembersListQueryKey(uidOrganization),
          (response) =>
            ({
              ...response,
              data: {
                ...response?.data,
                ...(response?.status === 200
                  ? {
                      results: response?.data.results.filter((member) => member.user__username !== username),
                    }
                  : {}),
              },
            }) as organizationsMembersListResponse,
        )

        const memberSnapshot = await optimisticallyUpdateItem<organizationsMembersRetrieveResponse>(
          getOrganizationsMembersRetrieveQueryKey(uidOrganization, username),
          null,
        )

        return {
          snapshots: [...listSnapshots, memberSnapshot],
        }
      },
      onSuccess: (_data, { username }) => {
        // If user is removing themselves, we need to clear the session
        if (username === session.currentAccount?.username) session.refreshAccount()
      },
    },
  }),
)
queryClient.setMutationDefaults(
  getOrganizationsMembersPartialUpdateMutationOptions().mutationKey!,
  getOrganizationsMembersPartialUpdateMutationOptions({
    /**
     * Good simple example for optimistic update approach. Note that usually have to handle 1 list and 1 item.
     */
    mutation: {
      onMutate: async ({ uidOrganization, username, data: { role } }) => {
        if (!role) return

        const listSnapshots = await optimisticallyUpdateList<organizationsMembersListResponse>(
          getOrganizationsMembersListQueryKey(uidOrganization),
          (response) =>
            ({
              ...response,
              data: {
                ...response?.data,
                ...(response?.status === 200
                  ? {
                      results: response?.data.results.map((member) => ({
                        ...member,
                        role: member.user__username === username ? role : member.role,
                      })),
                    }
                  : {}),
              },
            }) as organizationsMembersListResponse,
        )

        const memberSnapshot = await optimisticallyUpdateItem<organizationsMembersRetrieveResponse>(
          getOrganizationsMembersRetrieveQueryKey(uidOrganization, username),
          (response) =>
            ({
              ...response,
              data: {
                ...response?.data,
                ...(response?.status === 200 ? { role: role } : {}),
              },
            }) as organizationsMembersRetrieveResponse,
        )

        return {
          snapshots: [...listSnapshots, memberSnapshot],
        }
      },
    },
  }),
)

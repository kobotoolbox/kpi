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
  type organizationsInvitesListResponse,
  type organizationsInvitesRetrieveResponse,
  type organizationsMembersListResponse,
  type organizationsMembersListResponse200,
  type organizationsMembersRetrieveResponse,
} from '#/api/react-query/user-team-organization-usage'
import { queryClient } from '#/query/queryClient'
import session from '#/stores/session'
import { getAssetUIDFromUrl } from '#/utils'
import {
  filterListSnapshots,
  invalidateItem,
  invalidateList,
  onErrorRestoreSnapshots,
  onSettledInvalidateSnapshots,
} from './common'

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
     * Good simple example for optimistic update approach. Note that usually have to handle 1 list and 1 item.
     */
    mutation: {
      onMutate: async ({ guid, uidOrganization }) => {
        const listSnapshots = queryClient
          .getQueriesData<organizationsMembersListResponse>({
            queryKey: getOrganizationsInvitesListQueryKey(uidOrganization),
            exact: false,
          })
          .filter(filterListSnapshots)
        for (const [listSnapshotKey] of listSnapshots) {
          await queryClient.cancelQueries({ queryKey: listSnapshotKey })
          queryClient.setQueryData<organizationsInvitesListResponse>(
            listSnapshotKey,
            (response) =>
              ({
                ...response,
                data: {
                  ...response?.data,
                  ...(response?.status === 200
                    ? {
                        results: response?.data.results.filter((invite) => getAssetUIDFromUrl(invite.url) !== guid),
                      }
                    : {}),
                },
              }) as organizationsInvitesListResponse,
          )
        }

        const itemKey = getOrganizationsInvitesRetrieveQueryKey(uidOrganization, guid)
        const itemSnapshot = queryClient.getQueryData<organizationsInvitesRetrieveResponse>(itemKey)
        await queryClient.cancelQueries({ queryKey: itemKey })
        queryClient.removeQueries({ queryKey: itemKey, exact: true })

        return {
          snapshots: [...listSnapshots, [itemKey, itemSnapshot] as const],
        }
      },
      onError: onErrorRestoreSnapshots,
      onSettled: onSettledInvalidateSnapshots,
    },
  }),
)
queryClient.setMutationDefaults(
  getOrganizationsInvitesPartialUpdateMutationOptions().mutationKey!,
  getOrganizationsInvitesPartialUpdateMutationOptions({
    /**
     * Good complex example for optimistic update approach.
     * Note that members are placeholded based on invites, thus need to handle list and item for both invite and member.
     */
    mutation: {
      onMutate: async ({ uidOrganization, guid, data }) => {
        if (!('status' in data) && !('role' in data)) return

        // Note: `useOrganizationsInvitesList` is unused, skipping optimistically updating it.

        const listSnapshots = queryClient
          .getQueriesData<organizationsMembersListResponse>({
            queryKey: getOrganizationsMembersListQueryKey(uidOrganization),
            exact: false,
          })
          .filter(filterListSnapshots)
        for (const [listSnapshotKey] of listSnapshots) {
          await queryClient.cancelQueries({ queryKey: listSnapshotKey })
          queryClient.setQueryData<organizationsMembersListResponse>(
            listSnapshotKey,
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
        }

        const itemKeyInvite = getOrganizationsInvitesRetrieveQueryKey(uidOrganization, guid)
        const itemSnapshotInvite = queryClient.getQueryData<organizationsInvitesRetrieveResponse>(itemKeyInvite)
        await queryClient.cancelQueries({ queryKey: itemKeyInvite })
        queryClient.setQueryData<organizationsInvitesRetrieveResponse>(
          itemKeyInvite,
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

        const itemKeyMember = getOrganizationsInvitesRetrieveQueryKey(uidOrganization, guid)
        const itemSnapshotMember = queryClient.getQueryData<organizationsMembersRetrieveResponse>(itemKeyMember)
        await queryClient.cancelQueries({ queryKey: itemKeyMember })
        queryClient.setQueryData<organizationsMembersRetrieveResponse>(
          itemKeyMember,
          (response) =>
            ({
              ...response,
              data: {
                ...response?.data,
                ...(response?.status === 200
                  ? {
                      invite: response?.data.invite
                        ? {
                            ...response?.data.invite,
                            ...('role' in data ? { invitee_role: data.role } : null),
                            ...('status' in data ? { status: data.status } : null),
                          }
                        : response?.data.invite,
                    }
                  : {}),
              },
            }) as organizationsMembersRetrieveResponse,
        )

        return {
          snapshots: [
            ...listSnapshots,
            [itemKeyInvite, itemSnapshotInvite] as const,
            [itemKeyMember, itemSnapshotMember] as const,
          ],
        }
      },
      onError: onErrorRestoreSnapshots,
      onSettled: onSettledInvalidateSnapshots,
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
        const listSnapshots = queryClient
          .getQueriesData<organizationsMembersListResponse200>({
            queryKey: getOrganizationsMembersListQueryKey(uidOrganization),
            exact: false,
          })
          .filter(filterListSnapshots)
        for (const [listSnapshotKey] of listSnapshots) {
          await queryClient.cancelQueries({ queryKey: listSnapshotKey })
          queryClient.setQueryData<organizationsMembersListResponse>(
            listSnapshotKey,
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
        }

        const itemKey = getOrganizationsMembersRetrieveQueryKey(uidOrganization, username)
        const itemSnapshot = queryClient.getQueryData<organizationsMembersListResponse200>(itemKey)
        await queryClient.cancelQueries({ queryKey: itemKey })
        queryClient.removeQueries({ queryKey: itemKey, exact: true })

        return {
          snapshots: [...listSnapshots, [itemKey, itemSnapshot] as const],
        }
      },
      onSuccess: (_data, { username }) => {
        // If user is removing themselves, we need to clear the session
        if (username === session.currentAccount?.username) session.refreshAccount()
      },
      onError: onErrorRestoreSnapshots,
      onSettled: onSettledInvalidateSnapshots,
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

        const listSnapshots = queryClient
          .getQueriesData<organizationsMembersListResponse>({
            queryKey: getOrganizationsMembersListQueryKey(uidOrganization),
            exact: false,
          })
          .filter(filterListSnapshots)
        for (const [listSnapshotKey] of listSnapshots) {
          await queryClient.cancelQueries({ queryKey: listSnapshotKey })
          queryClient.setQueryData<organizationsMembersListResponse>(
            listSnapshotKey,
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
        }

        const itemKey = getOrganizationsMembersRetrieveQueryKey(uidOrganization, username)
        const itemSnapshot = queryClient.getQueryData<organizationsMembersRetrieveResponse>(itemKey)
        await queryClient.cancelQueries({ queryKey: itemKey })
        queryClient.setQueryData<organizationsMembersRetrieveResponse>(
          itemKey,
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
          snapshots: [...listSnapshots, [itemKey, itemSnapshot] as const],
        }
      },
      onError: onErrorRestoreSnapshots,
      onSettled: onSettledInvalidateSnapshots,
    },
  }),
)

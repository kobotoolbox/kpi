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
import { filterListSnapshots, onErrorRestoreSnapshots, onSettledInvalidateKeys } from './common'

queryClient.setMutationDefaults(
  getOrganizationsPartialUpdateMutationOptions().mutationKey!,
  getOrganizationsPartialUpdateMutationOptions({
    mutation: {
      onSettled: (_data, _error, variables) => {
        queryClient.invalidateQueries({ queryKey: getOrganizationsListQueryKey() })
        // Note: invalidate ALL members because username isn't available in scope to select the exact member.
        queryClient.invalidateQueries({ queryKey: getOrganizationsRetrieveQueryKey(variables.uidOrganization) })
      },
    },
  }),
)

queryClient.setMutationDefaults(
  getOrganizationsInvitesCreateMutationOptions().mutationKey!,
  getOrganizationsInvitesCreateMutationOptions({
    mutation: {
      onSettled: (data, _error, variables) => {
        queryClient.invalidateQueries({ queryKey: getOrganizationsInvitesListQueryKey(variables.uidOrganization) })
        if (data?.status === 201) {
          for (const invite of data.data) {
            queryClient.invalidateQueries({
              queryKey: getOrganizationsInvitesRetrieveQueryKey(
                variables.uidOrganization,
                getAssetUIDFromUrl(invite.url)!,
              ),
            })
          }
        }
        queryClient.invalidateQueries({ queryKey: getOrganizationsMembersListQueryKey(variables.uidOrganization) })
        // Note: invalidate ALL members because username isn't available in scope to select the exact member.
        queryClient.invalidateQueries({
          queryKey: getOrganizationsMembersRetrieveQueryKey(variables.uidOrganization, 'unknown').slice(0, -1),
        })
      },
    },
  }),
)
queryClient.setMutationDefaults(
  getOrganizationsInvitesDestroyMutationOptions().mutationKey!,
  getOrganizationsInvitesDestroyMutationOptions({
    mutation: {
      onMutate: async ({ guid, uidOrganization }) => {
        const listKey = getOrganizationsInvitesListQueryKey(uidOrganization)
        const listSnapshots = queryClient
          .getQueriesData<organizationsMembersListResponse>({
            queryKey: listKey,
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
        await queryClient.cancelQueries({ queryKey: itemKey })
        const itemSnapshot = queryClient.getQueryData<organizationsInvitesRetrieveResponse>(itemKey)
        queryClient.removeQueries({ queryKey: itemKey, exact: true })

        return {
          keys: [listSnapshots.map(([listSnapshotKey]) => listSnapshotKey), itemKey],
          snapshots: [...listSnapshots, [itemKey, itemSnapshot] as const],
        }
      },
      onError: onErrorRestoreSnapshots,
      onSettled: onSettledInvalidateKeys,
    },
  }),
)
queryClient.setMutationDefaults(
  getOrganizationsInvitesPartialUpdateMutationOptions().mutationKey!,
  getOrganizationsInvitesPartialUpdateMutationOptions({
    mutation: {
      onMutate: async ({ uidOrganization, guid, data }) => {
        if (!('status' in data) && !('role' in data)) return

        // Note: `useOrganizationsInvitesList` is unused, skipping optimistically updating it.

        // If we are updating the invitee's role, we want to optimistically update their role in queries for
        // the members table list. So we look for their unique invite url and update the relevant query accordingly
        const listKey = getOrganizationsMembersListQueryKey(uidOrganization)
        const listSnapshots = queryClient
          .getQueriesData<organizationsMembersListResponse>({
            queryKey: listKey,
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

        const itemKey = getOrganizationsInvitesRetrieveQueryKey(uidOrganization, guid)
        const itemSnapshot = queryClient.getQueryData<organizationsMembersRetrieveResponse>(itemKey)
        await queryClient.cancelQueries({ queryKey: itemKey })
        queryClient.setQueryData<organizationsMembersRetrieveResponse>(
          itemKey,
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
          keys: [listSnapshots.map(([listSnapshotKey]) => listSnapshotKey), itemKey],
          snapshots: [...listSnapshots, [itemKey, itemSnapshot] as const],
        }
      },
      onError: onErrorRestoreSnapshots,
      onSettled: onSettledInvalidateKeys,
    },
  }),
)

queryClient.setMutationDefaults(
  getOrganizationsMembersDestroyMutationOptions().mutationKey!,
  getOrganizationsMembersDestroyMutationOptions({
    mutation: {
      onMutate: async ({ uidOrganization, username }) => {
        const listKey = getOrganizationsMembersListQueryKey(uidOrganization)
        const listSnapshots = queryClient
          .getQueriesData<organizationsMembersListResponse200>({
            queryKey: listKey,
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
          keys: [listKey, itemKey],
          snapshots: [...listSnapshots, [itemKey, itemSnapshot] as const],
        }
      },
      onSuccess: (_data, { username }) => {
        // If user is removing themselves, we need to clear the session
        if (username === session.currentAccount?.username) session.refreshAccount()
      },
      onError: onErrorRestoreSnapshots,
      onSettled: onSettledInvalidateKeys,
    },
  }),
)
queryClient.setMutationDefaults(
  getOrganizationsMembersPartialUpdateMutationOptions().mutationKey!,
  getOrganizationsMembersPartialUpdateMutationOptions({
    mutation: {
      onMutate: async ({ uidOrganization, username, data: { role } }) => {
        if (!role) return

        const listKey = getOrganizationsMembersListQueryKey(uidOrganization)
        const listSnapshots = queryClient
          .getQueriesData<organizationsMembersListResponse>({
            queryKey: listKey,
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
          keys: [listKey, itemKey],
          snapshots: [...listSnapshots, [itemKey, itemSnapshot] as const],
        }
      },
      onError: onErrorRestoreSnapshots,
      onSettled: onSettledInvalidateKeys,
    },
  }),
)

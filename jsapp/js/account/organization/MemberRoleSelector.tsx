import { LoadingOverlay } from '@mantine/core'
import { InviteeRoleEnum } from '#/api/models/inviteeRoleEnum'
import type { MemberListResponse } from '#/api/models/memberListResponse'
import type { MemberRoleEnum } from '#/api/models/memberRoleEnum'
import {
  getOrganizationsInvitesListQueryKey,
  getOrganizationsInvitesRetrieveQueryKey,
  useOrganizationsInvitesPartialUpdate,
} from '#/api/react-query/organization-invites'
import {
  getOrganizationsMembersListQueryKey,
  getOrganizationsMembersRetrieveQueryKey,
  type organizationsMembersListResponse200,
  type organizationsMembersRetrieveResponse200,
  useOrganizationsMembersPartialUpdate,
} from '#/api/react-query/organization-members'
import { useOrganizationAssumed } from '#/api/useOrganizationAssumed'
import Select from '#/components/common/Select'
import { queryClient } from '#/query/queryClient'

interface MemberRoleSelectorProps {
  username: string
  /** The role of the `username` user - the one we are modifying here. */
  role: InviteeRoleEnum
  /** The role of the currently logged in user. */
  currentUserRole: MemberRoleEnum
  /** URL for patching org member invites. Should only be passed if invite is still open */
  inviteUrl?: string
}

export default function MemberRoleSelector({ username, role, inviteUrl }: MemberRoleSelectorProps) {
  const [organization] = useOrganizationAssumed()

  const queryKeyList = getOrganizationsMembersListQueryKey(organization.id)
  const queryKeyMember = getOrganizationsMembersRetrieveQueryKey(organization.id, username)
  const patchMember = useOrganizationsMembersPartialUpdate({
    mutation: {
      onMutate: async ({ userUsername, data: { role } }) => {
        console.log('onMutate', { userUsername, data: { role } })
        if (!role) return

        const snapshotList = queryClient.getQueryData<organizationsMembersListResponse200>(queryKeyList)
        console.log(snapshotList) // undefined and will crash, because TODO: use generated queries.
        await queryClient.cancelQueries({ queryKey: queryKeyList })
        queryClient.setQueryData<organizationsMembersListResponse200['data']>(queryKeyList, (members) => ({
          ...members!,
          results: members!.results.map((member) => ({
            ...member,
            role: member.user__username === userUsername ? role : member.role,
          })),
        }))

        const snapshotMember = queryClient.getQueryData<organizationsMembersListResponse200>(queryKeyMember)
        await queryClient.cancelQueries({ queryKey: queryKeyMember })
        queryClient.setQueryData<organizationsMembersRetrieveResponse200['data']>(queryKeyMember, (member) => ({
          ...member!,
          role,
        }))

        return { snapshotList, snapshotMember }
      },
      onError: (_error, _variables, context) => {
        console.log('onError', _error, _variables, context)
        if (!context) return
        queryClient.setQueryData(queryKeyList, context.snapshotList)
        queryClient.setQueryData(queryKeyMember, context.snapshotMember)
      },
      onSettled: () => {
        console.log('onSettled')
        queryClient.invalidateQueries({ queryKey: queryKeyList })
        queryClient.invalidateQueries({ queryKey: queryKeyMember })
      },
    },
  })
  const orgInvitesPatchMutation = useOrganizationsInvitesPartialUpdate({
    mutation: {
      onSuccess: (_data, variables) => {
        queryClient.invalidateQueries({ queryKey: getOrganizationsInvitesListQueryKey(variables.organizationId) })
        queryClient.invalidateQueries({
          queryKey: getOrganizationsInvitesRetrieveQueryKey(variables.organizationId, variables.guid),
        })
        queryClient.invalidateQueries({ queryKey: getOrganizationsMembersListQueryKey(variables.organizationId) })
        // Note: invalidate ALL members because username isn't available in scope to select the exact member.
        queryClient.invalidateQueries({ queryKey: getOrganizationsMembersRetrieveQueryKey(variables.organizationId, 'unknown').slice(0, -1) })
      },
      onMutate: async ({ data, organizationId }) => {
        if (!('role' in data)) return

        // If we are updating the invitee's role, we want to optimistically update their role in queries for
        // the members table list. So we look for their unique invite url and update the relevant query accordingly
        const qData = queryClient.getQueriesData({ queryKey: getOrganizationsMembersListQueryKey(organizationId) })
        const query = qData.find((q) =>
          (q[1] as any)?.results?.find((m: MemberListResponse) => m.invite?.url === inviteUrl),
        )

        if (!query) return

        const queryKey = query[0]
        const queryData = query[1]
        const item = (queryData as any).results.find((m: MemberListResponse) => m.invite?.url === inviteUrl)

        item.invite.invitee_role = data.role
        queryClient.setQueryData(queryKey, queryData)
      },
    },
    request: {
      errorMessageDisplay: t('There was an error updating this invitation.'),
    },
  })

  const handleRoleChange = (role: InviteeRoleEnum | null) => {
    if (!role) return

    if (inviteUrl) {
      orgInvitesPatchMutation.mutateAsync({
        guid: inviteUrl.slice(0, -1).split('/').pop()!,
        organizationId: organization.id,
        data: { role },
      })
    } else {
      patchMember.mutateAsync({ organizationId: organization.id, userUsername: username, data: { role } })
    }
  }

  return (
    <>
      <LoadingOverlay visible={patchMember.isPending || orgInvitesPatchMutation.isPending} />
      <Select
        size='sm'
        data={[
          {
            value: InviteeRoleEnum.admin,
            label: t('Admin'),
          },
          {
            value: InviteeRoleEnum.member,
            label: t('Member'),
          },
        ]}
        value={role}
        onChange={handleRoleChange}
      />
    </>
  )
}

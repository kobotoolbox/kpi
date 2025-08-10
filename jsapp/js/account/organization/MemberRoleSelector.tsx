import { LoadingOverlay } from '@mantine/core'
import {
  getOrganizationsInvitesListQueryKey,
  getOrganizationsInvitesRetrieveQueryKey,
  useOrganizationsInvitesPartialUpdate,
} from '#/api/react-query/organization-invites'
import Select from '#/components/common/Select'
import { queryClient } from '#/query/queryClient'
import { QueryKeys } from '#/query/queryKeys'
import { inviteGuidFromUrl } from './common'
import { type OrganizationMemberListItem, usePatchOrganizationMember } from './membersQuery'
import { OrganizationUserRole, useOrganizationQuery } from './organizationQuery'

interface MemberRoleSelectorProps {
  username: string
  /** The role of the `username` user - the one we are modifying here. */
  role: OrganizationUserRole
  /** The role of the currently logged in user. */
  currentUserRole: OrganizationUserRole
  /** URL for patching org member invites. Should only be passed if invite is still open */
  inviteUrl?: string
}

export default function MemberRoleSelector({ username, role, inviteUrl }: MemberRoleSelectorProps) {
  const orgQuery = useOrganizationQuery()
  const organizationId = orgQuery.data?.id

  const patchMember = usePatchOrganizationMember(username)

  const orgInvitesPatchMutation = useOrganizationsInvitesPartialUpdate({
    mutation: {
      onSuccess: (_data, variables) => {
        queryClient.invalidateQueries({ queryKey: getOrganizationsInvitesListQueryKey(variables.organizationId) })
        queryClient.invalidateQueries({
          queryKey: getOrganizationsInvitesRetrieveQueryKey(variables.organizationId, variables.guid),
        })
        queryClient.invalidateQueries({ queryKey: [QueryKeys.organizationMembers] })
        queryClient.invalidateQueries({ queryKey: [QueryKeys.organizationMemberDetail] })
      },
      onMutate: async ({ data }) => {
        if (!('role' in data)) return

        // If we are updating the invitee's role, we want to optimistically update their role in queries for
        // the members table list. So we look for their unique invite url and update the relevant query accordingly
        const qData = queryClient.getQueriesData({ queryKey: [QueryKeys.organizationMembers] })
        const query = qData.find((q) =>
          (q[1] as any)?.results?.find((m: OrganizationMemberListItem) => m.invite?.url === inviteUrl),
        )

        if (!query) return

        const queryKey = query[0]
        const queryData = query[1]
        const item = (queryData as any).results.find((m: OrganizationMemberListItem) => m.invite?.url === inviteUrl)

        item.invite.invitee_role = data.role
        queryClient.setQueryData(queryKey, queryData)
      },
    },
    request: {
      errorMessageDisplay: t('There was an error updating this invitation.'),
    },
  })

  const handleRoleChange = (newRole: string | null) => {
    if (!organizationId) return
    if (!newRole) return
    const role = newRole as OrganizationUserRole

    if (inviteUrl) {
      orgInvitesPatchMutation.mutateAsync({
        guid: inviteGuidFromUrl(inviteUrl),
        organizationId,
        data: { role },
      })
    } else {
      patchMember.mutateAsync({ role })
    }
  }

  return (
    <>
      <LoadingOverlay visible={patchMember.isPending || orgInvitesPatchMutation.isPending} />
      <Select
        size='sm'
        data={[
          {
            value: OrganizationUserRole.admin,
            label: t('Admin'),
          },
          {
            value: OrganizationUserRole.member,
            label: t('Member'),
          },
        ]}
        value={role}
        onChange={handleRoleChange}
      />
    </>
  )
}

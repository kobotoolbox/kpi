import { LoadingOverlay } from '@mantine/core'
import Select from '#/components/common/Select'
import { inviteGuidFromUrl } from './common'
import { usePatchOrganizationMember } from './membersQuery'
import { OrganizationUserRole, useOrganizationQuery } from './organizationQuery'
import useOrganizationsInvitesPartialUpdate from './useOrganizationsInvitesPartialUpdate'

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

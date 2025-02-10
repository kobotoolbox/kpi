import { Select } from 'jsapp/js/components/common/Select'
import { usePatchOrganizationMember } from './membersQuery'
import { usePatchMemberInvite } from './membersInviteQuery'
import { OrganizationUserRole } from './organizationQuery'
import { LoadingOverlay } from '@mantine/core'

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
  const patchMember = usePatchOrganizationMember(username)
  const patchInvite = usePatchMemberInvite(inviteUrl)

  const handleRoleChange = (newRole: string | null) => {
    if (newRole) {
      const role = newRole as OrganizationUserRole
      if (!inviteUrl) {
        patchMember.mutateAsync({ role })
      }
      patchInvite.mutateAsync({ role })
    }
  }

  return (
    <>
      <LoadingOverlay visible={patchMember.isPending} />
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

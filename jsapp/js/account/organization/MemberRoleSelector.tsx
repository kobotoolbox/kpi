import { LoadingOverlay } from '@mantine/core'
import type { InviteeRoleEnum } from '#/api/models/inviteeRoleEnum'
import Select from '#/components/common/Select'
import { inviteGuidFromUrl } from './common'
import { usePatchOrganizationMember } from './membersQuery'
import { OrganizationUserRole, useOrganizationQuery } from './organizationQuery'
import useOrganizationsInvitesPartialUpdate from './useOrganizationsInvitesPartialUpdate'

interface MemberRoleSelectorProps {
  username: string
  /** The role of the `username` user - the one we are modifying here. */
  role: OrganizationUserRole | InviteeRoleEnum
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

  const handleRoleChange = (newRole: OrganizationUserRole | InviteeRoleEnum | null) => {
    if (!organizationId) return
    if (!newRole) return

    if (inviteUrl) {
      orgInvitesPatchMutation.mutateAsync({
        guid: inviteGuidFromUrl(inviteUrl),
        organizationId,
        data: { role: newRole as InviteeRoleEnum },
      })
    } else {
      patchMember.mutateAsync({ role: newRole as OrganizationUserRole })
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

import { LoadingOverlay } from '@mantine/core'
import { InviteeRoleEnum } from '#/api/models/inviteeRoleEnum'
import type { MemberRoleEnum } from '#/api/models/memberRoleEnum'
import {
  useOrganizationsInvitesPartialUpdate,
  useOrganizationsMembersPartialUpdate,
} from '#/api/react-query/user-team-organization-usage'
import { useOrganizationAssumed } from '#/api/useOrganizationAssumed'
import Select from '#/components/common/Select'
import { getAssetUIDFromUrl } from '#/utils'

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

  const orgMembersPatch = useOrganizationsMembersPartialUpdate()
  const orgInvitesPatch = useOrganizationsInvitesPartialUpdate({
    request: {
      errorMessageDisplay: t('There was an error updating this invitation.'),
    },
  })

  const handleRoleChange = async (role: InviteeRoleEnum | null) => {
    if (!role) return

    if (inviteUrl) {
      await orgInvitesPatch.mutateAsync({
        guid: getAssetUIDFromUrl(inviteUrl)!,
        uidOrganization: organization.id,
        data: { role },
      })
    } else {
      await orgMembersPatch.mutateAsync({ uidOrganization: organization.id, username: username, data: { role } })
    }
  }

  return (
    <>
      <LoadingOverlay visible={orgMembersPatch.isPending || orgInvitesPatch.isPending} />
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

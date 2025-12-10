import { LoadingOverlay } from '@mantine/core'
import { InviteeRoleEnum } from '#/api/models/inviteeRoleEnum'
import type { MemberRoleEnum } from '#/api/models/memberRoleEnum'
import {
  useOrganizationsInvitesPartialUpdate,
  useOrganizationsMembersPartialUpdate,
} from '#/api/react-query/user-team-organization-usage'
import { useOrganizationAssumed } from '#/api/useOrganizationAssumed'
import Select from '#/components/common/Select'
import { getAssetUIDFromUrl, notify } from '#/utils'

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

  const orgMembersPatch = useOrganizationsMembersPartialUpdate({})
  const orgInvitesPatch = useOrganizationsInvitesPartialUpdate({
    mutation: {
      onError: () => notify(t('There was an error updating this invitation.'), 'error'), // TODO: update message in backend (DEV-1218).
    },
  })

  const handleRoleChange = async (role: InviteeRoleEnum | null) => {
    if (!role) return

    if (inviteUrl) {
      orgInvitesPatch.mutate({
        uidOrganization: organization.id,
        guid: getAssetUIDFromUrl(inviteUrl)!,
        data: { role },
      })
    } else {
      orgMembersPatch.mutate({ uidOrganization: organization.id, username: username, data: { role } })
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

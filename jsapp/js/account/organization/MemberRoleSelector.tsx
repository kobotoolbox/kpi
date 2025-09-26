import { LoadingOverlay } from '@mantine/core'
import { MemberRoleEnum } from '#/api/models/memberRoleEnum'
import Select from '#/components/common/Select'
import { usePatchMemberInvite } from './membersInviteQuery'
import { usePatchOrganizationMember } from './membersQuery'

interface MemberRoleSelectorProps {
  username: string
  /** The role of the `username` user - the one we are modifying here. */
  role: MemberRoleEnum
  /** The role of the currently logged in user. */
  currentUserRole: MemberRoleEnum
  /** URL for patching org member invites. Should only be passed if invite is still open */
  inviteUrl?: string
}

export default function MemberRoleSelector({ username, role, inviteUrl }: MemberRoleSelectorProps) {
  const patchMember = usePatchOrganizationMember(username)
  const patchInvite = usePatchMemberInvite(inviteUrl)

  const handleRoleChange = (newRole: MemberRoleEnum | null) => {
    if (!newRole) return

    if (inviteUrl) {
      patchInvite.mutateAsync({ role })
    } else {
      patchMember.mutateAsync({ role })
    }
  }

  return (
    <>
      <LoadingOverlay visible={patchMember.isPending || patchInvite.isPending} />
      <Select
        size='sm'
        data={[
          {
            value: MemberRoleEnum.admin,
            label: t('Admin'),
          },
          {
            value: MemberRoleEnum.member,
            label: t('Member'),
          },
        ]}
        value={role}
        // TODO: parameterize <Select/> to infer values from data property.
        onChange={(value) => handleRoleChange(value as MemberRoleEnum | null)}
      />
    </>
  )
}

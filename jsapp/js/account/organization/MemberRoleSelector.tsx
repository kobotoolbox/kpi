import {Select} from 'jsapp/js/components/common/Select';
import {usePatchOrganizationMember} from './membersQuery';
import {OrganizationUserRole} from './organizationQuery';
import {LoadingOverlay} from '@mantine/core';

interface MemberRoleSelectorProps {
  username: string;
  /** The role of the `username` user - the one we are modifying here. */
  role: OrganizationUserRole;
  /** The role of the currently logged in user. */
  currentUserRole: OrganizationUserRole;
}

export default function MemberRoleSelector({
  username,
  role,
}: MemberRoleSelectorProps) {
  const patchMember = usePatchOrganizationMember(username);

  const handleRoleChange = (newRole: string | null) => {
    if (newRole) {
      patchMember.mutateAsync({role: newRole as OrganizationUserRole});
    }
  };

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
  );
}

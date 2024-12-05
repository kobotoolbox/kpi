import KoboSelect from 'jsapp/js/components/common/koboSelect';
import {usePatchOrganizationMember} from './membersQuery';
import {OrganizationUserRole} from './organizationQuery';

interface MemberRoleSelectorProps {
  username: string;
  role: OrganizationUserRole;
}

export default function MemberRoleSelector(
  {username, role}: MemberRoleSelectorProps
) {
  const patchMember = usePatchOrganizationMember(username);

  return (
    <KoboSelect
      name={`member-role-selector-${username}`}
      type='outline'
      size='m'
      options={[
        {
          value: OrganizationUserRole.admin,
          label: t('Admin'),
        },
        {
          value: OrganizationUserRole.member,
          label: t('Member'),
        },
      ]}
      selectedOption={role}
      onChange={(newRole: string | null) => {
        if (newRole !== null) {
          patchMember.mutateAsync({role: newRole as OrganizationUserRole});
        }
      }}
      isPending={patchMember.isPending}
    />
  );
}

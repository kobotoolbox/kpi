// Partial components
import KoboSelect from 'jsapp/js/components/common/koboSelect';

// Constants and types
import {OrganizationUserRole} from './organizationQuery';

interface MemberRoleSelectorProps {
  username: string;
  role: OrganizationUserRole;
  onRequestRoleChange: (username: string, role: OrganizationUserRole) => void;
}

export default function MemberRoleSelector(
  {username, role, onRequestRoleChange}: MemberRoleSelectorProps
) {
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
          onRequestRoleChange(username, newRole as OrganizationUserRole);
        }
      }}
    />
  );
}

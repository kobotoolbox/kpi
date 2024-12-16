import KoboSelect from 'jsapp/js/components/common/koboSelect';
import {usePatchOrganizationMember} from './membersQuery';
import {OrganizationUserRole} from './organizationQuery';
import {type KoboDropdownPlacement} from 'jsapp/js/components/common/koboDropdown';

interface MemberRoleSelectorProps {
  username: string;
  /** The role of the `username` user - the one we are modifying here. */
  role: OrganizationUserRole;
  /** The role of the currently logged in user. */
  currentUserRole: OrganizationUserRole;
  placement: KoboDropdownPlacement;
}

export default function MemberRoleSelector(
  {username, role, currentUserRole, placement}: MemberRoleSelectorProps
) {
  const patchMember = usePatchOrganizationMember(username);

  const canModifyRole = (
    currentUserRole === 'owner' ||
    currentUserRole === 'admin'
  );

  return (
    <KoboSelect
      name={`member-role-selector-${username}`}
      type='outline'
      size='m'
      placement={placement}
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
        if (newRole) {
          patchMember.mutateAsync({role: newRole as OrganizationUserRole});
        }
      }}
      isPending={patchMember.isPending}
      isDisabled={!canModifyRole}
    />
  );
}

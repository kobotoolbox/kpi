import KoboSelect from 'jsapp/js/components/common/koboSelect';
import {usePatchOrganizationMember} from './membersQuery';
import {OrganizationUserRole} from './organizationQuery';
import {type KoboDropdownPlacement} from 'jsapp/js/components/common/koboDropdown';
import {LoadingOverlay, Select} from '@mantine/core';
import { disabled } from 'jsapp/js/project/projectTopTabs.module.scss';
import { useState } from 'react';

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
    <LoadingOverlay visible={patchMember.isPending}/>
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
      allowDeselect={false}
      clearable={false}
    />
    </>
    // <KoboSelect
    //   name={`member-role-selector-${username}`}
    //   type='outline'
    //   size='m'
    //   placement={placement}
    //   options={[
    //     {
    //       value: OrganizationUserRole.admin,
    //       label: t('Admin'),
    //     },
    //     {
    //       value: OrganizationUserRole.member,
    //       label: t('Member'),
    //     },
    //   ]}
    //   selectedOption={role}
    //   onChange={(newRole: string | null) => {
    //     if (newRole) {
    //       patchMember.mutateAsync({role: newRole as OrganizationUserRole});
    //     }
    //   }}
    //   isPending={patchMember.isPending}
    //   isDisabled={!canModifyRole}
    // />
  );
}

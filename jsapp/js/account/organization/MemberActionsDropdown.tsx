// Libraries
import {useState} from 'react';

// Partial components
import ActionIcon from 'jsapp/js/components/common/ActionIcon';
import MemberRemoveModal from './MemberRemoveModal';
import {Menu} from '@mantine/core';

// Stores, hooks and utilities
import {useSession} from 'jsapp/js/stores/useSession';
import {getSimpleMMOLabel} from './organization.utils';
import envStore from 'jsapp/js/envStore';
import subscriptionStore from 'jsapp/js/account/subscriptionStore';

// Constants and types
import {OrganizationUserRole} from './organizationQuery';

// Styles
import router from 'jsapp/js/router/router';
import {ROUTES} from 'jsapp/js/router/routerConstants';

interface MemberActionsDropdownProps {
  targetUsername: string;
  /**
   * The role of the currently logged in user, i.e. the role of the user that
   * wants to do the actions (not the role of the target member).
   */
  currentUserRole: OrganizationUserRole;
}

/**
 * A dropdown with all actions that can be taken towards an organization member.
 */
export default function MemberActionsDropdown({
  targetUsername,
  currentUserRole,
}: MemberActionsDropdownProps) {
  const session = useSession();
  const [isRemoveModalVisible, setIsRemoveModalVisible] = useState(false);

  // Wait for session
  if (!session.currentLoggedAccount?.username) {
    return null;
  }

  // Should Not Happen™, but let's make it foolproof :) Members are not allowed
  // to do anything here under any circumstances.
  if (currentUserRole === OrganizationUserRole.member) {
    return null;
  }

  // If logged in user is an admin and tries to remove themselves, we need
  // different UI - thus we check it here.
  const isAdminRemovingSelf = Boolean(
    targetUsername === session.currentLoggedAccount?.username &&
    currentUserRole === OrganizationUserRole.admin
  );

  // Different button label when user is removing themselves
  let removeButtonLabel = t('Remove');
  if (isAdminRemovingSelf) {
    const mmoLabel = getSimpleMMOLabel(
      envStore.data,
      subscriptionStore.activeSubscriptions[0],
      false,
      false
    );
    removeButtonLabel = t('Leave ##TEAM_OR_ORGANIZATION##')
      .replace('##TEAM_OR_ORGANIZATION##', mmoLabel);
  }

  const onRemovalConfirmation = () => {
    setIsRemoveModalVisible(false);
    if (isAdminRemovingSelf) {
      // Redirect to account root after leaving the organization
      router.navigate(ROUTES.ACCOUNT_ROOT);
    }
  };

  return (
    <>
      {isRemoveModalVisible &&
        <MemberRemoveModal
          username={targetUsername}
          isRemovingSelf={isAdminRemovingSelf}
          onConfirmDone={onRemovalConfirmation}
          onCancel={() => setIsRemoveModalVisible(false)}
        />
      }

      <Menu width={100} offset={0}>
        <Menu.Target>
          <ActionIcon variant='transparent' size='md' iconName='more' />
        </Menu.Target>

        <Menu.Dropdown>
          <Menu.Item
            variant='danger'
            onClick={() => setIsRemoveModalVisible(true)}
          >
            {removeButtonLabel}
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>
    </>
  );
}

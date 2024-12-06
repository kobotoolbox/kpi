// Libraries
import {useState} from 'react';
import cx from 'classnames';

// Partial components
import KoboDropdown from 'jsapp/js/components/common/koboDropdown';
import Button from 'jsapp/js/components/common/button';
import MemberRemoveModal, {REMOVE_SELF_TEXT} from './MemberRemoveModal';

// Stores, hooks and utilities
import {useSession} from 'jsapp/js/stores/useSession';
import {getSimpleMMOLabel} from './organization.utils';
import envStore from 'jsapp/js/envStore';
import subscriptionStore from 'jsapp/js/account/subscriptionStore';

// Constants and types
import {OrganizationUserRole} from './organizationQuery';

// Styles
import styles from './memberActionsDropdown.module.scss';

interface MemberActionsDropdownProps {
  /** Target member username. */
  username: string;
  /**
   * The role of the currently logged in user, i.e. the role of the user that
   * wants to do the actions (not the role of the target member).
   */
  currentUserRole: OrganizationUserRole;
}

/**
 * A dropdown with all actions that can be taken towards an organization member.
 */
export default function MemberActionsDropdown(
  {username, currentUserRole}: MemberActionsDropdownProps
) {
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
    username === session.currentLoggedAccount?.username &&
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
    removeButtonLabel = REMOVE_SELF_TEXT.confirmButtonLabel
      .replace('##team/org##', mmoLabel);
  }

  return (
    <>
      {isRemoveModalVisible &&
        <MemberRemoveModal
          username={username}
          isRemovingSelf={isAdminRemovingSelf}
          onConfirmDone={() => {
            setIsRemoveModalVisible(false);
          }}
          onCancel={() => setIsRemoveModalVisible(false)}
        />
      }

      <KoboDropdown
        name={`member-actions-dropdown-${username}`}
        placement='down-right'
        hideOnMenuClick
        triggerContent={<Button type='text' size='m' startIcon='more'/>}
        menuContent={
          <div className={styles.menuContenet}>
            <Button
              className={cx(styles.menuButton, styles.menuButtonRed)}
              type='text'
              size='m'
              label={removeButtonLabel}
              onClick={() => setIsRemoveModalVisible(true)}
            />
          </div>
        }
      />
    </>
  );
}

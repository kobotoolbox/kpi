// Libraries
import {useState} from 'react';
import cx from 'classnames';

// Partial components
import KoboDropdown from 'jsapp/js/components/common/koboDropdown';
import Button from 'jsapp/js/components/common/button';
import MemberRemoveModal, {REMOVE_SELF_TEXT} from './MemberRemoveModal';

// Stores, hooks and utilities
import {useSession} from 'jsapp/js/stores/useSession';

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
  onRequestRemove: (username: string) => void;
}

/**
 * A dropdown with all actions that can be taken towards an organization member.
 */
export default function MemberActionsDropdown(
  {username, currentUserRole, onRequestRemove}: MemberActionsDropdownProps
) {
  const session = useSession();
  const [isRemoveModalVisible, setIsRemoveModalVisible] = useState(false);

  // Wait for session
  if (!session.currentLoggedAccount?.username) {
    return null;
  }

  // Should not happen™, but let's make it foolproof :) Members are not allowed
  // to do anything here.
  if (currentUserRole === OrganizationUserRole.member) {
    return null;
  }

  // If logged in user is an admin and tries to remove themselves, we need
  // different UI.
  const isAdminRemovingSelf = Boolean(
    username === session.currentLoggedAccount?.username &&
    currentUserRole === OrganizationUserRole.admin
  );

  // Different button label when user is removing themselves
  let removeButtonLabel = t('Remove');
  if (isAdminRemovingSelf) {
    removeButtonLabel = REMOVE_SELF_TEXT.confirmButtonLabel;
  }

  return (
    <>
      {isRemoveModalVisible &&
        <MemberRemoveModal
          username={username}
          isRemovingSelf={isAdminRemovingSelf}
          onConfirm={() => {
            setIsRemoveModalVisible(false);
            onRequestRemove(username);
          }}
          onCancel={() => setIsRemoveModalVisible(false)}
        />
      }

      <KoboDropdown
        name={`member-actions-dropdown-${username}`}
        placement='down-right'
        hideOnMenuClick
        triggerContent={<Button type='text' size='m' startIcon='more-vertical'/>}
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

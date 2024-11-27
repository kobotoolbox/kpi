// Libraries
import {useState} from 'react';
import cx from 'classnames';

// Partial components
import KoboDropdown from 'jsapp/js/components/common/koboDropdown';
import Button from 'jsapp/js/components/common/button';
import MemberRemoveModal from './MemberRemoveModal';

// Styles
import styles from './memberActionsDropdown.module.scss';

interface MemberActionsDropdownProps {
  username: string;
  onRequestRemove: (username: string) => void;
}

/**
 * A dropdown with all actions that can be taken towards an organization member.
 */
export default function MemberActionsDropdown(
  {username, onRequestRemove}: MemberActionsDropdownProps
) {
  const [isRemoveModalVisible, setIsRemoveModalVisible] = useState(false);

  return (
    <>
      {isRemoveModalVisible &&
        <MemberRemoveModal
          username={username}
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
        triggerContent={
          <Button
            type='text'
            size='m'
            startIcon='more-vertical'
          />
        }
        menuContent={
          <div className={styles.menuContenet}>
            <Button
              className={cx(styles.menuButton, styles.menuButtonRed)}
              type='text'
              size='m'
              label={t('Remove')}
              onClick={() => setIsRemoveModalVisible(true)}
            />
          </div>
        }
      />
    </>
  );
}

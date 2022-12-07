import React, {useState} from 'react';
import {useNavigate} from 'react-router-dom';
import classNames from 'classnames';
import Icon from 'js/components/common/icon';
import KoboDropdown, {KoboDropdownPlacements} from 'js/components/common/koboDropdown';
import {PROJECTS_ROUTES} from 'js/projects/routes';
import styles from './viewSwitcher.module.scss';

// TODO get this list from backend:
const DEFINED_VIEWS = [
  {
    uid: '1',
    label: 'Custom View 1',
  },
  {
    uid: '2',
    label: 'Custom View 2',
  },
];

interface ViewSwitcherProps {
  selectedViewUid: string;
  /** Total number of asset of current view. */
  viewCount?: number;
  disabled?: boolean;
}

export default function ViewSwitcher(props: ViewSwitcherProps) {
  // We track the menu visibility for the trigger icon.
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const navigate = useNavigate();

  const onOptionClick = (viewUid: string) => {
    console.log(viewUid);
    if (viewUid === 'kobo_my_projects' || viewUid === null) {
      navigate(PROJECTS_ROUTES.MY_PROJECTS);
    } else {
      navigate(PROJECTS_ROUTES.CUSTOM_VIEW.replace(':viewUid', viewUid));
    }
  };

  return (
    <div className={classNames({
      [styles.root]: true,
      [styles['is-menu-visible']]: isMenuVisible,
    })}>
      <KoboDropdown
        name='projects_view_switcher'
        placement={KoboDropdownPlacements['down-left']}
        isDisabled={props.disabled || false}
        hideOnMenuClick
        onMenuVisibilityChange={setIsMenuVisible}
        triggerContent={
          <button className={styles.trigger}>
            {DEFINED_VIEWS.find((view) => view.uid === props.selectedViewUid)?.label}
            {props.viewCount !== undefined &&
              <span className={styles['trigger-badge']}>{props.viewCount}</span>
            }
            <Icon
              classNames={[styles['trigger-icon']]}
              size='xxs'
              name={isMenuVisible ? 'caret-up' : 'caret-down'}
            />
          </button>
        }
        menuContent={
          <div className={styles.menu}>
            <button
              key='kobo_my_projects'
              className={styles['menu-option']}
              onClick={() => onOptionClick('kobo_my_projects')}
            >
              {t('My Projects')}
            </button>
            {DEFINED_VIEWS.map((view) =>
              <button
                key={view.uid}
                className={styles['menu-option']}
                onClick={() => onOptionClick(view.uid)}
              >
                {view.label}
              </button>
            )}
          </div>
        }
      />
    </div>
  );
}

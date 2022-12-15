import React, {useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {observer} from 'mobx-react-lite';
import classNames from 'classnames';
import Icon from 'js/components/common/icon';
import KoboDropdown, {
  KoboDropdownPlacements,
} from 'js/components/common/koboDropdown';
import {PROJECTS_ROUTES} from 'js/projects/routes';
import {ROUTES} from 'js/router/routerConstants';
import projectViewsStore from './projectViewsStore';
import styles from './viewSwitcher.module.scss';
import {HOME_VIEW} from './constants';

interface ViewSwitcherProps {
  selectedViewUid: string;
}

function ViewSwitcher(props: ViewSwitcherProps) {
  // We track the menu visibility for the trigger icon.
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const [projectViews] = useState(() => projectViewsStore);
  const navigate = useNavigate();

  const onOptionClick = (viewUid: string) => {
    if (viewUid === HOME_VIEW.uid || viewUid === null) {
      // TODO change this to PROJECTS_ROUTES.MY_PROJECTS
      navigate(ROUTES.FORMS);
    } else {
      navigate(PROJECTS_ROUTES.CUSTOM_VIEW.replace(':viewUid', viewUid));
      // The store keeps a number of assets of each view, and that number
      // might change after changing projects, so we make sure we get fresh data
      projectViews.fetchData();
    }
  };

  const getTriggerLabel = () => {
    if (props.selectedViewUid === HOME_VIEW.uid) {
      return HOME_VIEW.name;
    }

    return projectViews.getView(props.selectedViewUid)?.name;
  };

  const getTriggerCount = () => {
    if (props.selectedViewUid === HOME_VIEW.uid) {
      return null;
    }

    return projectViews.getView(props.selectedViewUid)?.assets_count;
  };

  if (!projectViews.isInitialised) {
    return null;
  }

  return (
    <div
      className={classNames({
        [styles.root]: true,
        [styles.isMenuVisible]: isMenuVisible,
      })}
    >
      <KoboDropdown
        name='projects_view_switcher'
        placement={KoboDropdownPlacements['down-left']}
        hideOnMenuClick
        onMenuVisibilityChange={setIsMenuVisible}
        triggerContent={
          <button className={styles.trigger}>
            {getTriggerLabel()}
            {getTriggerCount() !== null && (
              <span className={styles.triggerBadge}>
                {getTriggerCount()}
              </span>
            )}
            <Icon size='xxs' name={isMenuVisible ? 'caret-up' : 'caret-down'} />
          </button>
        }
        menuContent={
          <div className={styles.menu}>
            <button
              key={HOME_VIEW.uid}
              className={styles.menuOption}
              onClick={() => onOptionClick(HOME_VIEW.uid)}
            >
              {HOME_VIEW.name}
            </button>
            {projectViews.views.map((view) => (
              <button
                key={view.uid}
                className={styles.menuOption}
                onClick={() => onOptionClick(view.uid)}
              >
                {view.name}
              </button>
            ))}
          </div>
        }
      />
    </div>
  );
}

export default observer(ViewSwitcher);

import React, {useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {observer} from 'mobx-react-lite';
import classNames from 'classnames';
import Icon from 'js/components/common/icon';
import KoboDropdown from 'js/components/common/koboDropdown';
import {PROJECTS_ROUTES} from 'jsapp/js/router/routerConstants';
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
      navigate(PROJECTS_ROUTES.MY_PROJECTS);
    } else {
      navigate(PROJECTS_ROUTES.CUSTOM_VIEW.replace(':viewUid', viewUid));
      // The store keeps a number of assets of each view, and that number
      // might change after changing projects, so we make sure we get fresh data
      projectViews.fetchData();
    }
  };

  let triggerLabel = HOME_VIEW.name;
  if (props.selectedViewUid !== HOME_VIEW.uid) {
    triggerLabel = projectViews.getView(props.selectedViewUid)?.name || '-';
  }

  // We don't want to display anything before the API call is done.
  if (!projectViews.isFirstLoadComplete) {
    return null;
  }

  // If there are no custom views defined, there's no point in displaying
  // the dropdown, we will display a "simple" header.
  if (projectViews.views.length === 0) {
    return (
      <button
        className={classNames(styles.trigger, styles.triggerSimple)}
        title={triggerLabel}
      >
        <label>{triggerLabel}</label>
      </button>
    );
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
        placement={'down-left'}
        hideOnMenuClick
        onMenuVisibilityChange={setIsMenuVisible}
        triggerContent={
          <button className={styles.trigger} title={triggerLabel}>
            <label>{triggerLabel}</label>
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
